import io
import logging

from aiogram import Router, F, Bot
from aiogram.types import Message, CallbackQuery, ReplyKeyboardMarkup, KeyboardButton
from aiogram.fsm.context import FSMContext

from bot.api_client import chat as chat_api
from bot.api_client.base import APIClient
from bot.services.session_manager import UserSession
from bot.services import chat_tracker
from bot.keyboards.inline import chat_pagination_keyboard
from bot.keyboards.callbacks import ChatCB
from bot.keyboards.main_menu import get_main_menu
from bot.states.chat import ChatStates
from bot.utils.formatters import format_chat_page

logger = logging.getLogger(__name__)
router = Router()

CHAT_REPLY_KB = ReplyKeyboardMarkup(
    keyboard=[
        [KeyboardButton(text="🔄 Обновить"), KeyboardButton(text="🚪 Выйти из чата")],
    ],
    resize_keyboard=True,
    input_field_placeholder="Введите сообщение...",
)


async def _delete_tracked(bot: Bot, tg_user_id: int) -> None:
    """Delete all tracked bot messages for this user."""
    chat_id, msg_ids = chat_tracker.get_and_clear_messages(tg_user_id)
    if not chat_id:
        return
    for mid in msg_ids:
        try:
            await bot.delete_message(chat_id, mid)
        except Exception:
            pass


async def _show_chat(
    bot: Bot,
    tg_user_id: int,
    chat_id: int,
    api_client: APIClient,
    session: UserSession,
    page: int = -1,
    with_hint: bool = False,
) -> None:
    """Fetch messages, delete old display, send new one with pagination."""
    await _delete_tracked(bot, tg_user_id)
    await chat_api.mark_read(api_client)
    messages = await chat_api.get_messages(api_client)
    if messages is None:
        sent = await bot.send_message(
            chat_id, "<i>Не удалось загрузить чат.</i>", reply_markup=CHAT_REPLY_KB,
        )
        chat_tracker.track_message(tg_user_id, sent.message_id)
        return

    text, current_page, total_pages = format_chat_page(messages, session.partner_id, page)
    if with_hint:
        text += "\n\n<i>Просто напишите сообщение — оно будет отправлено админу.</i>"

    inline_kb = chat_pagination_keyboard(current_page, total_pages) if total_pages > 1 else None
    sent = await bot.send_message(chat_id, text, reply_markup=CHAT_REPLY_KB)
    chat_tracker.track_message(tg_user_id, sent.message_id)

    # Send pagination as a separate small message so reply keyboard stays
    if inline_kb:
        nav_sent = await bot.send_message(chat_id, "📄 Страницы:", reply_markup=inline_kb)
        chat_tracker.track_message(tg_user_id, nav_sent.message_id)


@router.message(F.text == "💬 Чат")
async def enter_chat(message: Message, state: FSMContext, api_client: APIClient, session: UserSession, bot: Bot):
    """Enter chat mode."""
    await state.set_state(ChatStates.active)
    chat_tracker.enter_chat(message.from_user.id, message.chat.id)

    try:
        await message.delete()
    except Exception:
        pass

    await _show_chat(
        bot, message.from_user.id, message.chat.id, api_client, session, page=-1, with_hint=True,
    )


@router.message(ChatStates.active, F.text == "🚪 Выйти из чата")
async def exit_chat(message: Message, state: FSMContext, bot: Bot):
    """Exit chat mode, clean up all chat messages."""
    await _delete_tracked(bot, message.from_user.id)
    chat_tracker.exit_chat(message.from_user.id)
    await state.clear()

    try:
        await message.delete()
    except Exception:
        pass

    await message.answer("Вы вышли из чата.", reply_markup=get_main_menu())


@router.message(ChatStates.active, F.text == "🔄 Обновить")
async def refresh_chat(message: Message, api_client: APIClient, session: UserSession, bot: Bot):
    """Manual refresh — jump to last page."""
    try:
        await message.delete()
    except Exception:
        pass
    await _show_chat(
        bot, message.from_user.id, message.chat.id, api_client, session, page=-1,
    )


@router.callback_query(ChatCB.filter(F.action == "page"))
async def paginate_chat(
    callback: CallbackQuery,
    callback_data: ChatCB,
    api_client: APIClient,
    session: UserSession,
    bot: Bot,
):
    """Navigate chat pages via inline buttons."""
    await callback.answer()

    # Re-fetch messages and show requested page
    messages = await chat_api.get_messages(api_client)
    if messages is None:
        return

    text, current_page, total_pages = format_chat_page(
        messages, session.partner_id, callback_data.page,
    )
    inline_kb = chat_pagination_keyboard(current_page, total_pages) if total_pages > 1 else None

    # Delete old tracked and send fresh
    await _delete_tracked(bot, callback.from_user.id)

    sent = await bot.send_message(callback.message.chat.id, text, reply_markup=CHAT_REPLY_KB)
    chat_tracker.track_message(callback.from_user.id, sent.message_id)

    if inline_kb:
        nav_sent = await bot.send_message(callback.message.chat.id, "📄 Страницы:", reply_markup=inline_kb)
        chat_tracker.track_message(callback.from_user.id, nav_sent.message_id)


@router.callback_query(ChatCB.filter(F.action == "noop"))
async def noop_chat(callback: CallbackQuery):
    """Page counter button — do nothing."""
    await callback.answer()


@router.message(ChatStates.active, F.photo | F.document)
async def send_chat_file(message: Message, api_client: APIClient, session: UserSession, bot: Bot):
    """In chat mode, handle photo/document uploads."""
    try:
        await message.delete()
    except Exception:
        pass

    try:
        buf = io.BytesIO()
        if message.photo:
            file_obj = await bot.get_file(message.photo[-1].file_id)
            await bot.download_file(file_obj.file_path, buf)
            filename = f"photo_{message.photo[-1].file_id[:8]}.jpg"
        elif message.document:
            file_obj = await bot.get_file(message.document.file_id)
            await bot.download_file(file_obj.file_path, buf)
            filename = message.document.file_name or f"file_{message.document.file_id[:8]}"
        else:
            return

        caption = (message.caption or "").strip()
        result = await chat_api.send_file(api_client, buf.getvalue(), filename, caption)

        if not result:
            sent = await message.answer("❌ Не удалось отправить файл.", reply_markup=CHAT_REPLY_KB)
            chat_tracker.track_message(message.from_user.id, sent.message_id)
            return

        await _show_chat(
            bot, message.from_user.id, message.chat.id, api_client, session, page=-1,
        )
    except Exception as e:
        logger.error(f"File upload failed: {e}")
        sent = await message.answer("❌ Ошибка при отправке файла.", reply_markup=CHAT_REPLY_KB)
        chat_tracker.track_message(message.from_user.id, sent.message_id)


@router.message(ChatStates.active)
async def send_chat_message(message: Message, api_client: APIClient, session: UserSession, bot: Bot):
    """In chat mode, any text message is sent directly."""
    text = (message.text or "").strip()
    if not text:
        return

    try:
        await message.delete()
    except Exception:
        pass

    result = await chat_api.send_message(api_client, text)
    if not result:
        sent = await message.answer("❌ Не удалось отправить.", reply_markup=CHAT_REPLY_KB)
        chat_tracker.track_message(message.from_user.id, sent.message_id)
        return

    # Auto-refresh to last page after sending
    await _show_chat(
        bot, message.from_user.id, message.chat.id, api_client, session, page=-1,
    )

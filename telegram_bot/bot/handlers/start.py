from aiogram import Router, F, Bot
from aiogram.filters import CommandStart, Command
from aiogram.types import Message
from aiogram.fsm.context import FSMContext

from bot.services import session_manager
from bot.services import chat_tracker
from bot.keyboards.main_menu import get_main_menu, remove_keyboard

router = Router()


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext, bot: Bot):
    # Clean up chat mode if active
    if chat_tracker.is_in_chat(message.from_user.id):
        _, msg_ids = chat_tracker.get_and_clear_messages(message.from_user.id)
        for mid in msg_ids:
            try:
                await bot.delete_message(message.chat.id, mid)
            except Exception:
                pass
        chat_tracker.exit_chat(message.from_user.id)
    await state.clear()
    session = session_manager.get_session(message.from_user.id)
    if session:
        await message.answer(
            f"Добро пожаловать, <b>{session.partner_name}</b>!\n"
            "Выберите раздел в меню.",
            reply_markup=get_main_menu(),
        )
    else:
        await message.answer(
            "Добро пожаловать в партнёрский кабинет!\n\n"
            "Для начала работы выполните вход:\n"
            "/login — войти в аккаунт\n"
            "/help — список команд",
            reply_markup=remove_keyboard,
        )


@router.message(Command("help"))
async def cmd_help(message: Message):
    await message.answer(
        "<b>Доступные команды:</b>\n\n"
        "/start — Главное меню\n"
        "/login — Войти в аккаунт\n"
        "/logout — Выйти из аккаунта\n"
        "/cancel — Отменить текущее действие\n"
        "/help — Список команд",
    )


@router.message(Command("cancel"))
async def cmd_cancel(message: Message, state: FSMContext, bot: Bot):
    current = await state.get_state()
    if current is None:
        await message.answer("Нет активного действия для отмены.")
        return
    # Clean up chat mode if active
    if chat_tracker.is_in_chat(message.from_user.id):
        _, msg_ids = chat_tracker.get_and_clear_messages(message.from_user.id)
        for mid in msg_ids:
            try:
                await bot.delete_message(message.chat.id, mid)
            except Exception:
                pass
        chat_tracker.exit_chat(message.from_user.id)
    await state.clear()
    session = session_manager.get_session(message.from_user.id)
    if session:
        await message.answer("Действие отменено.", reply_markup=get_main_menu())
    else:
        await message.answer("Действие отменено.", reply_markup=remove_keyboard)

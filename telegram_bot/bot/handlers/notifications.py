import logging

from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, BufferedInputFile

from bot.api_client import notifications as notif_api
from bot.api_client.base import APIClient
from bot.services.session_manager import UserSession
from bot.keyboards.inline import notifications_list_keyboard
from bot.keyboards.callbacks import NotifCB, PaginationCB
from bot.utils.formatters import format_notification, get_notification_file_type

logger = logging.getLogger(__name__)

router = Router()

_notif_cache: dict[int, list] = {}


@router.message(F.text == "🔔 Уведомления")
async def show_notifications(message: Message, api_client: APIClient, session: UserSession):
    notifs = await notif_api.get_notifications(api_client)
    if notifs is None:
        await message.answer("Не удалось загрузить уведомления.")
        return
    if not notifs:
        await message.answer("У вас нет уведомлений.")
        return
    _notif_cache[message.from_user.id] = notifs
    await message.answer("🔔 <b>Уведомления:</b>", reply_markup=notifications_list_keyboard(notifs, 0))


@router.callback_query(PaginationCB.filter(F.section == "notifs"))
async def paginate_notifs(callback: CallbackQuery, callback_data: PaginationCB, api_client: APIClient, session: UserSession):
    await callback.answer()
    notifs = _notif_cache.get(callback.from_user.id)
    if not notifs:
        notifs = await notif_api.get_notifications(api_client)
        if notifs:
            _notif_cache[callback.from_user.id] = notifs
    if not notifs:
        return
    await callback.message.edit_reply_markup(reply_markup=notifications_list_keyboard(notifs, callback_data.page))


@router.callback_query(NotifCB.filter(F.action == "detail"))
async def notif_detail(callback: CallbackQuery, callback_data: NotifCB, api_client: APIClient, session: UserSession):
    await callback.answer()
    await notif_api.mark_as_read(api_client, callback_data.id)
    notifs = _notif_cache.get(callback.from_user.id, [])
    notif = next((n for n in notifs if n.get("id") == callback_data.id), None)
    if not notif:
        await callback.message.answer("Уведомление не найдено.")
        return

    notif["is_read"] = True
    text = format_notification(notif)
    file_sent = False

    if notif.get("file_url") and notif.get("file_name"):
        try:
            file_bytes = await api_client.get_raw_bytes(notif["file_url"])
            if file_bytes:
                input_file = BufferedInputFile(file_bytes, filename=notif["file_name"])
                ftype = get_notification_file_type(notif["file_name"])
                caption = text if len(text) <= 1024 else None
                if ftype == "image":
                    await callback.message.answer_photo(input_file, caption=caption, parse_mode="HTML")
                elif ftype == "video":
                    await callback.message.answer_video(input_file, caption=caption, parse_mode="HTML")
                else:
                    await callback.message.answer_document(input_file, caption=caption, parse_mode="HTML")
                if not caption:
                    await callback.message.answer(text, parse_mode="HTML")
                file_sent = True
        except Exception as e:
            logger.error(f"Failed to send notification file: {e}")

    if not file_sent:
        await callback.message.answer(text, parse_mode="HTML")


@router.callback_query(NotifCB.filter(F.action == "read_all"))
async def read_all_notifs(callback: CallbackQuery, api_client: APIClient, session: UserSession):
    await callback.answer("Все отмечены как прочитанные")
    await notif_api.mark_all_as_read(api_client)
    notifs = _notif_cache.get(callback.from_user.id, [])
    for n in notifs:
        n["is_read"] = True
    if notifs:
        await callback.message.edit_reply_markup(reply_markup=notifications_list_keyboard(notifs, 0))

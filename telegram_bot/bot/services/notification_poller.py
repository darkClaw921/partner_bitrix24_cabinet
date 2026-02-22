import asyncio
import logging
from aiogram import Bot

from bot.services.session_manager import get_all_sessions, get_api_client
from bot.services import chat_tracker
from bot.api_client import notifications as notif_api
from bot.api_client import chat as chat_api
from bot.config import settings
from aiogram.types import BufferedInputFile
from bot.utils.formatters import format_notification_push, format_chat_page, get_notification_file_type
from bot.keyboards.inline import chat_pagination_keyboard

logger = logging.getLogger(__name__)

# Track known notification IDs per user so we only push truly new ones
_known_notif_ids: dict[int, set[int]] = {}
_prev_chat_counts: dict[int, int] = {}


def clear_user_state(tg_user_id: int) -> None:
    """Clear polling state for a user (call on logout)."""
    _known_notif_ids.pop(tg_user_id, None)
    _prev_chat_counts.pop(tg_user_id, None)


async def poll_notifications(bot: Bot):
    interval = settings.NOTIFICATION_POLL_INTERVAL
    logger.info(f"Notification poller started (interval: {interval}s)")

    while True:
        try:
            await asyncio.sleep(interval)
            sessions = get_all_sessions()

            for tg_user_id, session in sessions.items():
                try:
                    api = get_api_client(tg_user_id)
                    if not api:
                        continue

                    # --- Notifications: send full content ---
                    notifications = await notif_api.get_notifications(api)
                    if notifications is not None:
                        known = _known_notif_ids.get(tg_user_id)
                        all_ids = {n.get("id") for n in notifications if n.get("id")}

                        if known is None:
                            # First poll after login — just record existing IDs
                            _known_notif_ids[tg_user_id] = all_ids
                        else:
                            new_notifs = [
                                n for n in notifications
                                if n.get("id") and n["id"] not in known and not n.get("is_read")
                            ]
                            for notif in new_notifs:
                                try:
                                    text = format_notification_push(notif)
                                    file_sent = False

                                    if notif.get("file_url") and notif.get("file_name"):
                                        try:
                                            file_bytes = await api.get_raw_bytes(notif["file_url"])
                                            if file_bytes:
                                                input_file = BufferedInputFile(file_bytes, filename=notif["file_name"])
                                                ftype = get_notification_file_type(notif["file_name"])
                                                caption = text if len(text) <= 1024 else None
                                                if ftype == "image":
                                                    await bot.send_photo(tg_user_id, input_file, caption=caption, parse_mode="HTML")
                                                elif ftype == "video":
                                                    await bot.send_video(tg_user_id, input_file, caption=caption, parse_mode="HTML")
                                                else:
                                                    await bot.send_document(tg_user_id, input_file, caption=caption, parse_mode="HTML")
                                                if not caption:
                                                    await bot.send_message(tg_user_id, text, parse_mode="HTML")
                                                file_sent = True
                                        except Exception as e:
                                            logger.error(f"Failed to send notification file to {tg_user_id}: {e}")

                                    if not file_sent:
                                        await bot.send_message(tg_user_id, text, parse_mode="HTML")

                                    await notif_api.mark_as_read(api, notif["id"])
                                except Exception as e:
                                    logger.error(f"Failed to push notification {notif.get('id')} to {tg_user_id}: {e}")
                            _known_notif_ids[tg_user_id] = all_ids

                    # --- Chat ---
                    chat_count = await chat_api.get_unread_count(api)
                    prev_chat = _prev_chat_counts.get(tg_user_id, 0)

                    if chat_count > prev_chat:
                        if chat_tracker.is_in_chat(tg_user_id):
                            chat_id = chat_tracker.get_chat_id(tg_user_id)
                            if chat_id:
                                await _push_chat_update(bot, tg_user_id, chat_id, api, session)
                        else:
                            new_count = chat_count - prev_chat
                            await bot.send_message(
                                tg_user_id,
                                f"💬 У вас {new_count} новых сообщений в чате!",
                            )

                    _prev_chat_counts[tg_user_id] = chat_count

                except Exception as e:
                    logger.error(f"Polling error for user {tg_user_id}: {e}")

        except asyncio.CancelledError:
            logger.info("Notification poller stopped")
            break
        except Exception as e:
            logger.error(f"Notification poller error: {e}")
            await asyncio.sleep(5)


async def _push_chat_update(bot: Bot, tg_user_id: int, chat_id: int, api, session):
    """Delete old chat display and show updated messages (last page) for user in chat mode."""
    try:
        _, msg_ids = chat_tracker.get_and_clear_messages(tg_user_id)
        for mid in msg_ids:
            try:
                await bot.delete_message(chat_id, mid)
            except Exception:
                pass

        await chat_api.mark_read(api)
        messages = await chat_api.get_messages(api)
        if messages is None:
            return

        text, current_page, total_pages = format_chat_page(messages, session.partner_id, page=-1)
        sent = await bot.send_message(chat_id, text)
        chat_tracker.track_message(tg_user_id, sent.message_id)

        if total_pages > 1:
            inline_kb = chat_pagination_keyboard(current_page, total_pages)
            nav_sent = await bot.send_message(chat_id, "📄 Страницы:", reply_markup=inline_kb)
            chat_tracker.track_message(tg_user_id, nav_sent.message_id)

    except Exception as e:
        logger.error(f"Push chat update error for user {tg_user_id}: {e}")

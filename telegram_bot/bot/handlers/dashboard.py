from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.utils.keyboard import InlineKeyboardBuilder

from bot.api_client import analytics as analytics_api
from bot.api_client.base import APIClient
from bot.services.session_manager import UserSession
from bot.utils.formatters import format_dashboard
from bot.keyboards.callbacks import MenuCB

router = Router()


@router.message(F.text == "📊 Дашборд")
async def show_dashboard(message: Message, api_client: APIClient, session: UserSession):
    summary = await analytics_api.get_summary(api_client)
    if not summary:
        await message.answer("Не удалось загрузить данные дашборда.")
        return

    text = format_dashboard(summary)
    builder = InlineKeyboardBuilder()
    builder.button(text="📈 Подробная аналитика", callback_data=MenuCB(action="analytics"))
    await message.answer(text, reply_markup=builder.as_markup())


@router.callback_query(MenuCB.filter(F.action == "analytics"))
async def cb_go_analytics(callback: CallbackQuery, api_client: APIClient, session: UserSession):
    from bot.handlers.analytics import _show_analytics
    await callback.answer()
    await _show_analytics(callback.message, api_client)

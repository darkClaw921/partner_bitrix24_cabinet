from aiogram import Router, F
from aiogram.types import Message

from bot.api_client import analytics as analytics_api
from bot.api_client.base import APIClient
from bot.services.session_manager import UserSession
from bot.utils.formatters import format_analytics

router = Router()


async def _show_analytics(message: Message, api_client: APIClient):
    summary = await analytics_api.get_summary(api_client)
    links_stats = await analytics_api.get_links_stats(api_client)
    if not summary:
        await message.answer("Не удалось загрузить аналитику.")
        return
    text = format_analytics(summary, links_stats or [])
    await message.answer(text)


@router.message(F.text == "📈 Аналитика")
async def show_analytics(message: Message, api_client: APIClient, session: UserSession):
    await _show_analytics(message, api_client)

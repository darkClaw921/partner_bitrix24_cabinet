import asyncio
import logging
import sys

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import ErrorEvent

from bot.config import settings
from bot.middlewares.auth import AuthMiddleware
from bot.handlers import start, auth, dashboard, analytics, links, clients, reports, payment_requests, chat, notifications, profile
from bot.services.notification_poller import poll_notifications

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


async def on_startup(bot: Bot):
    me = await bot.get_me()
    logger.info(f"Bot started: @{me.username}")


async def main():
    bot = Bot(
        token=settings.TELEGRAM_BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )

    dp = Dispatcher()

    # Routers without auth middleware (public)
    dp.include_router(start.router)
    dp.include_router(auth.router)

    # Routers with auth middleware (protected)
    for handler_module in [
        dashboard, analytics, links, clients, reports,
        payment_requests, chat, notifications, profile,
    ]:
        handler_module.router.message.middleware(AuthMiddleware())
        handler_module.router.callback_query.middleware(AuthMiddleware())
        dp.include_router(handler_module.router)

    dp.startup.register(on_startup)

    # Global error handler
    @dp.errors()
    async def error_handler(event: ErrorEvent):
        logger.error(f"Update error: {event.exception}", exc_info=event.exception)
        return True

    # Start notification poller as background task
    poller_task = asyncio.create_task(poll_notifications(bot))

    try:
        logger.info("Starting polling...")
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    finally:
        poller_task.cancel()
        try:
            await poller_task
        except asyncio.CancelledError:
            pass


if __name__ == "__main__":
    asyncio.run(main())

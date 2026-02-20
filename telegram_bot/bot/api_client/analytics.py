from bot.api_client.base import APIClient
from typing import Optional


async def get_summary(api: APIClient) -> Optional[dict]:
    return await api.get_json("/analytics/summary")


async def get_links_stats(api: APIClient) -> Optional[list]:
    return await api.get_json("/analytics/links")

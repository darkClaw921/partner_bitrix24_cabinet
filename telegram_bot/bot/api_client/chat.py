from bot.api_client.base import APIClient
from typing import Optional


async def get_messages(api: APIClient) -> Optional[list]:
    return await api.get_json("/chat/messages")


async def send_message(api: APIClient, message: str) -> Optional[dict]:
    resp = await api.post("/chat/messages", json={"message": message})
    if resp.status_code in (200, 201):
        return resp.json()
    return None


async def get_unread_count(api: APIClient) -> int:
    data = await api.get_json("/chat/unread-count")
    if data:
        return data.get("count", 0)
    return 0


async def mark_read(api: APIClient) -> bool:
    resp = await api.post("/chat/read")
    return resp.status_code == 200

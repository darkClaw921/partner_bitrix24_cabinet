from bot.api_client.base import APIClient
from typing import Optional


async def get_notifications(api: APIClient) -> Optional[list]:
    data = await api.get_json("/notifications/")
    if isinstance(data, dict):
        return data.get("notifications", [])
    return data


async def get_unread_count(api: APIClient) -> int:
    data = await api.get_json("/notifications/unread-count")
    if data:
        return data.get("count", 0)
    return 0


async def mark_as_read(api: APIClient, notif_id: int) -> bool:
    resp = await api.post(f"/notifications/{notif_id}/read")
    return resp.status_code == 200


async def mark_all_as_read(api: APIClient) -> bool:
    resp = await api.post("/notifications/read-all")
    return resp.status_code == 200

from bot.api_client.base import APIClient
from typing import Optional


async def get_links(api: APIClient) -> Optional[list]:
    return await api.get_json("/links/")


async def get_link(api: APIClient, link_id: int) -> Optional[dict]:
    return await api.get_json(f"/links/{link_id}")


async def create_link(api: APIClient, data: dict) -> Optional[dict]:
    resp = await api.post("/links/", json=data)
    if resp.status_code in (200, 201):
        return resp.json()
    return {"error": resp.json().get("detail", "Ошибка создания")}

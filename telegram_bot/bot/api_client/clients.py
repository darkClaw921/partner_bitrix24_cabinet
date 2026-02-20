from bot.api_client.base import APIClient
from typing import Optional


async def get_clients(api: APIClient, skip: int = 0, limit: int = 50) -> Optional[list]:
    return await api.get_json(f"/clients/?skip={skip}&limit={limit}")


async def get_all_clients(api: APIClient) -> list:
    """Fetch all clients by paginating with max limit=100."""
    all_clients = []
    skip = 0
    while True:
        batch = await api.get_json(f"/clients/?skip={skip}&limit=100")
        if not batch:
            break
        all_clients.extend(batch)
        if len(batch) < 100:
            break
        skip += 100
    return all_clients


async def get_client(api: APIClient, client_id: int) -> Optional[dict]:
    return await api.get_json(f"/clients/{client_id}")


async def create_client(api: APIClient, data: dict) -> Optional[dict]:
    resp = await api.post("/clients/", json=data)
    if resp.status_code in (200, 201):
        return resp.json()
    return {"error": resp.json().get("detail", "Ошибка создания")}

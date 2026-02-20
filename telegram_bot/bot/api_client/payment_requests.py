from bot.api_client.base import APIClient
from typing import Optional


async def get_payment_requests(api: APIClient) -> Optional[list]:
    return await api.get_json("/payment-requests/")


async def get_payment_request(api: APIClient, req_id: int) -> Optional[dict]:
    return await api.get_json(f"/payment-requests/{req_id}")


async def create_payment_request(api: APIClient, data: dict) -> Optional[dict]:
    resp = await api.post("/payment-requests/", json=data)
    if resp.status_code in (200, 201):
        return resp.json()
    error_detail = "Ошибка создания"
    try:
        error_detail = resp.json().get("detail", error_detail)
    except Exception:
        pass
    return {"error": error_detail}

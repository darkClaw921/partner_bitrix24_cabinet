import httpx
from typing import Optional
from bot.config import settings


async def login(email: str, password: str) -> Optional[dict]:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{settings.api_base_url}/auth/login",
            json={"email": email, "password": password},
        )
        if resp.status_code == 200:
            return resp.json()
        error = resp.json() if resp.status_code < 500 else {}
        return {"error": error.get("detail", "Ошибка авторизации"), "status_code": resp.status_code}


async def get_me(access_token: str) -> Optional[dict]:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{settings.api_base_url}/auth/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if resp.status_code == 200:
            return resp.json()
    return None

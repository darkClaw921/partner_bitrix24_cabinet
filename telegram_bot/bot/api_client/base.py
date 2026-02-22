import httpx
import logging
from typing import Optional

from bot.config import settings

logger = logging.getLogger(__name__)


class APIClient:
    def __init__(self, access_token: str = "", refresh_token: str = ""):
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.base_url = settings.api_base_url
        self._on_tokens_refreshed = None

    def set_tokens_callback(self, callback):
        self._on_tokens_refreshed = callback

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.access_token:
            h["Authorization"] = f"Bearer {self.access_token}"
        return h

    async def _refresh_tokens(self) -> bool:
        if not self.refresh_token:
            return False
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"{self.base_url}/auth/refresh",
                    json={"refresh_token": self.refresh_token},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    self.access_token = data["access_token"]
                    self.refresh_token = data["refresh_token"]
                    if self._on_tokens_refreshed:
                        await self._on_tokens_refreshed(self.access_token, self.refresh_token)
                    return True
        except Exception as e:
            logger.error(f"Token refresh failed: {e}")
        return False

    async def request(self, method: str, path: str, **kwargs) -> httpx.Response:
        url = f"{self.base_url}{path}"
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.request(method, url, headers=self._headers(), **kwargs)
            if resp.status_code == 401 and self.refresh_token:
                if await self._refresh_tokens():
                    resp = await client.request(method, url, headers=self._headers(), **kwargs)
            return resp

    async def get(self, path: str, **kwargs) -> httpx.Response:
        return await self.request("GET", path, **kwargs)

    async def post(self, path: str, **kwargs) -> httpx.Response:
        return await self.request("POST", path, **kwargs)

    async def put(self, path: str, **kwargs) -> httpx.Response:
        return await self.request("PUT", path, **kwargs)

    async def delete(self, path: str, **kwargs) -> httpx.Response:
        return await self.request("DELETE", path, **kwargs)

    async def post_file(self, path: str, file_bytes: bytes, filename: str, data: dict | None = None) -> httpx.Response:
        """Send a multipart file upload (without Content-Type: application/json)."""
        url = f"{self.base_url}{path}"
        headers = {}
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        files = {"file": (filename, file_bytes)}
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, headers=headers, files=files, data=data or {})
            if resp.status_code == 401 and self.refresh_token:
                if await self._refresh_tokens():
                    headers["Authorization"] = f"Bearer {self.access_token}"
                    resp = await client.post(url, headers=headers, files=files, data=data or {})
            return resp

    async def get_json(self, path: str, **kwargs) -> Optional[dict | list]:
        resp = await self.get(path, **kwargs)
        if resp.status_code == 200:
            return resp.json()
        return None

    async def get_bytes(self, path: str, **kwargs) -> Optional[bytes]:
        url = f"{self.base_url}{path}"
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.request("GET", url, headers=self._headers(), **kwargs)
            if resp.status_code == 401 and self.refresh_token:
                if await self._refresh_tokens():
                    resp = await client.request("GET", url, headers=self._headers(), **kwargs)
            if resp.status_code == 200:
                return resp.content
        return None

    async def get_raw_bytes(self, path: str) -> Optional[bytes]:
        """Download bytes from the backend root (without /api prefix).

        Used for files served at /uploads/... which are outside /api.
        """
        # self.base_url is like "http://backend:8000/api" — strip /api
        root_url = self.base_url.rsplit("/api", 1)[0]
        url = f"{root_url}{path}"
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                return resp.content
        return None

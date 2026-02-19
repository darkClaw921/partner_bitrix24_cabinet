import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


class B24IntegrationService:
    def __init__(self):
        settings = get_settings()
        self.base_url = settings.B24_SERVICE_URL.rstrip("/")
        self.api_key = settings.B24_INTERNAL_API_KEY
        self.headers = {"X-Internal-API-Key": self.api_key}

    def _url(self, path: str) -> str:
        return f"{self.base_url}/api/v1{path}"

    # --- Workflows ---

    async def create_workflow(self, name: str, bitrix24_webhook_url: str | None = None) -> dict:
        payload: dict = {"name": name}
        if bitrix24_webhook_url:
            payload["bitrix24_webhook_url"] = bitrix24_webhook_url
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                self._url("/workflows"),
                headers=self.headers,
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_workflow(self, workflow_id: int) -> dict:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                self._url(f"/workflows/{workflow_id}"),
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def delete_workflow(self, workflow_id: int) -> None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.delete(
                self._url(f"/workflows/{workflow_id}"),
                headers=self.headers,
            )
            resp.raise_for_status()

    # --- Settings ---

    async def get_settings(self, workflow_id: int) -> dict:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                self._url(f"/workflows/{workflow_id}/settings"),
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def update_settings(self, workflow_id: int, data: dict) -> dict:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.put(
                self._url(f"/workflows/{workflow_id}/settings"),
                headers=self.headers,
                json=data,
            )
            resp.raise_for_status()
            return resp.json()

    async def generate_api_token(self, workflow_id: int) -> dict:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                self._url(f"/workflows/{workflow_id}/settings/generate-token"),
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def create_field_mapping(self, workflow_id: int, mapping: dict) -> dict:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                self._url(f"/workflows/{workflow_id}/fields/mapping"),
                headers=self.headers,
                json=mapping,
            )
            resp.raise_for_status()
            return resp.json()

    # --- Bitrix24 data ---

    async def get_funnels(self, workflow_id: int) -> list:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                self._url(f"/workflows/{workflow_id}/settings/funnels"),
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_stages(self, workflow_id: int, category_id: int = 0) -> list:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                self._url(f"/workflows/{workflow_id}/settings/stages"),
                headers=self.headers,
                params={"category_id": category_id},
            )
            resp.raise_for_status()
            return resp.json()

    async def get_lead_statuses(self, workflow_id: int) -> list:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                self._url(f"/workflows/{workflow_id}/settings/lead-statuses"),
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    # --- Leads ---

    async def create_lead(
        self, workflow_id: int, name: str, phone: str, extra_fields: dict | None = None
    ) -> dict:
        payload: dict = {"name": name, "phone": phone}
        if extra_fields:
            payload.update(extra_fields)
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                self._url(f"/workflows/{workflow_id}/leads"),
                headers=self.headers,
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_leads(self, workflow_id: int) -> list:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                self._url(f"/workflows/{workflow_id}/leads"),
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    # --- Stats ---

    async def get_conversion_stats(self, workflow_id: int) -> dict:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                self._url(f"/workflows/{workflow_id}/stats/conversion"),
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()


b24_service = B24IntegrationService()

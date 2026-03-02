"""HTTP proxy to b24-transfer-lead for CRM entity operations (contacts, companies, deals)."""

import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


def _get_base_url() -> str:
    settings = get_settings()
    return settings.B24_SERVICE_URL.rstrip("/")


def _get_headers() -> dict[str, str]:
    settings = get_settings()
    return {"X-Internal-API-Key": settings.B24_INTERNAL_API_KEY}


async def search_contacts(workflow_id: int, query: str) -> list[dict]:
    """Search contacts by name in B24 via b24-transfer-lead."""
    url = f"{_get_base_url()}/api/v1/workflows/{workflow_id}/b24/contacts/search"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, headers=_get_headers(), params={"query": query})
        resp.raise_for_status()
        return resp.json()


async def search_companies(workflow_id: int, query: str) -> list[dict]:
    """Search companies by title in B24 via b24-transfer-lead."""
    url = f"{_get_base_url()}/api/v1/workflows/{workflow_id}/b24/companies/search"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, headers=_get_headers(), params={"query": query})
        resp.raise_for_status()
        return resp.json()


async def create_contact(workflow_id: int, data: dict) -> dict:
    """Create a contact in B24 via b24-transfer-lead."""
    url = f"{_get_base_url()}/api/v1/workflows/{workflow_id}/b24/contacts"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(url, headers=_get_headers(), json=data)
        resp.raise_for_status()
        return resp.json()


async def create_company(workflow_id: int, data: dict) -> dict:
    """Create a company in B24 via b24-transfer-lead."""
    url = f"{_get_base_url()}/api/v1/workflows/{workflow_id}/b24/companies"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(url, headers=_get_headers(), json=data)
        resp.raise_for_status()
        return resp.json()


async def get_deals_by_entity(
    workflow_id: int,
    entity_type: str | None = None,
    entity_id: int | None = None,
    field_id: str | None = None,
    field_value: str | None = None,
) -> list[dict]:
    """Get deals filtered by contact/company and/or UF field from B24."""
    url = f"{_get_base_url()}/api/v1/workflows/{workflow_id}/b24/deals"
    params: dict[str, str | int] = {}
    if entity_type is not None:
        params["entity_type"] = entity_type
    if entity_id is not None:
        params["entity_id"] = entity_id
    if field_id is not None:
        params["field_id"] = field_id
    if field_value is not None:
        params["field_value"] = field_value

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(url, headers=_get_headers(), params=params)
        resp.raise_for_status()
        return resp.json()

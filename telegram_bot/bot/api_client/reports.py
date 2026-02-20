from bot.api_client.base import APIClient
from typing import Optional


async def get_report(api: APIClient, date_from: str = "", date_to: str = "") -> Optional[dict]:
    params = {}
    if date_from:
        params["date_from"] = date_from
    if date_to:
        params["date_to"] = date_to
    return await api.get_json("/reports", params=params)


async def get_report_pdf(api: APIClient, date_from: str = "", date_to: str = "") -> Optional[bytes]:
    params = {}
    if date_from:
        params["date_from"] = date_from
    if date_to:
        params["date_to"] = date_to
    return await api.get_bytes("/reports/pdf", params=params)

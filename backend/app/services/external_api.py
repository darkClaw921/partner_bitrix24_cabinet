import logging
from datetime import datetime, timezone

from app.services.b24_integration_service import b24_service

logger = logging.getLogger(__name__)


async def send_client_webhook(
    partner_code: str,
    source: str,
    link_code: str | None,
    client_data: dict,
    workflow_id: int | None = None,
) -> dict:
    if not workflow_id:
        logger.warning("No workflow_id for partner %s, skip lead creation", partner_code)
        return {"error": "Bitrix24 не настроен (нет workflow)"}

    try:
        result = await b24_service.create_lead(
            workflow_id=workflow_id,
            name=client_data.get("name", ""),
            phone=client_data.get("phone", ""),
            extra_fields={
                "email": client_data.get("email"),
                "company": client_data.get("company"),
                "comment": client_data.get("comment"),
                "source": source,
                "link_code": link_code,
                "partner_code": partner_code,
            },
        )
        return result
    except Exception as e:
        logger.error("Webhook send failed for partner %s (workflow %s): %r", partner_code, workflow_id, e)
        return {"error": str(e) or repr(e)}


async def fetch_bitrix_stats(partner_code: str, workflow_id: int | None = None) -> dict:
    if not workflow_id:
        return {"success": False, "error": "Bitrix24 не настроен (нет workflow)"}

    try:
        leads = await b24_service.get_leads(workflow_id)
        conversion = await b24_service.get_conversion_stats(workflow_id)

        # Build status name map from Bitrix24 lead statuses
        status_name_map: dict[str, str] = {}
        try:
            lead_statuses = await b24_service.get_lead_statuses(workflow_id)
            for s in lead_statuses:
                status_name_map[s.get("id", "")] = s.get("name", "")
        except Exception as e:
            logger.warning("Failed to fetch lead statuses for status name resolution: %s", e)

        clients = []
        for lead in leads:
            # Use deal_status_name (human-readable) if available,
            # then try to resolve lead status via status map,
            # otherwise fall back to raw status
            raw_status = lead.get("status", "")
            status_display = (
                lead.get("deal_status_name")
                or status_name_map.get(raw_status)
                or raw_status
            )
            clients.append({
                "name": lead.get("name", ""),
                "external_id": str(lead.get("bitrix24_lead_id") or lead.get("id", "")),
                "status": status_display,
                "stage": status_display,
                "deal_amount": float(lead.get("deal_amount") or 0),
                "currency": "RUB",
                "created_at": lead.get("created_at", ""),
                "assigned_by_name": lead.get("assigned_by_name"),
                "status_semantic_id": lead.get("status_semantic_id"),
            })

        return {
            "success": True,
            "clients": clients,
            "total_amount": 0,
            "total_clients": len(clients),
            "conversion": conversion,
        }
    except Exception as e:
        logger.error("Bitrix stats fetch failed: %s", e)
        return {"success": False, "error": str(e)}


async def check_client_status(
    external_id: str, workflow_id: int | None = None
) -> dict:
    if not workflow_id:
        return {"error": "Bitrix24 не настроен (нет workflow)"}

    try:
        leads = await b24_service.get_leads(workflow_id)
        for lead in leads:
            b24_id = str(lead.get("bitrix24_lead_id") or lead.get("id", ""))
            if b24_id == external_id:
                return {
                    "found": True,
                    "status": lead.get("status"),
                    "status_semantic_id": lead.get("status_semantic_id"),
                }
        return {"found": False}
    except Exception as e:
        logger.error("Client status check failed: %s", e)
        return {"error": str(e)}

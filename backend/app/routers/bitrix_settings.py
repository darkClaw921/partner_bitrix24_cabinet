import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings as get_app_settings
from app.dependencies import get_current_user, get_db
from app.models.partner import Partner
from app.services.b24_integration_service import b24_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bitrix", tags=["Bitrix24 Settings"])


class SettingsUpdateRequest(BaseModel):
    entity_type: str | None = None
    deal_category_id: int | None = None
    deal_stage_id: str | None = None
    lead_status_id: str | None = None


async def _ensure_workflow(
    partner: Partner,
    db: AsyncSession,
) -> None:
    """Create workflow for legacy partners who registered before auto-creation."""
    if partner.workflow_id:
        return

    app_settings = get_app_settings()

    # 1. Create workflow + generate API token (critical)
    workflow = await b24_service.create_workflow(
        name=f"partner-{partner.partner_code}",
        bitrix24_webhook_url=app_settings.B24_WEBHOOK_URL or None,
    )
    workflow_id = workflow["id"]

    token_resp = await b24_service.generate_api_token(workflow_id)

    partner.workflow_id = workflow_id
    partner.b24_api_token = token_resp["api_token"]
    await db.commit()
    await db.refresh(partner)

    # 2. Apply workflow settings (non-fatal)
    try:
        wf_settings: dict = {"entity_type": app_settings.B24_ENTITY_TYPE}
        if app_settings.B24_DEAL_CATEGORY_ID:
            wf_settings["deal_category_id"] = int(app_settings.B24_DEAL_CATEGORY_ID)
        if app_settings.B24_DEAL_STAGE_ID:
            wf_settings["deal_stage_id"] = app_settings.B24_DEAL_STAGE_ID
        if app_settings.B24_LEAD_STATUS_ID:
            wf_settings["lead_status_id"] = app_settings.B24_LEAD_STATUS_ID
        await b24_service.update_settings(workflow_id, wf_settings)
    except Exception as e:
        logger.warning("Failed to apply workflow settings: %s", e)

    # 3. Apply field mappings (non-fatal)
    try:
        mappings = json.loads(app_settings.B24_FIELD_MAPPINGS)
        for mapping in mappings:
            try:
                await b24_service.create_field_mapping(workflow_id, mapping)
            except Exception as e:
                logger.warning("Failed to create field mapping '%s': %s", mapping.get("field_name", "?"), e)
    except json.JSONDecodeError:
        logger.warning("Invalid B24_FIELD_MAPPINGS JSON, skipping")


@router.get("/settings")
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    try:
        await _ensure_workflow(current_user, db)
    except Exception as e:
        logger.error("Failed to ensure workflow for partner %s: %s", current_user.id, e)
        return {"configured": False}

    try:
        settings = await b24_service.get_settings(current_user.workflow_id)
        configured = bool(settings.get("bitrix24_webhook_url"))
        return {"configured": configured, "api_token": current_user.b24_api_token, **settings}
    except Exception as e:
        logger.error("Get settings failed: %s", e)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.put("/settings")
async def update_settings(
    request: SettingsUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Partner = Depends(get_current_user),
):
    try:
        await _ensure_workflow(current_user, db)
    except Exception as e:
        logger.error("Failed to ensure workflow: %s", e)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    try:
        data = request.model_dump(exclude_none=True)
        result = await b24_service.update_settings(current_user.workflow_id, data)
        return result
    except Exception as e:
        logger.error("Update settings failed: %s", e)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.get("/funnels")
async def get_funnels(
    current_user: Partner = Depends(get_current_user),
):
    if not current_user.workflow_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bitrix24 не настроен")

    try:
        return await b24_service.get_funnels(current_user.workflow_id)
    except Exception as e:
        logger.error("Get funnels failed: %s", e)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.get("/stages")
async def get_stages(
    category_id: int = Query(default=0),
    current_user: Partner = Depends(get_current_user),
):
    if not current_user.workflow_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bitrix24 не настроен")

    try:
        return await b24_service.get_stages(current_user.workflow_id, category_id)
    except Exception as e:
        logger.error("Get stages failed: %s", e)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.get("/lead-statuses")
async def get_lead_statuses(
    current_user: Partner = Depends(get_current_user),
):
    if not current_user.workflow_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bitrix24 не настроен")

    try:
        return await b24_service.get_lead_statuses(current_user.workflow_id)
    except Exception as e:
        logger.error("Get lead statuses failed: %s", e)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.get("/leads")
async def get_leads(
    current_user: Partner = Depends(get_current_user),
):
    if not current_user.workflow_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bitrix24 не настроен")

    try:
        return await b24_service.get_leads(current_user.workflow_id)
    except Exception as e:
        logger.error("Get leads failed: %s", e)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.get("/stats")
async def get_stats(
    current_user: Partner = Depends(get_current_user),
):
    if not current_user.workflow_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bitrix24 не настроен")

    try:
        return await b24_service.get_conversion_stats(current_user.workflow_id)
    except Exception as e:
        logger.error("Get stats failed: %s", e)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

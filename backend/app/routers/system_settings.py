import logging

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_admin_user, get_db
from app.models.partner import Partner
from app.services import deal_sync_service, system_settings_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/settings", tags=["Admin Settings"])


# --- Request schemas ---


class TrackingConfigUpdateRequest(BaseModel):
    lead_field: str | None = None
    deal_field: str | None = None
    value_template: str | None = None
    field_type: str | None = None


class SyncConfigUpdateRequest(BaseModel):
    enabled: bool | None = None
    interval_minutes: int | None = None


class DefaultLinkConfig(BaseModel):
    title: str
    url: str
    enabled: bool = True
    utm_source: str | None = None
    utm_medium: str | None = None
    utm_campaign: str | None = None
    utm_content: str | None = None


class DefaultLinksUpdateRequest(BaseModel):
    links: list[DefaultLinkConfig]


# --- Endpoints ---


@router.get("")
async def get_all_settings(
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    """Get all settings (tracking + sync)."""
    settings = await system_settings_service.get_all_settings(db)
    return {"settings": settings}


@router.put("/tracking")
async def update_tracking_config(
    data: TrackingConfigUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    """Update tracking field configuration."""
    field_map = {
        "lead_field": "partner_tracking_lead_field",
        "deal_field": "partner_tracking_deal_field",
        "value_template": "partner_tracking_value_template",
        "field_type": "partner_tracking_field_type",
    }

    for attr_name, setting_key in field_map.items():
        value = getattr(data, attr_name, None)
        if value is not None:
            await system_settings_service.set_setting(db, setting_key, value)

    return {"success": True}


@router.put("/sync")
async def update_sync_config(
    data: SyncConfigUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    """Update sync configuration."""
    if data.enabled is not None:
        await system_settings_service.set_setting(
            db, "b24_sync_enabled", "true" if data.enabled else "false"
        )
    if data.interval_minutes is not None:
        await system_settings_service.set_setting(
            db, "b24_sync_interval_minutes", str(data.interval_minutes)
        )
    return {"success": True}


@router.get("/default-links")
async def get_default_links(
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    """Get default partner links configuration."""
    links = await system_settings_service.get_default_links_config(db)
    return {"links": links}


@router.put("/default-links")
async def update_default_links(
    data: DefaultLinksUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    """Update default partner links configuration."""
    links_dicts = [link.model_dump() for link in data.links]
    await system_settings_service.set_default_links_config(db, links_dicts)
    return {"success": True}


@router.post("/sync/run-now")
async def run_sync_now(
    background_tasks: BackgroundTasks,
    _admin: Partner = Depends(get_admin_user),
):
    """Trigger manual sync cycle in the background."""
    background_tasks.add_task(deal_sync_service.run_sync_cycle)
    return {"success": True, "message": "Sync started"}

import json
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.partner import Partner
from app.models.system_setting import SystemSetting

logger = logging.getLogger(__name__)


async def get_setting(db: AsyncSession, key: str) -> str | None:
    """Get a single setting value by key. Returns None if not found."""
    result = await db.execute(
        select(SystemSetting.value).where(SystemSetting.key == key)
    )
    row = result.scalar_one_or_none()
    return row


async def set_setting(
    db: AsyncSession, key: str, value: str, description: str | None = None
) -> None:
    """Create or update a setting (upsert)."""
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == key)
    )
    existing = result.scalar_one_or_none()

    if existing is not None:
        existing.value = value
        if description is not None:
            existing.description = description
    else:
        setting = SystemSetting(key=key, value=value, description=description)
        db.add(setting)

    await db.commit()


async def get_all_settings(db: AsyncSession) -> dict[str, str]:
    """Get all settings as a {key: value} dictionary."""
    result = await db.execute(select(SystemSetting))
    settings = result.scalars().all()
    return {s.key: s.value for s in settings if s.value is not None}


async def get_tracking_config(db: AsyncSession) -> dict:
    """Return tracking configuration dict with keys: lead_field, deal_field, value_template, field_type."""
    keys = [
        "partner_tracking_lead_field",
        "partner_tracking_deal_field",
        "partner_tracking_value_template",
        "partner_tracking_field_type",
    ]
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key.in_(keys))
    )
    settings = {s.key: s.value for s in result.scalars().all()}

    return {
        "lead_field": settings.get("partner_tracking_lead_field"),
        "deal_field": settings.get("partner_tracking_deal_field"),
        "value_template": settings.get("partner_tracking_value_template"),
        "field_type": settings.get("partner_tracking_field_type"),
    }


async def get_default_links_config(db: AsyncSession) -> list[dict]:
    """Return default partner links list. Empty list if not configured."""
    raw = await get_setting(db, "default_partner_links")
    if not raw:
        return []
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return []


async def set_default_links_config(db: AsyncSession, links: list[dict]) -> None:
    """Save default partner links list as JSON."""
    await set_setting(
        db,
        "default_partner_links",
        json.dumps(links, ensure_ascii=False),
        description="Default links created for new partners on registration approval",
    )


def format_tracking_value(
    template: str, partner: Partner, field_type: str | None = None
) -> str:
    """Format a tracking value template using partner data.

    For field_type='crm_entity', returns raw entity ID (B24 stores numeric IDs).
    For other types, applies the template.

    Supported placeholders:
      {id} -> partner.b24_entity_id
    Examples:
      'C_{id}' -> 'C_123' (for string fields)
      '{id}' -> '123'
      field_type='crm_entity' -> '123' (always raw ID)
    """
    entity_id = str(partner.b24_entity_id or "")

    if field_type == "crm_entity":
        return entity_id

    if not template:
        return entity_id

    return template.replace("{id}", entity_id)

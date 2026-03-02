"""Background sync task: fetches deals from B24 and creates Client records."""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.client import Client
from app.models.partner import Partner
from app.services import b24_entity_service, system_settings_service
from app.services.b24_integration_service import b24_service

logger = logging.getLogger(__name__)

_sync_task: asyncio.Task | None = None


async def sync_deals_for_partner(
    db: AsyncSession,
    partner: Partner,
    tracking_config: dict,
) -> int:
    """Fetch deals from B24 for a partner and create Client records.

    Returns number of new clients created.
    """
    if not partner.workflow_id:
        logger.warning("Partner %s has no workflow_id, skipping sync", partner.id)
        return 0

    deal_field = tracking_config.get("deal_field")
    field_type = tracking_config.get("field_type")
    value_template = tracking_config.get("value_template")

    # Determine filter strategy
    has_uf_field = bool(deal_field and (value_template or partner.b24_entity_id))
    has_entity = bool(partner.b24_entity_id and partner.b24_entity_type)

    if not has_uf_field and not has_entity:
        return 0

    # Build field_value for UF filter
    field_value = None
    if has_uf_field:
        field_value = system_settings_service.format_tracking_value(
            value_template, partner, field_type=field_type
        )

    # When UF tracking field is configured, use it as primary filter (skip entity filter)
    # because CONTACT_ID/COMPANY_ID refers to the deal's customer, not the partner
    try:
        deals = await b24_entity_service.get_deals_by_entity(
            workflow_id=partner.workflow_id,
            entity_type=partner.b24_entity_type if not has_uf_field else None,
            entity_id=partner.b24_entity_id if not has_uf_field else None,
            field_id=deal_field if has_uf_field else None,
            field_value=field_value if has_uf_field else None,
        )
    except Exception as e:
        logger.error("Failed to fetch deals for partner %s: %s", partner.id, e)
        return 0

    created_count = 0
    for deal in deals:
        deal_id_str = str(deal.get("id", ""))
        if not deal_id_str:
            continue

        # Deduplicate by deal_id
        existing = await db.execute(
            select(Client).where(
                Client.partner_id == partner.id,
                Client.deal_id == deal_id_str,
            )
        )
        if existing.scalar_one_or_none():
            continue

        # Also check by external_id for backward compatibility
        existing_ext = await db.execute(
            select(Client).where(
                Client.partner_id == partner.id,
                Client.external_id == deal_id_str,
            )
        )
        if existing_ext.scalar_one_or_none():
            continue

        # Calculate partner reward
        deal_amount = 0.0
        try:
            deal_amount = float(deal.get("opportunity") or 0)
        except (ValueError, TypeError):
            pass

        partner_reward = 0.0
        if deal_amount > 0:
            pct = partner.reward_percentage
            if pct is None:
                pct = get_settings().DEFAULT_REWARD_PERCENTAGE
            partner_reward = round(deal_amount * pct / 100, 2)

        deal_title = deal.get("title") or f"Deal #{deal_id_str}"
        deal_stage = deal.get("stage_id")

        client = Client(
            partner_id=partner.id,
            source="b24_sync",
            name=deal_title,
            deal_id=deal_id_str,
            external_id=deal_id_str,
            deal_amount=deal_amount,
            partner_reward=partner_reward,
            deal_status=deal_stage,
        )
        db.add(client)
        created_count += 1

        # Also create Lead in b24-transfer-lead
        try:
            await b24_service.import_lead(
                workflow_id=partner.workflow_id,
                data={
                    "name": deal_title,
                    "phone": "",
                    "bitrix24_lead_id": deal_id_str,
                    "deal_id": deal_id_str,
                    "deal_amount": str(deal_amount) if deal_amount else None,
                    "deal_status": deal_stage,
                    "status": "PROCESSED",
                },
            )
        except Exception as e:
            logger.warning(
                "Failed to import lead to b24-transfer-lead for deal %s: %s",
                deal_id_str, e,
            )

    if created_count > 0:
        await db.commit()
        logger.info("Synced %d new deals for partner %s", created_count, partner.id)

    return created_count


async def run_sync_cycle() -> dict:
    """Run one sync cycle for all eligible partners.

    Returns dict with sync results summary.
    """
    total_created = 0
    total_partners = 0
    errors = 0

    async with AsyncSessionLocal() as db:
        tracking_config = await system_settings_service.get_tracking_config(db)

        # Get all partners with b24_entity_id
        result = await db.execute(
            select(Partner).where(
                Partner.b24_entity_id.isnot(None),
                Partner.b24_entity_type.isnot(None),
                Partner.is_active == True,  # noqa: E712
            )
        )
        partners = result.scalars().all()

        for partner in partners:
            total_partners += 1
            try:
                created = await sync_deals_for_partner(db, partner, tracking_config)
                total_created += created
            except Exception as e:
                errors += 1
                logger.error("Sync failed for partner %s: %s", partner.id, e)

        # Update last run timestamp
        await system_settings_service.set_setting(
            db,
            "b24_sync_last_run",
            datetime.now(timezone.utc).isoformat(),
        )

    logger.info(
        "Sync cycle complete: %d partners processed, %d deals created, %d errors",
        total_partners,
        total_created,
        errors,
    )
    return {
        "status": "completed",
        "partners": total_partners,
        "created": total_created,
        "errors": errors,
    }


async def sync_loop() -> None:
    """Infinite loop: sleep(interval) then run_sync_cycle()."""
    logger.info("Deal sync loop started")
    while True:
        enabled = None
        interval = 60
        try:
            async with AsyncSessionLocal() as db:
                enabled = await system_settings_service.get_setting(db, "b24_sync_enabled")
                interval_str = await system_settings_service.get_setting(
                    db, "b24_sync_interval_minutes"
                )
            if interval_str:
                interval = int(interval_str)
        except asyncio.CancelledError:
            raise
        except Exception:
            pass

        interval_seconds = max(interval * 60, 60)  # minimum 1 minute
        await asyncio.sleep(interval_seconds)

        if enabled and enabled.lower() == "true":
            try:
                await run_sync_cycle()
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error("Sync loop error: %s", e, exc_info=True)
        else:
            logger.debug("Deal sync is disabled, skipping cycle")


def start_sync_task() -> asyncio.Task:
    """Start the background sync loop as an asyncio task."""
    global _sync_task
    _sync_task = asyncio.create_task(sync_loop(), name="deal_sync_loop")
    logger.info("Deal sync background task started")
    return _sync_task


async def stop_sync_task(task: asyncio.Task | None = None) -> None:
    """Cancel the background sync task."""
    global _sync_task
    t = task or _sync_task
    if t and not t.done():
        t.cancel()
        try:
            await t
        except asyncio.CancelledError:
            pass
    _sync_task = None
    logger.info("Deal sync background task stopped")

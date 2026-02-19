import json
import logging
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.partner import Partner
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.services.b24_integration_service import b24_service
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

logger = logging.getLogger(__name__)


async def register_partner(db: AsyncSession, data: RegisterRequest) -> Partner:
    result = await db.execute(select(Partner).where(Partner.email == data.email))
    existing = result.scalar_one_or_none()

    if existing is not None:
        if existing.approval_status == "rejected":
            # Allow re-registration: reset the rejected partner record
            existing.password_hash = hash_password(data.password)
            existing.name = data.name
            existing.company = data.company
            existing.approval_status = "pending"
            existing.rejection_reason = None
            existing.is_active = False
            await db.commit()
            await db.refresh(existing)
            return existing

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email уже зарегистрирован",
        )

    partner_code = uuid.uuid4().hex[:8]
    partner = Partner(
        email=data.email,
        password_hash=hash_password(data.password),
        name=data.name,
        company=data.company,
        partner_code=partner_code,
        is_active=False,
        approval_status="pending",
    )
    db.add(partner)
    await db.commit()
    await db.refresh(partner)

    return partner


async def create_partner_workflow(db: AsyncSession, partner: Partner) -> None:
    """Create B24 workflow for a partner. Called when registration is approved."""
    try:
        app_settings = get_settings()

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
            logger.warning("Failed to apply workflow settings for partner %s: %s", partner.id, e)

        try:
            mappings = json.loads(app_settings.B24_FIELD_MAPPINGS)
            for mapping in mappings:
                try:
                    await b24_service.create_field_mapping(workflow_id, mapping)
                except Exception as e:
                    logger.warning(
                        "Failed to create field mapping '%s' for partner %s: %s",
                        mapping.get("field_name", "?"), partner.id, e,
                    )
        except json.JSONDecodeError:
            logger.warning("Invalid B24_FIELD_MAPPINGS JSON, skipping")

    except Exception as e:
        logger.error("Failed to create workflow for partner %s: %r", partner.id, e)


async def login_partner(db: AsyncSession, data: LoginRequest) -> TokenResponse:
    result = await db.execute(select(Partner).where(Partner.email == data.email))
    partner = result.scalar_one_or_none()

    if partner is None or not verify_password(data.password, partner.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )

    if partner.approval_status == "pending":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ваша заявка на регистрацию ожидает рассмотрения администратором",
        )

    if partner.approval_status == "rejected":
        reason = partner.rejection_reason or ""
        detail_msg = "Ваша заявка на регистрацию отклонена"
        if reason:
            detail_msg += f". Причина: {reason}"
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail_msg,
        )

    if not partner.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт деактивирован",
        )

    access_token = create_access_token(data={"sub": str(partner.id)})
    refresh_token = create_refresh_token(data={"sub": str(partner.id)})

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


async def refresh_tokens(db: AsyncSession, refresh_token: str) -> TokenResponse:
    payload = decode_token(refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    partner_id = payload.get("sub")
    result = await db.execute(select(Partner).where(Partner.id == int(partner_id)))
    partner = result.scalar_one_or_none()

    if partner is None or not partner.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Partner not found",
        )

    new_access = create_access_token(data={"sub": str(partner.id)})
    new_refresh = create_refresh_token(data={"sub": str(partner.id)})

    return TokenResponse(access_token=new_access, refresh_token=new_refresh)

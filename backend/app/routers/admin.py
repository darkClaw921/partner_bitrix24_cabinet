import logging

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_admin_user, get_db
from app.models.partner import Partner
from app.schemas.admin import (
    AdminConfigResponse,
    AdminOverviewResponse,
    AdminPartnerDetailResponse,
    AdminRegisterPartnerRequest,
    ApproveRegistrationRequest,
    BulkClientPaymentUpdateRequest,
    ClientPaymentUpdateRequest,
    GlobalRewardPercentageResponse,
    GlobalRewardPercentageUpdateRequest,
    PaginatedPartnersResponse,
    PartnerPaymentSummaryResponse,
    PartnerRewardPercentageUpdateRequest,
    RegistrationRequestResponse,
    RejectRegistrationRequest,
)
from app.schemas.notification import NotificationListResponse, NotificationResponse
from app.services import admin_service, auth_service, b24_entity_service, notification_service
from app.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/overview", response_model=AdminOverviewResponse)
async def overview(
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    return await admin_service.get_admin_overview(db)


@router.get("/partners", response_model=PaginatedPartnersResponse)
async def partners_list(
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    return await admin_service.get_partners_stats_paginated(db, search=search, page=page, page_size=page_size)


@router.get("/partners/{partner_id}", response_model=AdminPartnerDetailResponse)
async def partner_detail(
    partner_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    result = await admin_service.get_partner_detail(db, partner_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found")
    return result


@router.put("/clients/bulk-payment")
async def bulk_update_client_payments(
    data: BulkClientPaymentUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    clients = await admin_service.bulk_update_client_payments(db, data)
    return [
        {
            "id": c.id,
            "deal_amount": c.deal_amount,
            "partner_reward": c.partner_reward,
            "is_paid": c.is_paid,
            "paid_at": c.paid_at.isoformat() if c.paid_at else None,
            "payment_comment": c.payment_comment,
        }
        for c in clients
    ]


@router.put("/clients/{client_id}/payment")
async def update_client_payment(
    client_id: int,
    data: ClientPaymentUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    client = await admin_service.update_client_payment(db, client_id, data)
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return {
        "id": client.id,
        "deal_amount": client.deal_amount,
        "partner_reward": client.partner_reward,
        "is_paid": client.is_paid,
        "paid_at": client.paid_at.isoformat() if client.paid_at else None,
        "payment_comment": client.payment_comment,
    }


@router.get("/partners/{partner_id}/payments", response_model=PartnerPaymentSummaryResponse)
async def partner_payments(
    partner_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    result = await admin_service.get_partner_payment_summary(db, partner_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found")
    return result


@router.get("/registrations", response_model=list[RegistrationRequestResponse])
async def pending_registrations(
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    return await admin_service.get_pending_registrations(db)


@router.get("/registrations/count")
async def pending_registrations_count(
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    count = await admin_service.get_pending_registrations_count(db)
    return {"count": count}


@router.post("/registrations/{partner_id}/approve")
async def approve_registration(
    partner_id: int,
    data: ApproveRegistrationRequest | None = Body(default=None),
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    partner = await admin_service.approve_registration(
        db,
        partner_id,
        b24_entity_type=data.b24_entity_type if data else None,
        b24_entity_id=data.b24_entity_id if data else None,
        b24_entity_name=data.b24_entity_name if data else None,
    )
    return {"ok": True, "partner_id": partner.id}


@router.post("/registrations/{partner_id}/reject")
async def reject_registration(
    partner_id: int,
    data: RejectRegistrationRequest | None = None,
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    reason = data.rejection_reason if data else None
    partner = await admin_service.reject_registration(db, partner_id, reason)
    return {"ok": True, "partner_id": partner.id}


@router.get("/config", response_model=AdminConfigResponse)
async def admin_config(
    _admin: Partner = Depends(get_admin_user),
):
    settings = get_settings()
    return AdminConfigResponse(
        b24_service_frontend_url=settings.B24_SERVICE_FRONTEND_URL,
        default_reward_percentage=settings.DEFAULT_REWARD_PERCENTAGE,
    )


@router.get("/reward-percentage", response_model=GlobalRewardPercentageResponse)
async def get_global_reward_percentage(
    _admin: Partner = Depends(get_admin_user),
):
    settings = get_settings()
    return GlobalRewardPercentageResponse(
        default_reward_percentage=settings.DEFAULT_REWARD_PERCENTAGE,
    )


@router.put("/reward-percentage", response_model=GlobalRewardPercentageResponse)
async def update_global_reward_percentage(
    data: GlobalRewardPercentageUpdateRequest,
    _admin: Partner = Depends(get_admin_user),
):
    settings = get_settings()
    settings.DEFAULT_REWARD_PERCENTAGE = data.default_reward_percentage
    return GlobalRewardPercentageResponse(
        default_reward_percentage=settings.DEFAULT_REWARD_PERCENTAGE,
    )


@router.put("/partners/{partner_id}/reward-percentage")
async def update_partner_reward_percentage(
    partner_id: int,
    data: PartnerRewardPercentageUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    partner = await admin_service.update_partner_reward_percentage(db, partner_id, data.reward_percentage)
    if partner is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found")
    return {
        "id": partner.id,
        "reward_percentage": partner.reward_percentage,
        "effective_reward_percentage": data.reward_percentage if data.reward_percentage is not None else get_settings().DEFAULT_REWARD_PERCENTAGE,
    }


@router.put("/partners/{partner_id}/toggle-active")
async def toggle_partner_active(
    partner_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Partner = Depends(get_admin_user),
):
    partner = await admin_service.toggle_partner_active(db, partner_id, admin.id)
    return {"ok": True, "id": partner.id, "is_active": partner.is_active}


@router.post("/notifications", response_model=NotificationResponse)
async def create_notification(
    title: str = Form(...),
    message: str = Form(...),
    file: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    admin: Partner = Depends(get_admin_user),
):
    return await notification_service.create_notification(
        db, title=title, message=message, admin_id=admin.id, file=file,
    )


@router.get("/notifications", response_model=NotificationListResponse)
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    notifications = await notification_service.get_all_notifications(db)
    return NotificationListResponse(notifications=notifications)


@router.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    deleted = await notification_service.delete_notification(db, notification_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return {"ok": True}


# --- Admin register partner ---


@router.post("/partners/register")
async def admin_register_partner(
    data: AdminRegisterPartnerRequest,
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    """Admin creates a new partner manually."""
    partner = await auth_service.admin_register_partner(
        db,
        name=data.name,
        email=data.email,
        password=data.password,
        company=data.company,
    )
    return {
        "id": partner.id,
        "name": partner.name,
        "email": partner.email,
        "approval_status": partner.approval_status,
    }


# --- B24 proxy endpoints ---


async def _get_any_workflow_id(db: AsyncSession) -> int:
    """Get any available workflow_id for B24 proxy requests."""
    result = await db.execute(
        select(Partner.workflow_id).where(
            Partner.workflow_id.isnot(None),
            Partner.is_active == True,  # noqa: E712
        ).limit(1)
    )
    workflow_id = result.scalar_one_or_none()
    if not workflow_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active workflow available for B24 operations",
        )
    return workflow_id


class CreateContactRequest(BaseModel):
    name: str
    last_name: str | None = None
    phone: str | None = None
    email: str | None = None


class CreateCompanyRequest(BaseModel):
    title: str
    phone: str | None = None
    email: str | None = None


@router.get("/b24/contacts/search")
async def search_b24_contacts(
    query: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    """Search contacts in B24 (proxy to b24-transfer-lead)."""
    workflow_id = await _get_any_workflow_id(db)
    return await b24_entity_service.search_contacts(workflow_id, query)


@router.get("/b24/companies/search")
async def search_b24_companies(
    query: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    """Search companies in B24 (proxy to b24-transfer-lead)."""
    workflow_id = await _get_any_workflow_id(db)
    return await b24_entity_service.search_companies(workflow_id, query)


@router.post("/b24/contacts")
async def create_b24_contact(
    data: CreateContactRequest,
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    """Create a contact in B24 (proxy to b24-transfer-lead)."""
    workflow_id = await _get_any_workflow_id(db)
    return await b24_entity_service.create_contact(
        workflow_id,
        {
            "name": data.name,
            "last_name": data.last_name,
            "phone": data.phone,
            "email": data.email,
        },
    )


@router.post("/b24/companies")
async def create_b24_company(
    data: CreateCompanyRequest,
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    """Create a company in B24 (proxy to b24-transfer-lead)."""
    workflow_id = await _get_any_workflow_id(db)
    return await b24_entity_service.create_company(
        workflow_id,
        {
            "title": data.title,
            "phone": data.phone,
            "email": data.email,
        },
    )

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_admin_user, get_db
from app.models.partner import Partner
from app.schemas.admin import (
    AdminConfigResponse,
    AdminOverviewResponse,
    AdminPartnerDetailResponse,
    BulkClientPaymentUpdateRequest,
    ClientPaymentUpdateRequest,
    GlobalRewardPercentageResponse,
    GlobalRewardPercentageUpdateRequest,
    PartnerPaymentSummaryResponse,
    PartnerRewardPercentageUpdateRequest,
    RegistrationRequestResponse,
    RejectRegistrationRequest,
)
from app.schemas.notification import NotificationCreateRequest, NotificationListResponse, NotificationResponse
from app.services import admin_service, notification_service
from app.config import get_settings

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/overview", response_model=AdminOverviewResponse)
async def overview(
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    return await admin_service.get_admin_overview(db)


@router.get("/partners", response_model=list)
async def partners_list(
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    return await admin_service.get_partners_stats(db)


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
    db: AsyncSession = Depends(get_db),
    _admin: Partner = Depends(get_admin_user),
):
    partner = await admin_service.approve_registration(db, partner_id)
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


@router.post("/notifications", response_model=NotificationResponse)
async def create_notification(
    data: NotificationCreateRequest,
    db: AsyncSession = Depends(get_db),
    admin: Partner = Depends(get_admin_user),
):
    return await notification_service.create_notification(db, data, admin.id)


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

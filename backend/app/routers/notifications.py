from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.partner import Partner
from app.schemas.notification import PartnerNotificationListResponse, UnreadCountResponse
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/", response_model=PartnerNotificationListResponse)
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    user: Partner = Depends(get_current_user),
):
    notifications = await notification_service.get_partner_notifications(db, user.id)
    return PartnerNotificationListResponse(notifications=notifications)


@router.get("/unread-count", response_model=UnreadCountResponse)
async def unread_count(
    db: AsyncSession = Depends(get_db),
    user: Partner = Depends(get_current_user),
):
    count = await notification_service.get_unread_count(db, user.id)
    return UnreadCountResponse(count=count)


@router.post("/{notification_id}/read")
async def read_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    user: Partner = Depends(get_current_user),
):
    success = await notification_service.mark_as_read(db, notification_id, user.id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return {"ok": True}


@router.post("/read-all")
async def read_all_notifications(
    db: AsyncSession = Depends(get_db),
    user: Partner = Depends(get_current_user),
):
    await notification_service.mark_all_as_read(db, user.id)
    return {"ok": True}

from datetime import datetime

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationRead
from app.schemas.notification import (
    NotificationCreateRequest,
    NotificationResponse,
    PartnerNotificationResponse,
)


async def create_notification(
    db: AsyncSession, data: NotificationCreateRequest, admin_id: int
) -> NotificationResponse:
    notification = Notification(
        title=data.title,
        message=data.message,
        created_by=admin_id,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return NotificationResponse.model_validate(notification)


async def get_all_notifications(db: AsyncSession) -> list[NotificationResponse]:
    result = await db.execute(select(Notification).order_by(Notification.created_at.desc()))
    notifications = result.scalars().all()
    return [NotificationResponse.model_validate(n) for n in notifications]


async def delete_notification(db: AsyncSession, notification_id: int) -> bool:
    result = await db.execute(select(Notification).where(Notification.id == notification_id))
    notification = result.scalar_one_or_none()
    if not notification:
        return False
    await db.execute(delete(NotificationRead).where(NotificationRead.notification_id == notification_id))
    await db.delete(notification)
    await db.commit()
    return True


async def get_partner_notifications(
    db: AsyncSession, partner_id: int
) -> list[PartnerNotificationResponse]:
    result = await db.execute(
        select(Notification)
        .where(
            or_(
                Notification.target_partner_id == None,  # noqa: E711
                Notification.target_partner_id == partner_id,
            )
        )
        .order_by(Notification.created_at.desc())
    )
    notifications = result.scalars().all()

    read_ids_result = await db.execute(
        select(NotificationRead.notification_id).where(NotificationRead.partner_id == partner_id)
    )
    read_ids = {row[0] for row in read_ids_result.all()}

    return [
        PartnerNotificationResponse(
            id=n.id,
            title=n.title,
            message=n.message,
            created_at=n.created_at,
            is_read=n.id in read_ids,
        )
        for n in notifications
    ]


async def get_unread_count(db: AsyncSession, partner_id: int) -> int:
    read_sq = (
        select(NotificationRead.notification_id)
        .where(NotificationRead.partner_id == partner_id)
    )
    count = (await db.execute(
        select(func.count(Notification.id)).where(
            Notification.id.notin_(read_sq),
            or_(
                Notification.target_partner_id == None,  # noqa: E711
                Notification.target_partner_id == partner_id,
            ),
        )
    )).scalar() or 0
    return count


async def mark_as_read(db: AsyncSession, notification_id: int, partner_id: int) -> bool:
    # Check notification exists
    result = await db.execute(select(Notification).where(Notification.id == notification_id))
    if not result.scalar_one_or_none():
        return False

    # Check if already read
    existing = await db.execute(
        select(NotificationRead).where(
            NotificationRead.notification_id == notification_id,
            NotificationRead.partner_id == partner_id,
        )
    )
    if existing.scalar_one_or_none():
        return True

    read_record = NotificationRead(
        notification_id=notification_id,
        partner_id=partner_id,
    )
    db.add(read_record)
    await db.commit()
    return True


async def mark_all_as_read(db: AsyncSession, partner_id: int) -> None:
    # Get all unread notification ids
    read_sq = (
        select(NotificationRead.notification_id)
        .where(NotificationRead.partner_id == partner_id)
    )
    result = await db.execute(
        select(Notification.id).where(Notification.id.notin_(read_sq))
    )
    unread_ids = [row[0] for row in result.all()]

    for nid in unread_ids:
        db.add(NotificationRead(notification_id=nid, partner_id=partner_id))

    if unread_ids:
        await db.commit()

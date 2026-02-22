import os
import uuid
from datetime import datetime

from fastapi import UploadFile
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.notification import Notification, NotificationRead
from app.schemas.notification import (
    NotificationResponse,
    PartnerNotificationResponse,
)

ALLOWED_EXTENSIONS = {
    "jpg", "jpeg", "png", "gif", "webp",
    "mp4", "mov", "avi",
    "pdf", "doc", "docx", "xls", "xlsx", "csv", "txt",
}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


def _file_url(file_path: str | None) -> str | None:
    if not file_path:
        return None
    return f"/uploads/{file_path}"


async def _save_notification_upload(file: UploadFile) -> tuple[str, str]:
    """Save uploaded file, return (relative_path, original_name)."""
    original_name = file.filename or "file"
    ext = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"File type .{ext} is not allowed")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise ValueError("File is too large (max 50MB)")

    settings = get_settings()
    rel_dir = "notifications"
    abs_dir = os.path.join(settings.UPLOAD_DIR, rel_dir)
    os.makedirs(abs_dir, exist_ok=True)

    unique_name = f"{uuid.uuid4().hex}.{ext}"
    rel_path = f"{rel_dir}/{unique_name}"
    abs_path = os.path.join(settings.UPLOAD_DIR, rel_path)

    with open(abs_path, "wb") as f:
        f.write(content)

    return rel_path, original_name


async def create_notification(
    db: AsyncSession,
    title: str,
    message: str,
    admin_id: int,
    target_partner_id: int | None = None,
    file: UploadFile | None = None,
) -> NotificationResponse:
    file_path = None
    file_name = None
    if file and file.filename:
        file_path, file_name = await _save_notification_upload(file)

    notification = Notification(
        title=title,
        message=message,
        created_by=admin_id,
        target_partner_id=target_partner_id,
        file_path=file_path,
        file_name=file_name,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)

    return NotificationResponse(
        id=notification.id,
        title=notification.title,
        message=notification.message,
        created_by=notification.created_by,
        created_at=notification.created_at,
        file_url=_file_url(notification.file_path),
        file_name=notification.file_name,
    )


async def get_all_notifications(db: AsyncSession) -> list[NotificationResponse]:
    result = await db.execute(select(Notification).order_by(Notification.created_at.desc()))
    notifications = result.scalars().all()
    return [
        NotificationResponse(
            id=n.id,
            title=n.title,
            message=n.message,
            created_by=n.created_by,
            created_at=n.created_at,
            file_url=_file_url(n.file_path),
            file_name=n.file_name,
        )
        for n in notifications
    ]


async def delete_notification(db: AsyncSession, notification_id: int) -> bool:
    result = await db.execute(select(Notification).where(Notification.id == notification_id))
    notification = result.scalar_one_or_none()
    if not notification:
        return False

    # Delete file from disk
    if notification.file_path:
        settings = get_settings()
        abs_path = os.path.join(settings.UPLOAD_DIR, notification.file_path)
        if os.path.exists(abs_path):
            os.remove(abs_path)

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
            file_url=_file_url(n.file_path),
            file_name=n.file_name,
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

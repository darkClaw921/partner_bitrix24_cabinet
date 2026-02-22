import os
import uuid
from datetime import datetime

from fastapi import HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.chat_message import ChatMessage
from app.models.partner import Partner
from app.schemas.chat import ChatConversationPreview, ChatMessageResponse

ALLOWED_EXTENSIONS = {
    "jpg", "jpeg", "png", "gif", "webp",
    "pdf", "doc", "docx", "xls", "xlsx", "csv", "txt",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _build_message_response(msg: ChatMessage, sender: Partner) -> ChatMessageResponse:
    file_url = f"/uploads/{msg.file_path}" if msg.file_path else None
    return ChatMessageResponse(
        id=msg.id,
        partner_id=msg.partner_id,
        sender_id=msg.sender_id,
        sender_name=sender.name,
        is_from_admin=sender.role == "admin",
        message=msg.message,
        file_url=file_url,
        file_name=msg.file_name,
        is_read=msg.is_read,
        created_at=msg.created_at,
    )


async def _save_upload(file: UploadFile, partner_id: int) -> tuple[str, str]:
    """Validate and save uploaded file. Returns (relative_path, original_name)."""
    original_name = file.filename or "file"
    ext = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Недопустимый формат файла. Разрешены: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, "Файл слишком большой. Максимум 10 МБ.")

    settings = get_settings()
    rel_dir = f"chat/{partner_id}"
    full_dir = os.path.join(settings.UPLOAD_DIR, rel_dir)
    os.makedirs(full_dir, exist_ok=True)

    unique_name = f"{uuid.uuid4().hex}.{ext}"
    rel_path = f"{rel_dir}/{unique_name}"
    full_path = os.path.join(settings.UPLOAD_DIR, rel_path)

    with open(full_path, "wb") as f:
        f.write(content)

    return rel_path, original_name


# ── Partner methods ──


async def send_message_partner(
    db: AsyncSession, partner_id: int, message: str
) -> ChatMessageResponse:
    msg = ChatMessage(
        partner_id=partner_id,
        sender_id=partner_id,
        message=message,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    sender = (await db.execute(select(Partner).where(Partner.id == partner_id))).scalar_one()
    return _build_message_response(msg, sender)


async def get_partner_messages(
    db: AsyncSession, partner_id: int
) -> list[ChatMessageResponse]:
    result = await db.execute(
        select(ChatMessage, Partner)
        .join(Partner, Partner.id == ChatMessage.sender_id)
        .where(ChatMessage.partner_id == partner_id)
        .order_by(ChatMessage.created_at.asc())
    )
    return [_build_message_response(msg, sender) for msg, sender in result.all()]


async def get_partner_unread_count(db: AsyncSession, partner_id: int) -> int:
    # Count messages in partner's conversation that are from admin and unread
    count = (
        await db.execute(
            select(func.count(ChatMessage.id)).where(
                ChatMessage.partner_id == partner_id,
                ChatMessage.sender_id != partner_id,
                ChatMessage.is_read == False,  # noqa: E712
            )
        )
    ).scalar() or 0
    return count


async def send_message_with_file_partner(
    db: AsyncSession, partner_id: int, file: UploadFile, message: str = "",
) -> ChatMessageResponse:
    rel_path, original_name = await _save_upload(file, partner_id)
    msg = ChatMessage(
        partner_id=partner_id,
        sender_id=partner_id,
        message=message or "",
        file_path=rel_path,
        file_name=original_name,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    sender = (await db.execute(select(Partner).where(Partner.id == partner_id))).scalar_one()
    return _build_message_response(msg, sender)


async def mark_partner_messages_read(db: AsyncSession, partner_id: int) -> None:
    # Mark messages from admin as read in this partner's conversation
    result = await db.execute(
        select(ChatMessage).where(
            ChatMessage.partner_id == partner_id,
            ChatMessage.sender_id != partner_id,
            ChatMessage.is_read == False,  # noqa: E712
        )
    )
    messages = result.scalars().all()
    for msg in messages:
        msg.is_read = True
    if messages:
        await db.commit()


# ── Admin methods ──


async def get_conversations(db: AsyncSession) -> list[ChatConversationPreview]:
    # Get all partner_ids that have at least one chat message
    partner_ids_result = await db.execute(
        select(ChatMessage.partner_id).distinct()
    )
    partner_ids = [row[0] for row in partner_ids_result.all()]

    if not partner_ids:
        return []

    conversations = []
    for pid in partner_ids:
        partner = (
            await db.execute(select(Partner).where(Partner.id == pid))
        ).scalar_one_or_none()
        if not partner:
            continue

        # Last message
        last_msg = (
            await db.execute(
                select(ChatMessage)
                .where(ChatMessage.partner_id == pid)
                .order_by(ChatMessage.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

        if not last_msg:
            continue

        # Unread count (messages from partner, not read by admin)
        unread = (
            await db.execute(
                select(func.count(ChatMessage.id)).where(
                    ChatMessage.partner_id == pid,
                    ChatMessage.sender_id == pid,
                    ChatMessage.is_read == False,  # noqa: E712
                )
            )
        ).scalar() or 0

        preview_text = last_msg.message
        if len(preview_text) > 100:
            preview_text = preview_text[:100] + "..."

        conversations.append(
            ChatConversationPreview(
                partner_id=pid,
                partner_name=partner.name,
                partner_email=partner.email,
                last_message=preview_text,
                last_message_at=last_msg.created_at,
                unread_count=unread,
            )
        )

    conversations.sort(key=lambda c: c.last_message_at, reverse=True)
    return conversations


async def get_conversation_messages(
    db: AsyncSession, partner_id: int
) -> list[ChatMessageResponse]:
    result = await db.execute(
        select(ChatMessage, Partner)
        .join(Partner, Partner.id == ChatMessage.sender_id)
        .where(ChatMessage.partner_id == partner_id)
        .order_by(ChatMessage.created_at.asc())
    )
    return [_build_message_response(msg, sender) for msg, sender in result.all()]


async def send_message_admin(
    db: AsyncSession, partner_id: int, admin_id: int, message: str
) -> ChatMessageResponse:
    msg = ChatMessage(
        partner_id=partner_id,
        sender_id=admin_id,
        message=message,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    sender = (await db.execute(select(Partner).where(Partner.id == admin_id))).scalar_one()
    return _build_message_response(msg, sender)


async def get_admin_total_unread_count(db: AsyncSession) -> int:
    # All messages sent by partners (sender_id == partner_id) that are unread
    count = (
        await db.execute(
            select(func.count(ChatMessage.id)).where(
                ChatMessage.sender_id == ChatMessage.partner_id,
                ChatMessage.is_read == False,  # noqa: E712
            )
        )
    ).scalar() or 0
    return count


async def send_message_with_file_admin(
    db: AsyncSession, partner_id: int, admin_id: int, file: UploadFile, message: str = "",
) -> ChatMessageResponse:
    rel_path, original_name = await _save_upload(file, partner_id)
    msg = ChatMessage(
        partner_id=partner_id,
        sender_id=admin_id,
        message=message or "",
        file_path=rel_path,
        file_name=original_name,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    sender = (await db.execute(select(Partner).where(Partner.id == admin_id))).scalar_one()
    return _build_message_response(msg, sender)


async def mark_admin_messages_read(db: AsyncSession, partner_id: int) -> None:
    # Mark messages from this partner as read (for admin)
    result = await db.execute(
        select(ChatMessage).where(
            ChatMessage.partner_id == partner_id,
            ChatMessage.sender_id == partner_id,
            ChatMessage.is_read == False,  # noqa: E712
        )
    )
    messages = result.scalars().all()
    for msg in messages:
        msg.is_read = True
    if messages:
        await db.commit()

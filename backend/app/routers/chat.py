from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_admin_user, get_current_user, get_db
from app.models.partner import Partner
from app.schemas.chat import ChatMessageResponse, ChatMessageSend, ChatConversationPreview, ChatUnreadCountResponse
from app.services import chat_service

router = APIRouter(tags=["chat"])


# ── Partner endpoints ──


@router.get("/chat/messages", response_model=list[ChatMessageResponse])
async def get_partner_messages(
    db: AsyncSession = Depends(get_db),
    user: Partner = Depends(get_current_user),
):
    return await chat_service.get_partner_messages(db, user.id)


@router.post("/chat/messages", response_model=ChatMessageResponse)
async def send_partner_message(
    data: ChatMessageSend,
    db: AsyncSession = Depends(get_db),
    user: Partner = Depends(get_current_user),
):
    return await chat_service.send_message_partner(db, user.id, data.message)


@router.get("/chat/unread-count", response_model=ChatUnreadCountResponse)
async def get_partner_unread_count(
    db: AsyncSession = Depends(get_db),
    user: Partner = Depends(get_current_user),
):
    count = await chat_service.get_partner_unread_count(db, user.id)
    return ChatUnreadCountResponse(count=count)


@router.post("/chat/read")
async def mark_partner_messages_read(
    db: AsyncSession = Depends(get_db),
    user: Partner = Depends(get_current_user),
):
    await chat_service.mark_partner_messages_read(db, user.id)
    return {"ok": True}


# ── Admin endpoints ──


@router.get("/admin/chat/conversations", response_model=list[ChatConversationPreview])
async def get_conversations(
    db: AsyncSession = Depends(get_db),
    admin: Partner = Depends(get_admin_user),
):
    return await chat_service.get_conversations(db)


@router.get("/admin/chat/conversations/{partner_id}/messages", response_model=list[ChatMessageResponse])
async def get_conversation_messages(
    partner_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Partner = Depends(get_admin_user),
):
    return await chat_service.get_conversation_messages(db, partner_id)


@router.post("/admin/chat/conversations/{partner_id}/messages", response_model=ChatMessageResponse)
async def send_admin_message(
    partner_id: int,
    data: ChatMessageSend,
    db: AsyncSession = Depends(get_db),
    admin: Partner = Depends(get_admin_user),
):
    return await chat_service.send_message_admin(db, partner_id, admin.id, data.message)


@router.get("/admin/chat/unread-count", response_model=ChatUnreadCountResponse)
async def get_admin_unread_count(
    db: AsyncSession = Depends(get_db),
    admin: Partner = Depends(get_admin_user),
):
    count = await chat_service.get_admin_total_unread_count(db)
    return ChatUnreadCountResponse(count=count)


@router.post("/admin/chat/conversations/{partner_id}/read")
async def mark_admin_messages_read(
    partner_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Partner = Depends(get_admin_user),
):
    await chat_service.mark_admin_messages_read(db, partner_id)
    return {"ok": True}

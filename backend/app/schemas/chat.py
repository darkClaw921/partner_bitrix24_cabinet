from datetime import datetime

from pydantic import BaseModel, Field


class ChatMessageSend(BaseModel):
    message: str = Field(min_length=1, max_length=5000)


class ChatMessageResponse(BaseModel):
    id: int
    partner_id: int
    sender_id: int
    sender_name: str
    is_from_admin: bool
    message: str
    file_url: str | None = None
    file_name: str | None = None
    is_read: bool
    created_at: datetime


class ChatConversationPreview(BaseModel):
    partner_id: int
    partner_name: str
    partner_email: str
    last_message: str
    last_message_at: datetime
    unread_count: int


class ChatUnreadCountResponse(BaseModel):
    count: int

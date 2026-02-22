from datetime import datetime

from pydantic import BaseModel, Field


class NotificationCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    message: str = Field(min_length=1)


class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    created_by: int
    created_at: datetime
    file_url: str | None = None
    file_name: str | None = None

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]


class PartnerNotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    created_at: datetime
    is_read: bool = False
    file_url: str | None = None
    file_name: str | None = None


class PartnerNotificationListResponse(BaseModel):
    notifications: list[PartnerNotificationResponse]


class UnreadCountResponse(BaseModel):
    count: int

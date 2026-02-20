from datetime import datetime

from pydantic import BaseModel, Field


class PaymentRequestCreate(BaseModel):
    client_ids: list[int] = Field(min_length=1)
    comment: str | None = None
    payment_details: str | None = None


class PaymentRequestResponse(BaseModel):
    id: int
    partner_id: int
    partner_name: str | None = None
    status: str
    total_amount: float
    client_ids: list[int]
    clients_summary: list[dict] = []
    comment: str | None = None
    payment_details: str | None = None
    admin_comment: str | None = None
    created_at: datetime
    processed_at: datetime | None = None
    processed_by: int | None = None


class PaymentRequestAdminAction(BaseModel):
    status: str = Field(pattern="^(approved|rejected)$")
    admin_comment: str | None = None


class PendingCountResponse(BaseModel):
    count: int

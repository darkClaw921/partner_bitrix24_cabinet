from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, model_validator


class ClientCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    phone: str | None = None
    email: EmailStr | None = None
    company: str | None = None
    comment: str | None = None
    link_id: int | None = None

    @model_validator(mode="after")
    def check_contact(self):
        if not self.phone and not self.email:
            raise ValueError("Укажите телефон или email")
        return self


class ClientResponse(BaseModel):
    id: int
    partner_id: int
    link_id: int | None
    source: str
    name: str
    phone: str | None
    email: str | None
    company: str | None
    comment: str | None
    external_id: str | None
    webhook_sent: bool
    deal_amount: float | None = None
    partner_reward: float | None = None
    is_paid: bool = False
    deal_status: str | None = None
    deal_status_name: str | None = None
    created_at: datetime
    link_title: str | None = None

    model_config = {"from_attributes": True}


class PublicFormRequest(BaseModel):
    name: str = Field(min_length=1)
    phone: str | None = None
    email: str | None = None
    company: str | None = None
    comment: str | None = None

    @model_validator(mode="after")
    def check_contact(self):
        if not self.phone and not self.email:
            raise ValueError("Укажите телефон или email")
        return self

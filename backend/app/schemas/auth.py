from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)
    company: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class PartnerResponse(BaseModel):
    id: int
    email: str
    name: str
    company: str | None
    partner_code: str
    role: str = "partner"
    created_at: datetime
    is_active: bool

    model_config = {"from_attributes": True}

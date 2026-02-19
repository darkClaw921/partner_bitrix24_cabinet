from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class LinkCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    link_type: Literal["direct", "iframe", "landing"]
    target_url: str | None = None
    landing_id: int | None = None
    utm_source: str | None = None
    utm_medium: str | None = None
    utm_campaign: str | None = None
    utm_content: str | None = None
    utm_term: str | None = None

    @model_validator(mode="after")
    def validate_type_fields(self):
        if self.link_type == "direct" and not self.target_url:
            raise ValueError("target_url обязателен для типа direct")
        if self.link_type == "landing" and not self.landing_id:
            raise ValueError("landing_id обязателен для типа landing")
        return self


class LinkUpdateRequest(BaseModel):
    title: str | None = None
    target_url: str | None = None
    landing_id: int | None = None
    is_active: bool | None = None
    utm_source: str | None = None
    utm_medium: str | None = None
    utm_campaign: str | None = None
    utm_content: str | None = None
    utm_term: str | None = None


class LinkResponse(BaseModel):
    id: int
    partner_id: int
    title: str
    link_type: str
    link_code: str
    target_url: str | None
    landing_id: int | None
    is_active: bool
    created_at: datetime
    clicks_count: int = 0
    clients_count: int = 0
    utm_source: str | None = None
    utm_medium: str | None = None
    utm_campaign: str | None = None
    utm_content: str | None = None
    utm_term: str | None = None

    model_config = {"from_attributes": True}


class EmbedCodeResponse(BaseModel):
    link_type: str
    link_code: str
    direct_url: str
    redirect_url_with_utm: str | None = None
    iframe_code: str | None = None
    landing_url: str | None = None

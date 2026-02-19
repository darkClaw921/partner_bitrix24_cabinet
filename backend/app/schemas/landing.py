from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class LandingCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    header_text: str = Field(min_length=1, max_length=255)
    button_text: str = "Оставить заявку"
    theme_color: str = "#1a73e8"

    @field_validator("theme_color")
    @classmethod
    def validate_color(cls, v: str) -> str:
        import re

        if not re.match(r"^#[0-9a-fA-F]{6}$", v):
            raise ValueError("Цвет должен быть в формате #RRGGBB")
        return v


class LandingUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    header_text: str | None = None
    button_text: str | None = None
    theme_color: str | None = None
    is_active: bool | None = None

    @field_validator("theme_color")
    @classmethod
    def validate_color(cls, v: str | None) -> str | None:
        if v is None:
            return v
        import re

        if not re.match(r"^#[0-9a-fA-F]{6}$", v):
            raise ValueError("Цвет должен быть в формате #RRGGBB")
        return v


class LandingImageResponse(BaseModel):
    id: int
    file_path: str
    sort_order: int
    url: str = ""

    model_config = {"from_attributes": True}

    @classmethod
    def from_model(cls, image) -> "LandingImageResponse":
        return cls(
            id=image.id,
            file_path=image.file_path,
            sort_order=image.sort_order,
            url=f"/uploads/{image.file_path}",
        )


class LandingResponse(BaseModel):
    id: int
    partner_id: int
    title: str
    description: str
    header_text: str
    button_text: str
    theme_color: str
    is_active: bool
    created_at: datetime
    images: list[LandingImageResponse] = []

    model_config = {"from_attributes": True}

    @classmethod
    def from_model(cls, landing) -> "LandingResponse":
        return cls(
            id=landing.id,
            partner_id=landing.partner_id,
            title=landing.title,
            description=landing.description,
            header_text=landing.header_text,
            button_text=landing.button_text,
            theme_color=landing.theme_color,
            is_active=landing.is_active,
            created_at=landing.created_at,
            images=[LandingImageResponse.from_model(img) for img in landing.images],
        )

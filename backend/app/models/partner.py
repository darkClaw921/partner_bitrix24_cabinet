import json
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Partner(Base):
    __tablename__ = "partners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    partner_code: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True, default=lambda: uuid.uuid4().hex[:8]
    )
    role: Mapped[str] = mapped_column(String(20), default="partner")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    approval_status: Mapped[str] = mapped_column(String(20), default="pending")
    rejection_reason: Mapped[str | None] = mapped_column(String(1000), nullable=True, default=None)

    # Reward percentage (None = use global default)
    reward_percentage: Mapped[float | None] = mapped_column(Float, nullable=True, default=None)

    # Saved payment methods (JSON array: [{"id":"...", "label":"...", "value":"..."}])
    payment_details: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    @property
    def saved_payment_methods(self) -> list[dict]:
        if not self.payment_details:
            return []
        try:
            data = json.loads(self.payment_details)
            return data if isinstance(data, list) else []
        except (json.JSONDecodeError, TypeError):
            return []

    @saved_payment_methods.setter
    def saved_payment_methods(self, value: list[dict]) -> None:
        self.payment_details = json.dumps(value, ensure_ascii=False) if value else None

    # b24-transfer-lead integration
    workflow_id: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    b24_api_token: Mapped[str | None] = mapped_column(String(255), nullable=True, default=None)

    links = relationship("PartnerLink", back_populates="partner", lazy="selectin")
    clients = relationship("Client", back_populates="partner", lazy="selectin")
    landings = relationship("LandingPage", back_populates="partner", lazy="selectin")

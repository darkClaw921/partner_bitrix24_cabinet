from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    partner_id: Mapped[int] = mapped_column(Integer, ForeignKey("partners.id"), nullable=False)
    link_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("partner_links.id"), nullable=True
    )
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    webhook_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    webhook_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    deal_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    partner_reward: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    payment_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    deal_status: Mapped[str | None] = mapped_column(String(100), nullable=True)
    deal_status_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    partner = relationship("Partner", back_populates="clients")
    link = relationship("PartnerLink", back_populates="clients")

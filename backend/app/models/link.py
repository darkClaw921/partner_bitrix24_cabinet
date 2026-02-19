import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PartnerLink(Base):
    __tablename__ = "partner_links"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    partner_id: Mapped[int] = mapped_column(Integer, ForeignKey("partners.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    link_type: Mapped[str] = mapped_column(String(20), nullable=False)
    link_code: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True, default=lambda: uuid.uuid4().hex[:10]
    )
    target_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    landing_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("landing_pages.id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    utm_source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    utm_medium: Mapped[str | None] = mapped_column(String(255), nullable=True)
    utm_campaign: Mapped[str | None] = mapped_column(String(255), nullable=True)
    utm_content: Mapped[str | None] = mapped_column(String(255), nullable=True)
    utm_term: Mapped[str | None] = mapped_column(String(255), nullable=True)

    partner = relationship("Partner", back_populates="links")
    clicks = relationship("LinkClick", back_populates="link", lazy="selectin")
    clients = relationship("Client", back_populates="link", lazy="selectin")
    landing = relationship("LandingPage", back_populates="links")

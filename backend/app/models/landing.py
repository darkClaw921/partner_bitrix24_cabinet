from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class LandingPage(Base):
    __tablename__ = "landing_pages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    partner_id: Mapped[int] = mapped_column(Integer, ForeignKey("partners.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    header_text: Mapped[str] = mapped_column(String(255), nullable=False)
    button_text: Mapped[str] = mapped_column(String(100), default="Оставить заявку")
    theme_color: Mapped[str] = mapped_column(String(7), default="#1a73e8")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    partner = relationship("Partner", back_populates="landings")
    images = relationship(
        "LandingImage", back_populates="landing", lazy="selectin", cascade="all, delete-orphan"
    )
    links = relationship("PartnerLink", back_populates="landing")


class LandingImage(Base):
    __tablename__ = "landing_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    landing_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("landing_pages.id", ondelete="CASCADE"), nullable=False
    )
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    landing = relationship("LandingPage", back_populates="images")

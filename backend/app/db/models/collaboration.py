from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models.enums import CollabStage, CreatorStatus, PaymentStatus


class Collaboration(Base):
    __tablename__ = "collaborations"

    id: Mapped[int] = mapped_column(primary_key=True)
    collab_code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("creators.id"), index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    stage: Mapped[CollabStage] = mapped_column(Enum(CollabStage, name="collab_stage"), default=CollabStage.new_lead)
    priority: Mapped[CreatorStatus] = mapped_column(
        Enum(CreatorStatus, name="creator_status"), default=CreatorStatus.active
    )
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status"), default=PaymentStatus.pending
    )
    commercial_amount: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    creator_reply: Mapped[str | None] = mapped_column(Text, nullable=True)
    commercial_quoted: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    counter_quote_agent: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    counter_quote_creator: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    tracking_link: Mapped[str | None] = mapped_column(String(300), nullable=True)
    order_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    views_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comments_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_activity_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

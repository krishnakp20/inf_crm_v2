from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models.enums import CollabStage, ContentType, CreatorStatus, DealType, PaymentStatus, Platform


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
    # Set from the "Live video attribution" section once a card reaches Live --
    # a manually-entered ops tracking code (e.g. "AN_Naina_1198"), distinct
    # from collab_code (our own auto-generated Collab ID) and from
    # tracking_link (the Product Sent shipment link). Metric Upload matches
    # rows against these two fields, not collab_code/tracking_link.
    poc_code: Mapped[str | None] = mapped_column(String(60), nullable=True)
    video_link: Mapped[str | None] = mapped_column(String(300), nullable=True)
    # Optional, user-entered actual live date. Never required -- every
    # consumer of "when did this go live" (Analytics scoping, Partnership
    # Hub, Campaigns, Database table, creator lifecycle) falls back to the
    # collaboration's first transition-to-Live CollabStageEvent when this
    # is null. See collab_pipeline.effective_live_dates, the single shared
    # source of truth for that fallback logic.
    video_live_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    views_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comments_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Populated by Metric Upload (Settings) only -- see app/services/metric_upload.py.
    likes_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    revenue: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    ad_spend: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    roas: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    campaign_id: Mapped[int | None] = mapped_column(
        ForeignKey("campaigns.id", ondelete="SET NULL"), nullable=True, index=True
    )
    platform: Mapped[Platform | None] = mapped_column(Enum(Platform, name="platform"), nullable=True)
    deal_type: Mapped[DealType | None] = mapped_column(Enum(DealType, name="deal_type"), nullable=True)
    content_type: Mapped[ContentType | None] = mapped_column(Enum(ContentType, name="content_type"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_activity_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Set only by the automated dead-zone sweep (services/dead_zone.py) --
    # never exposed on Create/Update schemas. Drives the Kanban card's
    # owner-avatar display only; owner_id itself is left fully intact so no
    # scoping/joins anywhere else in the app need to change (see plan notes).
    ownership_revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

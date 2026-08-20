from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models.enums import CampaignStatus


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    status: Mapped[CampaignStatus] = mapped_column(
        Enum(CampaignStatus, name="campaign_status"), default=CampaignStatus.draft
    )
    target_videos: Mapped[int] = mapped_column(Integer, default=0)
    creators_needed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    demographic: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str | None] = mapped_column(String(60), nullable=True)
    # List of Platform.value strings -- JSON, not a native array, matching
    # Announcement.audience_user_ids' precedent for a list-of-scalars column.
    platforms: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

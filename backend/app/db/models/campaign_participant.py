from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CampaignParticipant(Base):
    __tablename__ = "campaign_participants"
    __table_args__ = (UniqueConstraint("campaign_id", "user_id", name="uq_campaign_participant"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("campaigns.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # Live videos this participant has committed toward the campaign's
    # target_videos. Sum across participants = "Committed"; target_videos
    # minus that sum = "Unassigned" (open capacity for others to self-join).
    allocation: Mapped[int] = mapped_column(Integer, default=0)
    is_mandatory: Mapped[bool] = mapped_column(Boolean, default=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

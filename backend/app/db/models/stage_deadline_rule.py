from datetime import datetime

from sqlalchemy import DateTime, Enum, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models.enums import CreatorStage


class StageDeadlineRule(Base):
    __tablename__ = "stage_deadline_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    stage: Mapped[CreatorStage] = mapped_column(Enum(CreatorStage, name="creator_stage"), unique=True)
    max_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

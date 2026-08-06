from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models.enums import CreatorStage


class StageEvent(Base):
    __tablename__ = "stage_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("creators.id"), index=True)
    from_stage: Mapped[CreatorStage | None] = mapped_column(
        Enum(CreatorStage, name="creator_stage"), nullable=True
    )
    to_stage: Mapped[CreatorStage] = mapped_column(Enum(CreatorStage, name="creator_stage"))
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

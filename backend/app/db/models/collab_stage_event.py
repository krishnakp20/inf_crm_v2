from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models.enums import CollabStage


class CollabStageEvent(Base):
    __tablename__ = "collab_stage_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    collaboration_id: Mapped[int] = mapped_column(ForeignKey("collaborations.id"), index=True)
    from_stage: Mapped[CollabStage | None] = mapped_column(Enum(CollabStage, name="collab_stage"), nullable=True)
    to_stage: Mapped[CollabStage] = mapped_column(Enum(CollabStage, name="collab_stage"))
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

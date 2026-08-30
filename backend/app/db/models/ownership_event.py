from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models.enums import OwnershipEventType


class OwnershipEvent(Base):
    __tablename__ = "ownership_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("creators.id"), index=True)
    # The owner this event resulted in -- unchanged for a "revoked" event,
    # since revoking doesn't reassign the creator to anyone new.
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    # Nullable: rows created before this column existed have no type on
    # record and are treated as a generic "assigned" in the activity log.
    event_type: Mapped[OwnershipEventType | None] = mapped_column(
        Enum(OwnershipEventType, name="ownership_event_type"), nullable=True
    )
    # Who performed the action; null for rows predating this column.
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    note: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

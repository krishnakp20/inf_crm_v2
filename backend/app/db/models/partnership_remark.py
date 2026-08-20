from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PartnershipRemark(Base):
    """Append-only remark timeline entry. Mirrors Message's creator-conversation
    shape -- author_name is joined from User at read time, not stored."""

    __tablename__ = "partnership_remarks"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("partnership_tickets.id"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    # Short route-set label, e.g. "Agent action required" / "Agent submitted" -- not free text.
    tag: Mapped[str | None] = mapped_column(String(60), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

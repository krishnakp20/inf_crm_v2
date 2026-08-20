from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models.enums import PartnershipCollabStatus, TicketStatus


class PartnershipTicket(Base):
    __tablename__ = "partnership_tickets"

    id: Mapped[int] = mapped_column(primary_key=True)
    # 1:1 with Collaboration -- auto-created the first time a collaboration
    # transitions to CollabStage.live (see transition_collab_stage). Rows
    # are permanent: never deleted, never re-created for the same collab.
    collaboration_id: Mapped[int] = mapped_column(ForeignKey("collaborations.id"), unique=True, index=True)

    ticket_status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus, name="ticket_status"), default=TicketStatus.open, index=True
    )
    collab_status: Mapped[PartnershipCollabStatus] = mapped_column(
        Enum(PartnershipCollabStatus, name="partnership_collab_status"), default=PartnershipCollabStatus.open
    )

    requested_ad_rights: Mapped[bool] = mapped_column(Boolean, default=False)
    requested_ad_code: Mapped[bool] = mapped_column(Boolean, default=False)
    requested_cta_link: Mapped[bool] = mapped_column(Boolean, default=False)

    # Ad-rights commercial negotiation -- a separate, parallel field set from
    # Collaboration.commercial_quoted/counter_quote_agent/counter_quote_creator/
    # commercial_amount (the product-sale negotiation). Same {concept}_{role}
    # convention; never reuse the product-sale fields for this.
    ad_rights_creator_quote: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    ad_rights_agent_counter: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    ad_rights_admin_counter: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    ad_rights_amount: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)

    ad_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ad_right_duration_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ad_right_expires_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    cta_link: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # Video-level attributes the deck lists on Overview with no existing home
    # anywhere else in the schema -- kept on the ticket to avoid touching
    # Collaboration for a Partnership Hub-only concept.
    content_bucket: Mapped[str | None] = mapped_column(String(60), nullable=True)
    language: Mapped[str | None] = mapped_column(String(60), nullable=True)

    response_due_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Stamped once on the ticket's first-ever Take Action; source for the
    # Open tab's aging bucket. Never touched again after that first stamp.
    first_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

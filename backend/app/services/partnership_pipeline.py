from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import scoped_owner_ids
from app.db.models.collaboration import Collaboration
from app.db.models.enums import TicketStatus, UserRole
from app.db.models.partnership_ticket import PartnershipTicket
from app.db.models.user import User
from app.schemas.partnership import PartnershipStats

REMARK_TAG_ADMIN_REQUEST = "Agent action required"
REMARK_TAG_AGENT_RESPONSE = "Agent submitted"
REMARK_TAG_CTA_SUBMITTED = "CTA submitted"
REMARK_TAG_ADMIN_COUNTER = "Admin countered"
REMARK_TAG_CHANGE_REQUESTED = "Change requested"
REMARK_TAG_VERIFIED_CLOSED = "Closed & Live"

_COMMERCIAL_FIELDS = (
    "ad_rights_creator_quote",
    "ad_rights_agent_counter",
    "ad_rights_admin_counter",
    "ad_rights_amount",
)

_AD_FIELDS = ("ad_code", "ad_right_duration_days", "ad_right_expires_at")


def aging_bucket(first_requested_at: datetime | None, ticket_status: TicketStatus) -> tuple[str | None, int | None]:
    """Normal (0-2 days) / Follow up (3-5) / Escalate (5+), counted from the
    ticket's first-ever Take Action. None once closed -- aging stops mattering
    for a terminal ticket -- or if no request has ever been made yet."""
    if first_requested_at is None or ticket_status == TicketStatus.closed_and_live:
        return None, None
    days = (datetime.now(timezone.utc) - first_requested_at).days
    if days <= 2:
        return "Normal", days
    if days <= 5:
        return "Follow up", days
    return "Escalate", days


def redact_commercial(row: dict) -> dict:
    """Marketer/Supervisor never see the ad-rights commercial figures, even
    though Marketer can trigger the request that produces them."""
    redacted = dict(row)
    for field in _COMMERCIAL_FIELDS:
        redacted[field] = None
    return redacted


def redact_for_editor(row: dict) -> dict:
    """Editor's list-view rows use the same PartnershipOverviewRow/OpenRow
    shape as everyone else (no separate narrow schema for lists, unlike the
    single-ticket detail endpoint), so achieve the same "no ad code/rights/
    commercial visibility" outcome by nulling every such field rather than
    omitting the JSON keys."""
    redacted = redact_commercial(row)
    for field in _AD_FIELDS:
        redacted[field] = None
    return redacted


def should_redact_commercial(user: User) -> bool:
    return user.role in (UserRole.marketer, UserRole.supervisor)


def requested_chips(ticket) -> list[str]:
    chips = []
    if ticket.requested_ad_rights:
        chips.append("Ad rights")
    if ticket.requested_ad_code:
        chips.append("Ad code")
    if ticket.requested_cta_link:
        chips.append("CTA link")
    return chips


async def scoped_ticket_ids(user: User, db: AsyncSession) -> list[int] | None:
    """None = unrestricted (Admin/Marketer). Supervisor/Advisor scoped to
    tickets whose parent collaboration's owner_id is in scoped_owner_ids.
    Editor scoped to tickets that requested a CTA link, regardless of owner."""
    if user.role in (UserRole.admin, UserRole.marketer):
        return None
    if user.role == UserRole.editor:
        result = await db.execute(select(PartnershipTicket.id).where(PartnershipTicket.requested_cta_link.is_(True)))
        return [row[0] for row in result.all()]
    owner_ids = await scoped_owner_ids(user, db)
    if owner_ids is None:
        return None
    result = await db.execute(
        select(PartnershipTicket.id)
        .join(Collaboration, Collaboration.id == PartnershipTicket.collaboration_id)
        .where(Collaboration.owner_id.in_(owner_ids))
    )
    return [row[0] for row in result.all()]


async def partnership_stats(db: AsyncSession, user: User) -> PartnershipStats:
    scope = await scoped_ticket_ids(user, db)

    def scoped(stmt):
        return stmt.where(PartnershipTicket.id.in_(scope)) if scope is not None else stmt

    video_register = (await db.execute(scoped(select(func.count(PartnershipTicket.id))))).scalar_one()
    open_tickets = (
        await db.execute(scoped(select(func.count(PartnershipTicket.id)).where(PartnershipTicket.ticket_status != TicketStatus.closed_and_live)))
    ).scalar_one()
    closed_and_live = (
        await db.execute(scoped(select(func.count(PartnershipTicket.id)).where(PartnershipTicket.ticket_status == TicketStatus.closed_and_live)))
    ).scalar_one()

    if user.role == UserRole.supervisor:
        awaiting_my_action = 0
    elif user.role in (UserRole.admin, UserRole.marketer):
        awaiting_my_action = (
            await db.execute(
                scoped(select(func.count(PartnershipTicket.id)).where(PartnershipTicket.ticket_status == TicketStatus.pending_at_admin))
            )
        ).scalar_one()
    else:
        # Advisor and Editor are both scoped to "pending on me" tickets.
        awaiting_my_action = (
            await db.execute(
                scoped(select(func.count(PartnershipTicket.id)).where(PartnershipTicket.ticket_status == TicketStatus.pending_at_user))
            )
        ).scalar_one()

    return PartnershipStats(
        video_register=video_register,
        open_tickets=open_tickets,
        awaiting_my_action=awaiting_my_action,
        closed_and_live=closed_and_live,
    )

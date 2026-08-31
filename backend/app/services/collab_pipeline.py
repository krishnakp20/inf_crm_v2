from collections import defaultdict
from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.collab_stage_event import CollabStageEvent
from app.db.models.collaboration import Collaboration
from app.db.models.collaboration_product import CollaborationProduct
from app.db.models.creator import Creator
from app.db.models.enums import CollabStage
from app.db.models.partnership_ticket import PartnershipTicket

# Matches the reference site's actual Kanban columns exactly (confirmed by
# checking the real "Add collaboration" form's Starting stage dropdown,
# which only offers the 9 stages up to Live -- Dead Leads is reached by
# explicitly moving a card there, not picked as a starting point).
COLLAB_STAGE_ORDER: list[CollabStage] = [
    CollabStage.new_lead,
    CollabStage.replied,
    CollabStage.negotiating,
    CollabStage.commercial_locked,
    CollabStage.product_sent,
    CollabStage.product_delivered,
    CollabStage.first_draft,
    CollabStage.approved,
    CollabStage.live,
    CollabStage.dead_leads,
]

# Stages a new collaboration can actually be created into (excludes Dead
# Leads, which is only reached by explicitly moving a card there).
STARTABLE_STAGES: list[CollabStage] = COLLAB_STAGE_ORDER[:-1]

COLLAB_STAGE_INDEX = {stage: i for i, stage in enumerate(COLLAB_STAGE_ORDER)}

COLLAB_STAGE_LABELS: dict[CollabStage, str] = {
    CollabStage.new_lead: "New leads",
    CollabStage.replied: "Replied",
    CollabStage.negotiating: "Negotiation",
    CollabStage.commercial_locked: "Commercial locked",
    CollabStage.product_sent: "Product sent",
    CollabStage.product_delivered: "Product Delivered",
    CollabStage.first_draft: "First Draft",
    CollabStage.approved: "Approved",
    CollabStage.live: "Live",
    CollabStage.dead_leads: "Dead Leads",
}

# Dashboard pipeline groups the 9 live-progression stages into 7 buckets.
# Dead Leads is deliberately excluded -- it's a terminal/dropped-out branch,
# not part of the live-progress funnel the reference's Dashboard shows.
COLLAB_FUNNEL_BUCKETS: list[tuple[str, str, list[CollabStage]]] = [
    ("new_leads", "New leads", [CollabStage.new_lead]),
    ("replied", "Replied", [CollabStage.replied]),
    ("negotiating", "Negotiating", [CollabStage.negotiating]),
    ("locked", "Locked", [CollabStage.commercial_locked]),
    ("product_sent", "Product sent", [CollabStage.product_sent]),
    ("product_delivered", "Product delivered", [CollabStage.product_delivered]),
    ("content_live", "Content live", [CollabStage.first_draft, CollabStage.approved, CollabStage.live]),
]


def is_video_live(stage: CollabStage) -> bool:
    """A collaboration counts as "video live" once it reaches Live --
    matches the reference's "Each Collab ID reaching Live adds one video
    to the linked creator username." Dead Leads never counts, even though
    it sorts after Live in COLLAB_STAGE_ORDER for column-rendering purposes.
    """
    return stage == CollabStage.live


async def effective_live_dates(db: AsyncSession, collab_ids: list[int]) -> dict[int, date]:
    """The real "video went live" date for each collaboration: the
    explicit Collaboration.video_live_date if the user entered one,
    otherwise the date of this collab's first transition to CollabStage.live
    (the same event-derived proxy every "live date" display in this app --
    Analytics, Partnership Hub, Campaigns, the Database table, creator
    lifecycle -- already used before this field existed). Single shared
    source of truth so all of those stay consistent with each other and
    with the explicit override once it's set.

    Standardizes on the FIRST live transition where a proxy is needed --
    a couple of call sites previously used the most recent one instead,
    which only differs for a collaboration that left and re-entered Live,
    an edge case where "first" is the more meaningful "when did this video
    actually go live" answer anyway.
    """
    if not collab_ids:
        return {}
    event_rows = (
        await db.execute(
            select(CollabStageEvent.collaboration_id, func.min(CollabStageEvent.created_at))
            .where(CollabStageEvent.collaboration_id.in_(collab_ids), CollabStageEvent.to_stage == CollabStage.live)
            .group_by(CollabStageEvent.collaboration_id)
        )
    ).all()
    event_date_by_collab = {cid: created_at.date() for cid, created_at in event_rows}

    manual_rows = (
        await db.execute(
            select(Collaboration.id, Collaboration.video_live_date).where(
                Collaboration.id.in_(collab_ids), Collaboration.video_live_date.is_not(None)
            )
        )
    ).all()
    manual_date_by_collab = dict(manual_rows)

    return {
        cid: manual_date_by_collab.get(cid, event_date_by_collab.get(cid))
        for cid in set(event_date_by_collab) | set(manual_date_by_collab)
    }


# Fixed (non-admin-configurable) aging thresholds for the "Overdue" badge on
# collaboration cards -- the Settings page's stage-deadline panel governs
# CreatorStage lead aging instead (see pipeline.py), not these.
COLLAB_OVERDUE_MAX_DAYS: dict[CollabStage, int | None] = {
    CollabStage.new_lead: 2,
    CollabStage.replied: 2,
    CollabStage.negotiating: 3,
    CollabStage.commercial_locked: 2,
    CollabStage.product_sent: 4,
    CollabStage.product_delivered: 4,
    CollabStage.first_draft: 3,
    CollabStage.approved: 3,
    CollabStage.live: None,
    CollabStage.dead_leads: None,
}


def bucket_min_index(stages: list[CollabStage]) -> int:
    return min(COLLAB_STAGE_INDEX[s] for s in stages)


# Cumulative required "backfill" fields per Starting stage -- confirmed live
# against the reference's Add Collaboration form by cycling every Starting
# stage option and reading which fields carried a "Required" marker.
# "live_attribution" isn't a real Collaboration column -- it means "at least
# one CollaborationProduct row with is_live_attributed=True must be provided".
_STAGE_FIELD_ADDITIONS: dict[CollabStage, list[str]] = {
    CollabStage.replied: ["creator_reply"],
    CollabStage.negotiating: ["commercial_quoted", "deal_type"],
    CollabStage.commercial_locked: ["commercial_amount", "content_type"],
    CollabStage.live: ["live_attribution"],
}

STAGE_REQUIRED_FIELDS: dict[CollabStage, list[str]] = {}
_cumulative: list[str] = []
for _stage in COLLAB_STAGE_ORDER:
    if _stage == CollabStage.dead_leads:
        continue
    _cumulative = _cumulative + _STAGE_FIELD_ADDITIONS.get(_stage, [])
    STAGE_REQUIRED_FIELDS[_stage] = list(_cumulative)


async def get_video_credit_by_product_and_owner(
    db: AsyncSession, owner_ids: list[int] | None = None
) -> dict[int, dict[int, float]]:
    """Per-product fractional video-live credit for the Dashboard's
    Product-wise performance panel, keyed by (product_id -> {collaboration
    owner_id: credit}). A collaboration in the Live stage always counts as
    exactly one video overall (see is_video_live) -- this function only
    decides how that one video's credit is split across products: evenly
    across whichever products are marked is_live_attributed, or, if none are
    marked (e.g. the collab reached Live via drag/"Jump to stage" rather than
    the backfill form), the full credit falls to the primary product.

    Keyed by the collaboration's real owner_id, not Product.owner_id --
    the latter is just whoever's account created/imported the product row
    (confirmed: 122 of 130 products in this dataset are attributed to the
    one admin account the bulk import ran under), which is why the
    Dashboard's per-user filter used to show almost nothing for any advisor
    other than that one account."""
    stmt = (
        select(
            CollaborationProduct.collaboration_id,
            CollaborationProduct.product_id,
            CollaborationProduct.is_primary,
            CollaborationProduct.is_live_attributed,
            Collaboration.owner_id,
        )
        .join(Collaboration, Collaboration.id == CollaborationProduct.collaboration_id)
        .where(Collaboration.stage == CollabStage.live)
    )
    if owner_ids is not None:
        stmt = stmt.where(Collaboration.owner_id.in_(owner_ids))
    rows = (await db.execute(stmt)).all()

    by_collab: dict[int, list[tuple[int, bool, bool]]] = defaultdict(list)
    owner_by_collab: dict[int, int] = {}
    for collab_id, product_id, is_primary, is_live_attributed, collab_owner_id in rows:
        by_collab[collab_id].append((product_id, is_primary, is_live_attributed))
        owner_by_collab[collab_id] = collab_owner_id

    credit: dict[int, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    for collab_id, links in by_collab.items():
        collab_owner_id = owner_by_collab[collab_id]
        live_attributed = [pid for pid, _, live in links if live]
        if live_attributed:
            share = 1.0 / len(live_attributed)
            for pid in live_attributed:
                credit[pid][collab_owner_id] += share
        else:
            primary = next((pid for pid, is_primary, _ in links if is_primary), None)
            if primary is not None:
                credit[primary][collab_owner_id] += 1.0
    return {pid: dict(by_owner) for pid, by_owner in credit.items()}


async def apply_stage_transition(
    db: AsyncSession,
    collab: Collaboration,
    creator: Creator,
    to_stage: CollabStage,
    actor_id: int,
    note: str | None = None,
    bump_activity: bool = True,
) -> None:
    """Core stage-mutation + side effects shared by the interactive
    transition_collab_stage route and the automated dead-zone sweep
    (services/dead_zone.py). Does NOT run the forward-move required-field
    validation gauntlet -- that stays a route-only concern the automated job
    must never be blocked by. Does NOT commit -- caller controls the
    transaction.
    """
    was_live = collab.stage == CollabStage.live
    was_dead = collab.stage == CollabStage.dead_leads

    db.add(
        CollabStageEvent(
            collaboration_id=collab.id, from_stage=collab.stage, to_stage=to_stage, actor_id=actor_id, note=note
        )
    )
    collab.stage = to_stage
    if bump_activity:
        collab.last_activity_at = datetime.now(timezone.utc)

    if to_stage == CollabStage.live and not was_live:
        existing_ticket = (
            await db.execute(select(PartnershipTicket.id).where(PartnershipTicket.collaboration_id == collab.id))
        ).first()
        if existing_ticket is None:
            db.add(PartnershipTicket(collaboration_id=collab.id))

    if to_stage == CollabStage.dead_leads and not was_dead:
        other_active = (
            await db.execute(
                select(Collaboration.id).where(
                    Collaboration.creator_id == collab.creator_id,
                    Collaboration.id != collab.id,
                    Collaboration.stage != CollabStage.dead_leads,
                )
            )
        ).first()
        if other_active is None:
            creator.is_archived = True
            creator.archived_at = datetime.now(timezone.utc)
            creator.archive_reason = "All collaborations moved to Dead Leads"
    elif was_dead and to_stage != CollabStage.dead_leads:
        creator.is_archived = False
        creator.archived_at = None
        creator.archive_reason = None
        # Manually reviving a dead lead should also drop the auto-revoked
        # marker -- the "no owner shown" display is specifically for cards
        # a human hasn't touched since the automated move.
        collab.ownership_revoked_at = None

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.collaboration import Collaboration
from app.db.models.collaboration_product import CollaborationProduct
from app.db.models.enums import CollabStage

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
    CollabStage.negotiating: ["commercial_quoted"],
    CollabStage.commercial_locked: ["commercial_amount"],
    CollabStage.live: ["live_attribution"],
}

STAGE_REQUIRED_FIELDS: dict[CollabStage, list[str]] = {}
_cumulative: list[str] = []
for _stage in COLLAB_STAGE_ORDER:
    if _stage == CollabStage.dead_leads:
        continue
    _cumulative = _cumulative + _STAGE_FIELD_ADDITIONS.get(_stage, [])
    STAGE_REQUIRED_FIELDS[_stage] = list(_cumulative)


async def get_video_credit_by_product(db: AsyncSession, owner_id: int | None = None) -> dict[int, float]:
    """Per-product fractional video-live credit for the Dashboard's
    Product-wise performance panel. A collaboration in the Live stage always
    counts as exactly one video overall (see is_video_live) -- this function
    only decides how that one video's credit is split across products: evenly
    across whichever products are marked is_live_attributed, or, if none are
    marked (e.g. the collab reached Live via drag/"Jump to stage" rather than
    the backfill form), the full credit falls to the primary product.
    """
    stmt = (
        select(
            CollaborationProduct.collaboration_id,
            CollaborationProduct.product_id,
            CollaborationProduct.is_primary,
            CollaborationProduct.is_live_attributed,
        )
        .join(Collaboration, Collaboration.id == CollaborationProduct.collaboration_id)
        .where(Collaboration.stage == CollabStage.live)
    )
    if owner_id is not None:
        stmt = stmt.where(Collaboration.owner_id == owner_id)
    rows = (await db.execute(stmt)).all()

    by_collab: dict[int, list[tuple[int, bool, bool]]] = defaultdict(list)
    for collab_id, product_id, is_primary, is_live_attributed in rows:
        by_collab[collab_id].append((product_id, is_primary, is_live_attributed))

    credit: dict[int, float] = defaultdict(float)
    for links in by_collab.values():
        live_attributed = [pid for pid, _, live in links if live]
        if live_attributed:
            share = 1.0 / len(live_attributed)
            for pid in live_attributed:
                credit[pid] += share
        else:
            primary = next((pid for pid, is_primary, _ in links if is_primary), None)
            if primary is not None:
                credit[primary] += 1.0
    return dict(credit)

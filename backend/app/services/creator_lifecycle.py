from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.collab_stage_event import CollabStageEvent
from app.db.models.collaboration import Collaboration
from app.db.models.collaboration_product import CollaborationProduct
from app.db.models.creator import Creator
from app.db.models.enums import CollabStage
from app.db.models.ownership_event import OwnershipEvent
from app.db.models.product import Product
from app.db.models.user import User
from app.schemas.creator_lifecycle import (
    CommercialHistoryRow,
    CommercialHistorySummary,
    CreatorLifecycle,
    LifecycleSummary,
    LifecycleTimelineEntry,
    LifecycleTrackStep,
    OwnershipHistoryEntry,
    VideoHistoryRow,
)
from app.services.collab_pipeline import COLLAB_STAGE_INDEX, COLLAB_STAGE_ORDER, is_video_live

# Labels for the read-only lifecycle stepper shown in the Database page's
# "view creator" drawer -- deliberately separate from COLLAB_STAGE_LABELS
# (used by the Kanban board), which uses different casing/pluralization.
LIFECYCLE_TRACK_LABELS: dict[CollabStage, str] = {
    CollabStage.new_lead: "New lead",
    CollabStage.replied: "Replied",
    CollabStage.negotiating: "Negotiation",
    CollabStage.commercial_locked: "Commercial locked",
    CollabStage.product_sent: "Product sent",
    CollabStage.product_delivered: "Product delivered",
    CollabStage.first_draft: "First draft",
    CollabStage.approved: "Approved",
    CollabStage.live: "Live",
}
LIFECYCLE_TRACK_STAGES: list[CollabStage] = [s for s in COLLAB_STAGE_ORDER if s != CollabStage.dead_leads]


def _initials(name: str) -> str:
    parts = [p for p in name.split() if p]
    return "".join(p[0] for p in parts[:2]).upper() or "?"


def _date_label(dt) -> str:
    return dt.strftime("%d %b %Y")


async def get_creator_lifecycle(db: AsyncSession, creator_id: int) -> CreatorLifecycle:
    creator = await db.get(Creator, creator_id)
    owner = await db.get(User, creator.owner_id) if creator else None
    owner_name = owner.name if owner else "Unassigned"

    collabs = list(
        (
            await db.execute(
                select(Collaboration)
                .where(Collaboration.creator_id == creator_id)
                .order_by(Collaboration.last_activity_at.desc())
            )
        )
        .scalars()
        .all()
    )
    collab_ids = [c.id for c in collabs]

    primary_product_by_collab: dict[int, str] = {}
    if collab_ids:
        rows = (
            await db.execute(
                select(CollaborationProduct.collaboration_id, Product.name, CollaborationProduct.is_primary)
                .join(Product, Product.id == CollaborationProduct.product_id)
                .where(CollaborationProduct.collaboration_id.in_(collab_ids))
            )
        ).all()
        for cid, name, is_primary in rows:
            if is_primary or cid not in primary_product_by_collab:
                primary_product_by_collab[cid] = name

    went_live_at: dict[int, object] = {}
    if collab_ids:
        live_events = (
            await db.execute(
                select(CollabStageEvent.collaboration_id, CollabStageEvent.created_at)
                .where(
                    CollabStageEvent.collaboration_id.in_(collab_ids),
                    CollabStageEvent.to_stage == CollabStage.live,
                )
                .order_by(CollabStageEvent.created_at.desc())
            )
        ).all()
        for cid, created_at in live_events:
            went_live_at.setdefault(cid, created_at)

    non_dead = [c for c in collabs if c.stage != CollabStage.dead_leads]
    primary_collab = non_dead[0] if non_dead else (collabs[0] if collabs else None)

    # --- Lifecycle track ---
    if primary_collab is not None and primary_collab.stage != CollabStage.dead_leads:
        current_idx = COLLAB_STAGE_INDEX[primary_collab.stage]
    else:
        # No (non-dead) collaboration yet -- the creator sits at the very
        # start of the pipeline, same as a fresh "New lead" collaboration.
        current_idx = 0
    track: list[LifecycleTrackStep] = [LifecycleTrackStep(label="Added", status="complete")]
    for i, stage in enumerate(LIFECYCLE_TRACK_STAGES):
        if current_idx < 0:
            step_status = "upcoming"
        elif i < current_idx:
            step_status = "complete"
        elif i == current_idx:
            step_status = "current"
        else:
            step_status = "upcoming"
        track.append(LifecycleTrackStep(label=LIFECYCLE_TRACK_LABELS[stage], status=step_status))

    # --- Summary ---
    videos_delivered = sum(1 for c in collabs if is_video_live(c.stage))
    live_collabs = [c for c in collabs if c.stage == CollabStage.live]
    last_video_live_at = max((c.last_activity_at for c in live_collabs), default=None)
    with_cost = [c for c in collabs if c.commercial_amount is not None]
    last_locked_collab = max(with_cost, key=lambda c: c.last_activity_at) if with_cost else None
    current_stage_label = (
        LIFECYCLE_TRACK_LABELS.get(primary_collab.stage, "New lead") if primary_collab else "New lead"
    )

    summary = LifecycleSummary(
        added_at=creator.created_at,
        current_stage_label=current_stage_label,
        videos_delivered=videos_delivered,
        last_video_live_at=last_video_live_at,
        last_commercial_locked=float(last_locked_collab.commercial_amount) if last_locked_collab else None,
    )

    # --- Ownership history ---
    ownership_events = list(
        (
            await db.execute(
                select(OwnershipEvent)
                .where(OwnershipEvent.creator_id == creator_id)
                .order_by(OwnershipEvent.created_at)
            )
        )
        .scalars()
        .all()
    )
    ownership_history: list[OwnershipHistoryEntry] = []
    if ownership_events:
        user_ids = {e.user_id for e in ownership_events}
        users_by_id = {
            u.id: u
            for u in (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
        }
        for i, event in enumerate(reversed(ownership_events)):
            u = users_by_id.get(event.user_id)
            name = u.name if u else "Unknown"
            is_current = i == 0
            ownership_history.append(
                OwnershipHistoryEntry(
                    user_name=name,
                    initials=_initials(name),
                    status="current" if is_current else "previous",
                    note="Current user" if is_current else "Previous user · ownership transfer retained",
                    since_label=_date_label(event.created_at),
                )
            )
    else:
        ownership_history.append(
            OwnershipHistoryEntry(
                user_name=owner_name,
                initials=_initials(owner_name),
                status="current",
                note="Current user",
                since_label=_date_label(creator.created_at),
            )
        )

    # --- Timeline (fixed 5-entry template, matching the reference exactly) ---
    latest_stage_event = (
        await db.execute(
            select(CollabStageEvent)
            .join(Collaboration, Collaboration.id == CollabStageEvent.collaboration_id)
            .where(Collaboration.creator_id == creator_id)
            .order_by(CollabStageEvent.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    timeline: list[LifecycleTimelineEntry] = [
        LifecycleTimelineEntry(
            icon="stage",
            title=f"Current stage: {current_stage_label}",
            timestamp_label=_date_label(latest_stage_event.created_at) if latest_stage_event else "Today",
            description=f"The creator is currently managed by {owner_name}.",
        )
    ]
    if last_video_live_at:
        timeline.append(
            LifecycleTimelineEntry(
                icon="video",
                title="Last video went live",
                timestamp_label=_date_label(last_video_live_at),
                description="Most recent delivered video for this creator.",
            )
        )
    else:
        timeline.append(
            LifecycleTimelineEntry(
                icon="video",
                title="No video live yet",
                timestamp_label="—",
                description="The creator has not delivered a live video yet.",
            )
        )
    if last_locked_collab:
        product_name = primary_product_by_collab.get(last_locked_collab.id, "")
        timeline.append(
            LifecycleTimelineEntry(
                icon="commercial",
                title=f"Commercial locked at ₹{int(last_locked_collab.commercial_amount):,}",
                timestamp_label=_date_label(last_locked_collab.last_activity_at),
                description=(
                    f"Final approved commercial for {product_name}. "
                    "Earlier quotes remain available in Commercial history."
                ),
            )
        )
    else:
        timeline.append(
            LifecycleTimelineEntry(
                icon="commercial",
                title="Commercial locked at —",
                timestamp_label=_date_label(creator.created_at),
                description=(
                    "Final approved commercial for No campaign yet. "
                    "Earlier quotes remain available in Commercial history."
                ),
            )
        )
    timeline.append(
        LifecycleTimelineEntry(
            icon="ownership",
            title=f"Ownership assigned to {owner_name}",
            timestamp_label=_date_label(ownership_events[-1].created_at if ownership_events else creator.created_at),
            description=(
                "First ownership assignment for this creator."
                if len(ownership_history) <= 1
                else "Most recent ownership assignment for this creator."
            ),
        )
    )
    timeline.append(
        LifecycleTimelineEntry(
            icon="added",
            title="Creator added to database",
            timestamp_label=_date_label(creator.created_at),
            description=f"@{creator.instagram_handle} cleared the clash check and entered the master database.",
        )
    )

    # --- Video history ---
    video_history: list[VideoHistoryRow] = []
    for c in collabs:
        live_at = went_live_at.get(c.id)
        if live_at is None:
            continue
        video_history.append(
            VideoHistoryRow(
                product_name=primary_product_by_collab.get(c.id, ""),
                live_date=live_at,
                cost=float(c.commercial_amount) if c.commercial_amount is not None else None,
                views=c.views_count,
                comments=c.comments_count,
                status="Live" if c.stage == CollabStage.live else "Archived",
            )
        )
    video_history.sort(key=lambda r: r.live_date, reverse=True)

    # --- Commercial history ---
    commercial_rows: list[CommercialHistoryRow] = []
    for c in collabs:
        if c.commercial_quoted is None and c.commercial_amount is None:
            continue
        commercial_rows.append(
            CommercialHistoryRow(
                collab_code=c.collab_code,
                product_name=primary_product_by_collab.get(c.id, ""),
                creator_quote=float(c.commercial_quoted) if c.commercial_quoted is not None else None,
                agent_counter=float(c.counter_quote_agent) if c.counter_quote_agent is not None else None,
                creator_counter=float(c.counter_quote_creator) if c.counter_quote_creator is not None else None,
                locked=float(c.commercial_amount) if c.commercial_amount is not None else None,
                user_name=owner_name,
                date=c.last_activity_at,
            )
        )
    commercial_rows.sort(key=lambda r: r.date, reverse=True)
    locked_amounts = [r.locked for r in commercial_rows if r.locked is not None]
    commercial_history = CommercialHistorySummary(
        last_locked_amount=locked_amounts[0] if locked_amounts else None,
        last_locked_product_name=next(
            (r.product_name for r in commercial_rows if r.locked is not None), None
        ),
        average_locked=(sum(locked_amounts) / len(locked_amounts)) if locked_amounts else None,
        retained_count=len(commercial_rows),
        rows=commercial_rows,
    )

    return CreatorLifecycle(
        creator_name=creator.name,
        creator_handle=creator.instagram_handle,
        followers_count=creator.followers_count,
        owner_name=owner_name,
        collab_code=primary_collab.collab_code if primary_collab else None,
        summary=summary,
        track=track,
        timeline=timeline,
        video_history=video_history,
        commercial_history=commercial_history,
        ownership_history=ownership_history,
    )

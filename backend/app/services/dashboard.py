from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.announcement import Announcement
from app.db.models.approval_request import ApprovalRequest
from app.db.models.collab_stage_event import CollabStageEvent
from app.db.models.collaboration import Collaboration
from app.db.models.collaboration_product import CollaborationProduct
from app.db.models.creator import Creator
from app.db.models.enums import ApprovalStatus, CollabStage, FollowUpStatus, TicketStatus, UserRole
from app.db.models.follow_up import FollowUp
from app.db.models.partnership_ticket import PartnershipTicket
from app.db.models.product import Product
from app.db.models.stage_event import StageEvent
from app.db.models.user import User
from app.schemas.approval_request import ApprovalRequestOut
from app.schemas.dashboard import (
    ActivityItem,
    AnnouncementOut,
    DashboardResponse,
    FunnelStage,
    KpiSummary,
    TargetRow,
)
from app.schemas.product import ProductPerformance
from app.services.collab_pipeline import (
    COLLAB_FUNNEL_BUCKETS,
    COLLAB_STAGE_INDEX,
    COLLAB_STAGE_LABELS,
    get_video_credit_by_product,
)
from app.services.collab_pipeline import bucket_min_index as collab_bucket_min_index


async def get_followup_progress_today(
    db: AsyncSession, now: datetime, owner_ids: list[int] | None = None
) -> tuple[int, int]:
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    completed_stmt = select(func.count(FollowUp.id)).where(
        FollowUp.status == FollowUpStatus.done,
        FollowUp.completed_at >= today_start,
        FollowUp.completed_at < today_end,
    )
    due_stmt = select(func.count(FollowUp.id)).where(
        FollowUp.status == FollowUpStatus.open, FollowUp.due_at >= today_start, FollowUp.due_at < today_end
    )
    if owner_ids is not None:
        completed_stmt = completed_stmt.where(FollowUp.assigned_to.in_(owner_ids))
        due_stmt = due_stmt.where(FollowUp.assigned_to.in_(owner_ids))

    completed = (await db.execute(completed_stmt)).scalar_one()
    due = (await db.execute(due_stmt)).scalar_one()
    return completed, due + completed


async def get_kpis(
    db: AsyncSession,
    now: datetime,
    owner_ids: list[int] | None = None,
    range_start: datetime | None = None,
    range_end: datetime | None = None,
) -> KpiSummary:
    window_start = range_start or now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    window_end = range_end

    def _in_window(stmt, column):
        stmt = stmt.where(column >= window_start)
        if window_end is not None:
            stmt = stmt.where(column < window_end)
        return stmt

    total_creators_stmt = select(func.count(Creator.id))
    new_in_range_stmt = _in_window(select(func.count(Creator.id)), Creator.created_at)
    if owner_ids is not None:
        total_creators_stmt = total_creators_stmt.where(Creator.owner_id.in_(owner_ids))
        new_in_range_stmt = new_in_range_stmt.where(Creator.owner_id.in_(owner_ids))

    total_creators = (await db.execute(total_creators_stmt)).scalar_one()
    new_in_range = (await db.execute(new_in_range_stmt)).scalar_one()

    active_reels_stmt = select(func.count(Collaboration.id)).where(Collaboration.stage != CollabStage.dead_leads)
    reels_added_in_range_stmt = _in_window(select(func.count(Collaboration.id)), Collaboration.created_at)
    partnership_pending_stmt = select(func.count(Collaboration.id)).where(
        Collaboration.stage.in_([CollabStage.negotiating, CollabStage.commercial_locked])
    )
    ads_live_stmt = select(func.count(Collaboration.id)).where(Collaboration.stage == CollabStage.live)
    if owner_ids is not None:
        active_reels_stmt = active_reels_stmt.where(Collaboration.owner_id.in_(owner_ids))
        reels_added_in_range_stmt = reels_added_in_range_stmt.where(Collaboration.owner_id.in_(owner_ids))
        partnership_pending_stmt = partnership_pending_stmt.where(Collaboration.owner_id.in_(owner_ids))
        ads_live_stmt = ads_live_stmt.where(Collaboration.owner_id.in_(owner_ids))

    active_reels = (await db.execute(active_reels_stmt)).scalar_one()
    reels_added_in_range = (await db.execute(reels_added_in_range_stmt)).scalar_one()
    reels_growth_pct = (reels_added_in_range / active_reels * 100) if active_reels else 0.0
    partnership_pending = (await db.execute(partnership_pending_stmt)).scalar_one()
    ads_live = (await db.execute(ads_live_stmt)).scalar_one()

    follow_ups_completed_today, follow_ups_total_today = await get_followup_progress_today(db, now, owner_ids)

    return KpiSummary(
        total_creators=total_creators,
        new_this_month=new_in_range,
        active_reels=active_reels,
        active_reels_growth_pct=round(reels_growth_pct, 1),
        active_reels_added_this_month=reels_added_in_range,
        partnership_pending=partnership_pending,
        ads_live=ads_live,
        follow_ups_completed_today=follow_ups_completed_today,
        follow_ups_total_today=follow_ups_total_today,
    )


async def get_collab_funnel(db: AsyncSession, owner_ids: list[int] | None = None) -> list[FunnelStage]:
    counts: list[int] = []
    for _, _, stages in COLLAB_FUNNEL_BUCKETS:
        min_index = collab_bucket_min_index(stages)
        at_or_beyond = [
            s for s, i in COLLAB_STAGE_INDEX.items() if i >= min_index and s != CollabStage.dead_leads
        ]
        stmt = select(func.count(Collaboration.id)).where(Collaboration.stage.in_(at_or_beyond))
        if owner_ids is not None:
            stmt = stmt.where(Collaboration.owner_id.in_(owner_ids))
        count = (await db.execute(stmt)).scalar_one()
        counts.append(count)

    # 8th funnel stage: Ads live -- Partnership Hub tickets verified Closed &
    # Live. Not a CollabStage value (every Closed & Live collab is already
    # counted in Content live above), so computed as its own query rather
    # than folded into COLLAB_FUNNEL_BUCKETS' stage-index cumulative logic.
    ads_live_stmt = (
        select(func.count(PartnershipTicket.id))
        .join(Collaboration, Collaboration.id == PartnershipTicket.collaboration_id)
        .where(PartnershipTicket.ticket_status == TicketStatus.closed_and_live)
    )
    if owner_ids is not None:
        ads_live_stmt = ads_live_stmt.where(Collaboration.owner_id.in_(owner_ids))
    counts.append((await db.execute(ads_live_stmt)).scalar_one())

    bucket_labels = [(key, label) for key, label, _ in COLLAB_FUNNEL_BUCKETS] + [("ads_live", "Ads live")]

    stages_out: list[FunnelStage] = []
    for idx, (key, label) in enumerate(bucket_labels):
        # Each stage's conversion_pct is itself relative to the PREVIOUS
        # stage's count (e.g. Replied's is Replied/New leads) -- confirmed
        # against the reference site's exact displayed percentages, which
        # only match this "current/previous" reading, not "next/current".
        conversion_pct = None
        if idx > 0 and counts[idx - 1] > 0:
            conversion_pct = round(counts[idx] / counts[idx - 1] * 100, 1)
        stages_out.append(FunnelStage(stage=key, label=label, count=counts[idx], conversion_pct=conversion_pct))
    return stages_out


async def _collab_moved_in_range(
    db: AsyncSession,
    now: datetime,
    owner_ids: list[int] | None = None,
    range_start: datetime | None = None,
    range_end: datetime | None = None,
) -> int:
    window_start = range_start or (now - timedelta(days=7))
    stmt = select(func.count(func.distinct(CollabStageEvent.collaboration_id))).where(
        CollabStageEvent.created_at >= window_start, CollabStageEvent.from_stage.isnot(None)
    )
    if range_end is not None:
        stmt = stmt.where(CollabStageEvent.created_at < range_end)
    if owner_ids is not None:
        stmt = stmt.join(
            Collaboration, Collaboration.id == CollabStageEvent.collaboration_id
        ).where(Collaboration.owner_id.in_(owner_ids))
    return (await db.execute(stmt)).scalar_one()


async def _latest_announcement(db: AsyncSession, owner_ids: list[int] | None) -> AnnouncementOut | None:
    today = datetime.now(timezone.utc).date()
    stmt = (
        select(Announcement, User)
        .join(User, User.id == Announcement.posted_by)
        .where((Announcement.expires_at.is_(None)) | (Announcement.expires_at >= today))
        .order_by(Announcement.created_at.desc())
    )
    rows = (await db.execute(stmt)).all()
    for announcement, poster in rows:
        if (
            owner_ids is not None
            and announcement.audience == "selected"
            and (
                not announcement.audience_user_ids
                or not (set(announcement.audience_user_ids) & set(owner_ids))
            )
        ):
            continue
        return AnnouncementOut(
            id=announcement.id,
            title=announcement.title,
            body=announcement.body,
            audience=announcement.audience,
            audience_user_ids=announcement.audience_user_ids,
            expires_at=announcement.expires_at,
            pinned=announcement.pinned,
            posted_by_name=poster.name,
            created_at=announcement.created_at,
        )
    return None


async def get_targets(db: AsyncSession, now: datetime, owner_ids: list[int] | None = None) -> list[TargetRow]:
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    advisors_stmt = select(User).where(User.role == UserRole.advisor).order_by(User.name)
    if owner_ids is not None:
        advisors_stmt = advisors_stmt.where(User.id.in_(owner_ids))
    advisors = (await db.execute(advisors_stmt)).scalars().all()

    rows: list[TargetRow] = []
    for advisor in advisors:
        weekly_due = (
            await db.execute(
                select(func.count(FollowUp.id)).where(
                    FollowUp.assigned_to == advisor.id, FollowUp.due_at >= week_start
                )
            )
        ).scalar_one()
        weekly_completed = (
            await db.execute(
                select(func.count(FollowUp.id)).where(
                    FollowUp.assigned_to == advisor.id,
                    FollowUp.status == FollowUpStatus.done,
                    FollowUp.completed_at >= week_start,
                )
            )
        ).scalar_one()
        monthly_due = (
            await db.execute(
                select(func.count(FollowUp.id)).where(
                    FollowUp.assigned_to == advisor.id, FollowUp.due_at >= month_start
                )
            )
        ).scalar_one()
        monthly_completed = (
            await db.execute(
                select(func.count(FollowUp.id)).where(
                    FollowUp.assigned_to == advisor.id,
                    FollowUp.status == FollowUpStatus.done,
                    FollowUp.completed_at >= month_start,
                )
            )
        ).scalar_one()
        weekly_pct = (weekly_completed / weekly_due * 100) if weekly_due else 100.0
        monthly_pct = (monthly_completed / monthly_due * 100) if monthly_due else 100.0

        rows.append(
            TargetRow(
                user_id=advisor.id,
                name=advisor.name,
                weekly_completed=weekly_completed,
                weekly_due=weekly_due,
                weekly_pct=round(weekly_pct, 0),
                monthly_completed=monthly_completed,
                monthly_due=monthly_due,
                monthly_pct=round(monthly_pct, 0),
            )
        )
    return rows


async def get_product_performance(db: AsyncSession, owner_ids: list[int] | None = None) -> list[ProductPerformance]:
    credit_by_product = await get_video_credit_by_product(db, owner_ids)

    stmt = select(Product, User.name).join(User, User.id == Product.owner_id)
    if owner_ids is not None:
        stmt = stmt.where(Product.owner_id.in_(owner_ids))
    rows = (await db.execute(stmt.order_by(Product.name))).all()

    return [
        ProductPerformance(
            id=product.id,
            name=product.name,
            owner_id=product.owner_id,
            target_videos=product.target_videos,
            created_at=product.created_at,
            owner_name=owner_name,
            videos_live=round(credit_by_product.get(product.id, 0.0), 2),
        )
        for product, owner_name in rows
    ]


async def _primary_products_by_collab(db: AsyncSession, collab_ids: list[int]) -> dict[int, str]:
    if not collab_ids:
        return {}
    result = await db.execute(
        select(CollaborationProduct.collaboration_id, Product.name)
        .join(Product, Product.id == CollaborationProduct.product_id)
        .where(
            CollaborationProduct.collaboration_id.in_(collab_ids),
            CollaborationProduct.is_primary.is_(True),
        )
    )
    return dict(result.all())


async def get_dashboard_approval_requests(
    db: AsyncSession, owner_ids: list[int] | None = None, limit: int = 10
) -> list[ApprovalRequestOut]:
    stmt = (
        select(ApprovalRequest, Collaboration, Creator, User)
        .join(Collaboration, Collaboration.id == ApprovalRequest.collaboration_id)
        .join(Creator, Creator.id == Collaboration.creator_id)
        .join(User, User.id == ApprovalRequest.requested_by)
        .where(ApprovalRequest.status == ApprovalStatus.pending)
    )
    if owner_ids is not None:
        stmt = stmt.where(Collaboration.owner_id.in_(owner_ids))
    stmt = stmt.order_by(ApprovalRequest.created_at.desc()).limit(limit)
    rows = (await db.execute(stmt)).all()

    primary_products = await _primary_products_by_collab(db, [collab.id for _, collab, _, _ in rows])

    return [
        ApprovalRequestOut(
            id=req.id,
            request_code=req.request_code,
            collaboration_id=req.collaboration_id,
            creator_name=creator.name,
            creator_handle=creator.instagram_handle,
            product_name=primary_products.get(collab.id, ""),
            collab_stage_label=COLLAB_STAGE_LABELS[collab.stage],
            requested_by=req.requested_by,
            requested_by_name=requester.name,
            priority=req.priority,
            note=req.note,
            status=req.status,
            created_at=req.created_at,
            resolved_at=req.resolved_at,
        )
        for req, collab, creator, requester in rows
    ]


async def _activity(db: AsyncSession, owner_ids: list[int] | None = None) -> list[ActivityItem]:
    stmt = (
        select(StageEvent, Creator, User)
        .join(Creator, Creator.id == StageEvent.creator_id)
        .join(User, User.id == StageEvent.actor_id)
        .order_by(StageEvent.created_at.desc())
        .limit(10)
    )
    if owner_ids is not None:
        stmt = stmt.where(Creator.owner_id.in_(owner_ids))
    rows = (await db.execute(stmt)).all()

    items: list[ActivityItem] = []
    for event, creator, actor in rows:
        items.append(
            ActivityItem(
                headline=f"Moved to {event.to_stage.value.replace('_', ' ')}",
                detail=f"{actor.name} moved {creator.name}" + (f" — {event.note}" if event.note else ""),
                created_at=event.created_at,
            )
        )
    return items


async def get_dashboard(
    db: AsyncSession,
    owner_ids: list[int] | None = None,
    range_start: datetime | None = None,
    range_end: datetime | None = None,
) -> DashboardResponse:
    now = datetime.now(timezone.utc)
    return DashboardResponse(
        kpis=await get_kpis(db, now, owner_ids, range_start, range_end),
        funnel=await get_collab_funnel(db, owner_ids),
        funnel_moved_this_week=await _collab_moved_in_range(db, now, owner_ids, range_start, range_end),
        targets=await get_targets(db, now, owner_ids),
        product_performance=await get_product_performance(db, owner_ids),
        approval_requests=await get_dashboard_approval_requests(db, owner_ids),
        activity=await _activity(db, owner_ids),
        announcement=await _latest_announcement(db, owner_ids),
    )

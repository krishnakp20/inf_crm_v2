from collections import defaultdict
from datetime import datetime

from sqlalchemy import DateTime, case, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.collab_stage_event import CollabStageEvent
from app.db.models.collaboration import Collaboration
from app.db.models.collaboration_product import CollaborationProduct
from app.db.models.creator import Creator
from app.db.models.enums import CollabStage, TicketStatus, UserRole
from app.db.models.partnership_ticket import PartnershipTicket
from app.db.models.product import Product
from app.db.models.product_target import ProductTarget
from app.db.models.user import User
from app.schemas.analytics import (
    AnalyticsBusinessImpact,
    AnalyticsCommercialLocked,
    AnalyticsCostEfficiency,
    AnalyticsPerformanceOverview,
    AnalyticsPipelineVelocityRow,
    AnalyticsProductPerformanceRow,
    AnalyticsTargetRow,
    AnalyticsWhatIsWorking,
    AnalyticsWhatIsWorkingRow,
)

# "Hit definition: a video with 500+ comments" -- fixed, not admin-configurable.
HIT_COMMENT_THRESHOLD = 500

_HIT_CASE = case((Collaboration.comments_count >= HIT_COMMENT_THRESHOLD, 1), else_=0)


def show_cost_data(user: User) -> bool:
    """Creator cost (money paid out -- commercial_amount/CPV/cost-per-comment/
    the whole Cost efficiency panel) is visible to Admin/Supervisor/Advisor --
    only Marketer loses it. Distinct from Partnership Hub's
    should_redact_commercial, which also excludes Supervisor from the
    *ad-rights* negotiation figures, a different, narrower money concept."""
    return user.role != UserRole.marketer


def show_revenue_data(user: User) -> bool:
    return user.role == UserRole.admin


async def _scoped_live_collab_ids(
    db: AsyncSession, owner_ids: list[int] | None, range_start: datetime, range_end: datetime
) -> list[int]:
    """Live-stage collaborations in scope whose live date falls in
    [range_start, range_end). "Live date" prefers the user's explicit
    Collaboration.video_live_date, falling back to the first
    CollabStageEvent.to_stage==live timestamp when unset -- same fallback
    rule as collab_pipeline.effective_live_dates (not reused directly here
    since this needs a SQL-level date-range filter, not a per-id dict).
    The single source of truth for "what counts as a Live video in scope for
    this date range" -- every other section reuses this id list."""
    live_date_subq = (
        select(
            CollabStageEvent.collaboration_id.label("collaboration_id"),
            func.min(CollabStageEvent.created_at).label("live_date"),
        )
        .where(CollabStageEvent.to_stage == CollabStage.live)
        .group_by(CollabStageEvent.collaboration_id)
        .subquery()
    )
    effective_date = func.coalesce(cast(Collaboration.video_live_date, DateTime(timezone=True)), live_date_subq.c.live_date)
    stmt = (
        select(Collaboration.id)
        .outerjoin(live_date_subq, live_date_subq.c.collaboration_id == Collaboration.id)
        .where(
            Collaboration.stage == CollabStage.live,
            effective_date >= range_start,
            effective_date < range_end,
        )
    )
    if owner_ids is not None:
        stmt = stmt.where(Collaboration.owner_id.in_(owner_ids))
    return [row[0] for row in (await db.execute(stmt)).all()]


async def _scoped_locked_collab_ids(
    db: AsyncSession, owner_ids: list[int] | None, range_start: datetime, range_end: datetime
) -> list[int]:
    """Collaborations whose commercial got locked within [range_start,
    range_end) -- same date-range pattern as _scoped_live_collab_ids, but
    keyed off when the commercial was locked rather than when the video
    went live, since a collab in this set may or may not have gone live yet.

    Prefers the first CollabStageEvent.to_stage==commercial_locked
    timestamp, falling back to the collaboration's created_at when no such
    event exists. That fallback is required, not cosmetic: bulk-imported
    legacy collaborations (see import_legacy_creators.py) were created
    directly at stage=live with a single None->live event and no granular
    per-stage history, so an inner join on that event would silently
    exclude the vast majority of real historical data (confirmed: only 8 of
    937 live+commercial-locked collaborations have ever had a real
    commercial_locked event)."""
    locked_date_subq = (
        select(
            CollabStageEvent.collaboration_id.label("collaboration_id"),
            func.min(CollabStageEvent.created_at).label("locked_date"),
        )
        .where(CollabStageEvent.to_stage == CollabStage.commercial_locked)
        .group_by(CollabStageEvent.collaboration_id)
        .subquery()
    )
    locked_date = func.coalesce(locked_date_subq.c.locked_date, Collaboration.created_at)
    stmt = (
        select(Collaboration.id)
        .outerjoin(locked_date_subq, locked_date_subq.c.collaboration_id == Collaboration.id)
        .where(
            Collaboration.commercial_amount.is_not(None),
            locked_date >= range_start,
            locked_date < range_end,
        )
    )
    if owner_ids is not None:
        stmt = stmt.where(Collaboration.owner_id.in_(owner_ids))
    return [row[0] for row in (await db.execute(stmt)).all()]


async def commercial_locked_summary(db: AsyncSession, locked_ids: list[int]) -> AnalyticsCommercialLocked:
    if not locked_ids:
        return AnalyticsCommercialLocked(total_locked=0.0, achieved=0.0, committed=0.0)
    stmt = select(
        func.coalesce(func.sum(Collaboration.commercial_amount), 0),
        func.coalesce(
            func.sum(case((Collaboration.stage == CollabStage.live, Collaboration.commercial_amount), else_=0)), 0
        ),
    ).where(Collaboration.id.in_(locked_ids))
    total_locked, achieved = (await db.execute(stmt)).one()
    total_locked = float(total_locked)
    achieved = float(achieved)
    return AnalyticsCommercialLocked(
        total_locked=total_locked,
        achieved=achieved,
        committed=total_locked - achieved,
    )


async def business_impact(db: AsyncSession, owner_ids: list[int] | None) -> AnalyticsBusinessImpact:
    stmt = (
        select(func.count(PartnershipTicket.id))
        .join(Collaboration, Collaboration.id == PartnershipTicket.collaboration_id)
        .where(PartnershipTicket.ticket_status == TicketStatus.closed_and_live)
    )
    if owner_ids is not None:
        stmt = stmt.where(Collaboration.owner_id.in_(owner_ids))
    ads_live = (await db.execute(stmt)).scalar_one()

    # Revenue/ad spend come from Metric Upload (Settings) -- all-time,
    # owner-scoped like ads_live above, not date-range scoped like live_ids.
    revenue_stmt = select(
        func.coalesce(func.sum(Collaboration.revenue), 0),
        func.coalesce(func.sum(Collaboration.ad_spend), 0),
    ).where(Collaboration.stage == CollabStage.live)
    if owner_ids is not None:
        revenue_stmt = revenue_stmt.where(Collaboration.owner_id.in_(owner_ids))
    total_revenue, total_ad_spend = (await db.execute(revenue_stmt)).one()
    total_revenue = float(total_revenue)
    total_ad_spend = float(total_ad_spend)

    return AnalyticsBusinessImpact(
        # None (not 0) when nothing has been uploaded yet -- a real ₹0 would
        # be indistinguishable from a genuinely zero month.
        revenue=total_revenue if total_revenue else None,
        # Spend-weighted (total revenue / total ad spend), not an average of
        # per-row ROAS -- averaging would weight a ₹500-spend video the same
        # as a ₹50,000-spend video, misrepresenting overall return.
        roas=round(total_revenue / total_ad_spend, 2) if total_ad_spend else None,
        ads_live=ads_live,
    )


async def performance_overview(db: AsyncSession, live_ids: list[int]) -> AnalyticsPerformanceOverview:
    if not live_ids:
        return AnalyticsPerformanceOverview(
            live_videos=0,
            total_views=0,
            cpv=None,
            hit_rate_pct=0.0,
            hits=0,
            total_live_videos_for_hit_rate=0,
            cost_per_comment=None,
            total_comments=0,
        )
    stmt = select(
        func.count(Collaboration.id),
        func.coalesce(func.sum(Collaboration.views_count), 0),
        func.coalesce(func.sum(Collaboration.comments_count), 0),
        func.coalesce(func.sum(Collaboration.commercial_amount), 0),
        func.coalesce(func.sum(_HIT_CASE), 0),
    ).where(Collaboration.id.in_(live_ids))
    live_videos, total_views, total_comments, total_cost, hits = (await db.execute(stmt)).one()
    total_views = int(total_views)
    total_comments = int(total_comments)
    total_cost = float(total_cost)
    hits = int(hits)

    return AnalyticsPerformanceOverview(
        live_videos=live_videos,
        total_views=total_views,
        cpv=round(total_cost / total_views, 2) if total_views else None,
        hit_rate_pct=round(hits / live_videos * 100, 1) if live_videos else 0.0,
        hits=hits,
        total_live_videos_for_hit_rate=live_videos,
        cost_per_comment=round(total_cost / total_comments, 2) if total_comments else None,
        total_comments=total_comments,
    )


async def _product_rollup(db: AsyncSession, live_ids: list[int]) -> dict[int, dict]:
    """Per product: fractional video credit (same is_live_attributed/primary-
    fallback rule as collab_pipeline.get_video_credit_by_product) plus the
    full list of attributed collaboration ids, for views/comments/cost
    rollups where fractional splitting doesn't apply. Restricted to this
    module's date-range-filtered live_ids rather than a blanket owner_ids
    filter, since Analytics needs per-date-range precision that the
    Dashboard's all-time credit helper doesn't provide."""
    if not live_ids:
        return {}
    stmt = select(
        CollaborationProduct.collaboration_id,
        CollaborationProduct.product_id,
        CollaborationProduct.is_primary,
        CollaborationProduct.is_live_attributed,
    ).where(CollaborationProduct.collaboration_id.in_(live_ids))
    rows = (await db.execute(stmt)).all()

    by_collab: dict[int, list[tuple[int, bool, bool]]] = defaultdict(list)
    for collab_id, product_id, is_primary, is_live_attributed in rows:
        by_collab[collab_id].append((product_id, is_primary, is_live_attributed))

    rollup: dict[int, dict] = defaultdict(lambda: {"videos": 0.0, "collab_ids": []})
    for collab_id, links in by_collab.items():
        live_attributed = [pid for pid, _, live in links if live]
        if live_attributed:
            share = 1.0 / len(live_attributed)
            for pid in live_attributed:
                rollup[pid]["videos"] += share
                rollup[pid]["collab_ids"].append(collab_id)
        else:
            primary = next((pid for pid, is_primary, _ in links if is_primary), None)
            if primary is not None:
                rollup[primary]["videos"] += 1.0
                rollup[primary]["collab_ids"].append(collab_id)
    return dict(rollup)


async def product_performance(
    db: AsyncSession, live_ids: list[int], show_cost: bool
) -> list[AnalyticsProductPerformanceRow]:
    rollup = await _product_rollup(db, live_ids)
    if not rollup:
        return []

    products = (
        await db.execute(select(Product).where(Product.id.in_(rollup.keys())))
    ).scalars().all()
    products_by_id = {p.id: p for p in products}

    rows: list[AnalyticsProductPerformanceRow] = []
    for product_id, data in rollup.items():
        product = products_by_id.get(product_id)
        if product is None:
            continue
        collab_ids = data["collab_ids"]
        views, comments, cost = (
            await db.execute(
                select(
                    func.coalesce(func.sum(Collaboration.views_count), 0),
                    func.coalesce(func.sum(Collaboration.comments_count), 0),
                    func.coalesce(func.sum(Collaboration.commercial_amount), 0),
                ).where(Collaboration.id.in_(collab_ids))
            )
        ).one()
        views = int(views)
        comments = int(comments)
        cost = float(cost)
        rows.append(
            AnalyticsProductPerformanceRow(
                product_id=product_id,
                product_name=product.name,
                videos=round(data["videos"], 2),
                views=views,
                comments=comments,
                cost_per_comment=round(cost / comments, 2) if (show_cost and comments) else None,
            )
        )
    rows.sort(key=lambda r: r.views, reverse=True)
    return rows


async def cost_efficiency(db: AsyncSession, live_ids: list[int]) -> AnalyticsCostEfficiency:
    if not live_ids:
        return AnalyticsCostEfficiency(avg_creator_cost=None, total_creator_cost=0.0, cost_per_hit=None)
    stmt = select(
        func.coalesce(func.sum(Collaboration.commercial_amount), 0),
        func.count(Collaboration.id),
        func.coalesce(func.sum(_HIT_CASE), 0),
    ).where(Collaboration.id.in_(live_ids))
    total_cost, live_count, hits = (await db.execute(stmt)).one()
    total_cost = float(total_cost)
    hits = int(hits)
    return AnalyticsCostEfficiency(
        avg_creator_cost=round(total_cost / live_count, 2) if live_count else None,
        total_creator_cost=total_cost,
        cost_per_hit=round(total_cost / hits, 2) if hits else None,
    )


def _build_ranking(rows) -> list[AnalyticsWhatIsWorkingRow]:
    parsed = []
    for value, videos, views, comments, hits in rows:
        views = int(views)
        comments = int(comments)
        hit_rate = round(int(hits) / videos * 100, 1) if videos else 0.0
        parsed.append((value, videos, views, comments, hit_rate))
    parsed.sort(key=lambda r: r[2], reverse=True)
    return [
        AnalyticsWhatIsWorkingRow(rank=i + 1, dimension_value=value, videos=videos, views=views, comments=comments, hit_rate_pct=hit_rate)
        for i, (value, videos, views, comments, hit_rate) in enumerate(parsed)
    ]


async def what_is_working(db: AsyncSession, live_ids: list[int]) -> AnalyticsWhatIsWorking:
    if not live_ids:
        return AnalyticsWhatIsWorking(content_bucket=[], language=[], creator_category=[])

    def _rollup_cols(dimension_col):
        return (
            dimension_col,
            func.count(Collaboration.id),
            func.coalesce(func.sum(Collaboration.views_count), 0),
            func.coalesce(func.sum(Collaboration.comments_count), 0),
            func.coalesce(func.sum(_HIT_CASE), 0),
        )

    # content_bucket/language only exist once a ticket has been filled in via
    # Partnership Hub -- rows without either are excluded from the ranking
    # rather than silently bucketed as zeroes.
    bucket_stmt = (
        select(*_rollup_cols(PartnershipTicket.content_bucket))
        .join(PartnershipTicket, PartnershipTicket.collaboration_id == Collaboration.id)
        .where(Collaboration.id.in_(live_ids), PartnershipTicket.content_bucket.isnot(None))
        .group_by(PartnershipTicket.content_bucket)
    )
    language_stmt = (
        select(*_rollup_cols(PartnershipTicket.language))
        .join(PartnershipTicket, PartnershipTicket.collaboration_id == Collaboration.id)
        .where(Collaboration.id.in_(live_ids), PartnershipTicket.language.isnot(None))
        .group_by(PartnershipTicket.language)
    )
    category_stmt = (
        select(*_rollup_cols(Creator.category))
        .join(Creator, Creator.id == Collaboration.creator_id)
        .where(Collaboration.id.in_(live_ids))
        .group_by(Creator.category)
    )

    bucket_rows = (await db.execute(bucket_stmt)).all()
    language_rows = (await db.execute(language_stmt)).all()
    category_rows = (await db.execute(category_stmt)).all()

    return AnalyticsWhatIsWorking(
        content_bucket=_build_ranking(bucket_rows),
        language=_build_ranking(language_rows),
        creator_category=_build_ranking(category_rows),
    )


async def _first_stage_entry_dates(
    db: AsyncSession, collab_ids: list[int], stage: CollabStage
) -> dict[int, datetime]:
    """Earliest CollabStageEvent.created_at where to_stage==stage, per
    collaboration -- generalizes the single-stage "first arrival" lookup
    Partnership Hub already does for CollabStage.live."""
    if not collab_ids:
        return {}
    stmt = (
        select(CollabStageEvent.collaboration_id, func.min(CollabStageEvent.created_at))
        .where(CollabStageEvent.collaboration_id.in_(collab_ids), CollabStageEvent.to_stage == stage)
        .group_by(CollabStageEvent.collaboration_id)
    )
    return dict((await db.execute(stmt)).all())


async def _velocity_row(
    db: AsyncSession,
    owner_ids: list[int] | None,
    label: str,
    start_stage: CollabStage | None,
    end_stage: CollabStage,
    range_start: datetime,
    range_end: datetime,
) -> AnalyticsPipelineVelocityRow:
    candidate_stmt = select(Collaboration.id, Collaboration.created_at)
    if owner_ids is not None:
        candidate_stmt = candidate_stmt.where(Collaboration.owner_id.in_(owner_ids))
    candidates = (await db.execute(candidate_stmt)).all()
    candidate_ids = [c[0] for c in candidates]
    created_at_by_id = dict(candidates)

    async def avg_for_window(win_start: datetime, win_end: datetime) -> tuple[float | None, int]:
        if not candidate_ids:
            return None, 0
        end_dates = await _first_stage_entry_dates(db, candidate_ids, end_stage)
        start_dates = created_at_by_id if start_stage is None else await _first_stage_entry_dates(db, candidate_ids, start_stage)

        deltas: list[float] = []
        for collab_id, end_dt in end_dates.items():
            if not (win_start <= end_dt < win_end):
                continue
            start_dt = start_dates.get(collab_id)
            if start_dt is None or end_dt <= start_dt:
                continue
            deltas.append((end_dt - start_dt).total_seconds() / 86400.0)
        if not deltas:
            return None, 0
        return sum(deltas) / len(deltas), len(deltas)

    current_avg, sample_size = await avg_for_window(range_start, range_end)
    window_len = range_end - range_start
    prev_avg, _ = await avg_for_window(range_start - window_len, range_start)

    delta = round(current_avg - prev_avg, 1) if (current_avg is not None and prev_avg is not None) else None

    return AnalyticsPipelineVelocityRow(
        label=label,
        avg_days=round(current_avg, 1) if current_avg is not None else None,
        delta_days=delta,
        sample_size=sample_size,
    )


# Each row scopes to owner-restricted collaborations whose relevant end-stage
# event falls inside the selected date range -- not restricted to live_ids,
# since a collab can be commercial-locked without yet being Live, and
# restricting to Live-only would bias every row toward only the
# fastest-moving deals.
_VELOCITY_DEFINITIONS: list[tuple[str, CollabStage | None, CollabStage]] = [
    ("Replied → Commercial locked", CollabStage.replied, CollabStage.commercial_locked),
    ("Product delivered → Live", CollabStage.product_delivered, CollabStage.live),
    ("First draft → Live", CollabStage.first_draft, CollabStage.live),
    ("Overall time to lock", None, CollabStage.commercial_locked),
]


async def pipeline_velocity(
    db: AsyncSession, owner_ids: list[int] | None, range_start: datetime, range_end: datetime
) -> list[AnalyticsPipelineVelocityRow]:
    return [
        await _velocity_row(db, owner_ids, label, start_stage, end_stage, range_start, range_end)
        for label, start_stage, end_stage in _VELOCITY_DEFINITIONS
    ]


async def _live_video_credit_for_owner(
    db: AsyncSession, user_id: int, range_start: datetime, range_end: datetime
) -> float:
    live_ids = await _scoped_live_collab_ids(db, [user_id], range_start, range_end)
    rollup = await _product_rollup(db, live_ids)
    return sum(data["videos"] for data in rollup.values())


async def target_vs_achieved(
    db: AsyncSession, owner_ids: list[int] | None, range_start: datetime, range_end: datetime
) -> list[AnalyticsTargetRow]:
    range_days = (range_end - range_start).days or 1
    use_weekly = range_days <= 10
    proration = 1.0 if use_weekly else range_days / 30.0

    if owner_ids is not None:
        users_stmt = select(User.id, User.name).where(User.id.in_(owner_ids)).order_by(User.name)
    else:
        # Marketer's unrestricted scope: every user who has any target set,
        # not "no users" (owner_ids=None elsewhere means "everyone owns
        # everything," which doesn't resolve to a concrete user list here).
        users_stmt = (
            select(User.id, User.name)
            .join(ProductTarget, ProductTarget.user_id == User.id)
            .distinct()
            .order_by(User.name)
        )
    users = (await db.execute(users_stmt)).all()
    if not users:
        return []
    user_ids = [u[0] for u in users]

    targets_stmt = (
        select(
            ProductTarget.user_id,
            func.coalesce(func.sum(ProductTarget.weekly_target), 0),
            func.coalesce(func.sum(ProductTarget.monthly_target), 0),
        )
        .where(ProductTarget.user_id.in_(user_ids))
        .group_by(ProductTarget.user_id)
    )
    targets_by_user = {row[0]: (row[1], row[2]) for row in (await db.execute(targets_stmt)).all()}

    rows: list[AnalyticsTargetRow] = []
    for user_id, user_name in users:
        weekly, monthly = targets_by_user.get(user_id, (0, 0))
        target = float(weekly) if use_weekly else round(float(monthly) * proration, 1)
        credit = await _live_video_credit_for_owner(db, user_id, range_start, range_end)
        rows.append(
            AnalyticsTargetRow(
                user_id=user_id,
                user_name=user_name,
                credit=round(credit, 2),
                target=round(target, 2),
                pct=round(credit / target * 100, 1) if target else 0.0,
            )
        )
    return rows

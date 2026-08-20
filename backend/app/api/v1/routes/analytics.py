from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import (
    analytics_owner_scope,
    get_current_user,
    owner_scope_filter,
    require_analytics_access,
)
from app.db.models.enums import UserRole
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.analytics import AnalyticsResponse
from app.services.analytics import (
    _scoped_live_collab_ids,
    business_impact,
    cost_efficiency,
    performance_overview,
    pipeline_velocity,
    product_performance,
    show_cost_data,
    show_revenue_data,
    target_vs_achieved,
    what_is_working,
)

router = APIRouter(prefix="/analytics", tags=["analytics"], dependencies=[Depends(require_analytics_access)])


async def _resolve_scope(
    db: AsyncSession, user: User, scope: str, user_id: int | None
) -> tuple[list[int] | None, str]:
    """Returns (owner_ids, scope_label). Advisor/Marketer ignore client-
    supplied scope/user_id entirely -- their view is role-locked server-side,
    not trusted from the query string."""
    if user.role == UserRole.advisor:
        return [user.id], user.name
    if user.role == UserRole.marketer:
        return None, "All video performance"

    if scope == "user" and user_id is not None:
        owner_ids = await owner_scope_filter(user, db, user_id)
        target_user = await db.get(User, user_id)
        label = target_user.name if target_user else "Unknown user"
        return owner_ids, label

    if user.role == UserRole.supervisor:
        return await analytics_owner_scope(user, db), "My team"

    return await analytics_owner_scope(user, db), "All users"


@router.get("", response_model=AnalyticsResponse)
async def get_analytics(
    scope: Literal["overall", "team", "user"] = "overall",
    user_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AnalyticsResponse:
    now = datetime.now(timezone.utc)
    range_end = date_to or now
    range_start = date_from or (range_end - timedelta(days=30))

    owner_ids, scope_label = await _resolve_scope(db, user, scope, user_id)

    live_ids = await _scoped_live_collab_ids(db, owner_ids, range_start, range_end)
    show_cost = show_cost_data(user)
    show_revenue = show_revenue_data(user)

    business = await business_impact(db, owner_ids)
    if not show_revenue:
        business.revenue = None
        business.roas = None

    overview = await performance_overview(db, live_ids)
    if not show_cost:
        overview.cpv = None
        overview.cost_per_comment = None

    return AnalyticsResponse(
        scope_label=scope_label,
        date_range_label=f"{range_start:%d %b %Y} – {range_end:%d %b %Y}",
        live_video_count=len(live_ids),
        business_impact=business,
        performance_overview=overview,
        product_performance=await product_performance(db, live_ids, show_cost),
        cost_efficiency=await cost_efficiency(db, live_ids) if show_cost else None,
        what_is_working=await what_is_working(db, live_ids),
        pipeline_velocity=await pipeline_velocity(db, owner_ids, range_start, range_end),
        target_vs_achieved=await target_vs_achieved(db, owner_ids, range_start, range_end),
        show_cpv=show_cost,
        show_cost_efficiency=show_cost,
        show_revenue=show_revenue,
    )

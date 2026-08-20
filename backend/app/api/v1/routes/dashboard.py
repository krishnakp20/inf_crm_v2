from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, scoped_owner_ids
from app.db.models.enums import UserRole
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.approval_request import ApprovalRequestOut
from app.schemas.dashboard import DashboardResponse, KpiSummary
from app.services.dashboard import (
    _latest_announcement,
    get_dashboard,
    get_dashboard_approval_requests,
    get_followup_progress_today,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

_PLACEHOLDER_NOTICE = {
    UserRole.marketer: "Video KPIs are coming in a later phase.",
    UserRole.editor: "Editor queue is coming in a later phase.",
}


@router.get("", response_model=DashboardResponse)
async def dashboard(
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DashboardResponse:
    if user.role in (UserRole.marketer, UserRole.editor):
        return DashboardResponse(
            kpis=KpiSummary(
                total_creators=0,
                new_this_month=0,
                active_reels=0,
                active_reels_growth_pct=0.0,
                active_reels_added_this_month=0,
                partnership_pending=0,
                ads_live=0,
                follow_ups_completed_today=0,
                follow_ups_total_today=0,
            ),
            funnel=[],
            funnel_moved_this_week=0,
            targets=[],
            product_performance=[],
            approval_requests=[],
            activity=[],
            announcement=await _latest_announcement(db, [user.id]),
            placeholder_notice=_PLACEHOLDER_NOTICE[user.role],
        )
    owner_ids = await scoped_owner_ids(user, db)
    return await get_dashboard(db, owner_ids, date_from, date_to)


@router.get("/notifications", response_model=list[ApprovalRequestOut])
async def notifications(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ApprovalRequestOut]:
    """Pending approval requests scoped to this user -- same list and scope
    the Dashboard's Approval requests panel shows, surfaced in the header
    bell so a user doesn't need to be on the Dashboard to see what's
    waiting on them.
    """
    if user.role in (UserRole.marketer, UserRole.editor):
        return []
    owner_ids = await scoped_owner_ids(user, db)
    return await get_dashboard_approval_requests(db, owner_ids, limit=50)


@router.get("/my-progress")
async def my_progress(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, int]:
    completed, total = await get_followup_progress_today(db, datetime.now(timezone.utc), [user.id])
    return {"completed": completed, "total": total}

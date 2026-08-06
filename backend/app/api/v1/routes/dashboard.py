from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, scoped_owner_id
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.dashboard import DashboardResponse
from app.services.dashboard import get_dashboard, get_dashboard_approval_requests, get_followup_progress_today

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardResponse)
async def dashboard(
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DashboardResponse:
    return await get_dashboard(db, scoped_owner_id(user), date_from, date_to)


@router.get("/notifications-count")
async def notifications_count(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, int]:
    items = await get_dashboard_approval_requests(db, scoped_owner_id(user), limit=50)
    return {"count": len(items)}


@router.get("/my-progress")
async def my_progress(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, int]:
    completed, total = await get_followup_progress_today(db, datetime.now(timezone.utc), user.id)
    return {"completed": completed, "total": total}

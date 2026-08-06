from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.models.enums import FollowUpStatus, UserRole
from app.db.models.follow_up import FollowUp
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.follow_up import FollowUpOut

router = APIRouter(prefix="/follow-ups", tags=["follow-ups"])


@router.post("/{follow_up_id}/complete", response_model=FollowUpOut)
async def complete_follow_up(
    follow_up_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FollowUp:
    follow_up = await db.get(FollowUp, follow_up_id)
    if follow_up is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Follow-up not found")
    if user.role == UserRole.advisor and follow_up.assigned_to != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Follow-up not found")

    follow_up.status = FollowUpStatus.done
    follow_up.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(follow_up)
    return follow_up

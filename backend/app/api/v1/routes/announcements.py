from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin
from app.db.models.announcement import Announcement
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.announcement import AnnouncementCreate
from app.schemas.dashboard import AnnouncementOut

router = APIRouter(prefix="/announcements", tags=["announcements"])


@router.get("", response_model=list[AnnouncementOut])
async def list_announcements(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[AnnouncementOut]:
    result = await db.execute(
        select(Announcement, User)
        .join(User, User.id == Announcement.posted_by)
        .order_by(Announcement.created_at.desc())
    )
    return [
        AnnouncementOut(
            id=a.id,
            title=a.title,
            body=a.body,
            audience=a.audience,
            audience_user_ids=a.audience_user_ids,
            expires_at=a.expires_at,
            pinned=a.pinned,
            posted_by_name=poster.name,
            created_at=a.created_at,
        )
        for a, poster in result.all()
    ]


@router.post("", response_model=AnnouncementOut, status_code=status.HTTP_201_CREATED)
async def create_announcement(
    payload: AnnouncementCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
) -> AnnouncementOut:
    announcement = Announcement(
        title=payload.title,
        body=payload.body,
        posted_by=user.id,
        audience=payload.audience,
        audience_user_ids=payload.audience_user_ids if payload.audience == "selected" else None,
        expires_at=payload.expires_at,
        pinned=payload.pinned,
    )
    db.add(announcement)
    await db.commit()
    await db.refresh(announcement)
    return AnnouncementOut(
        id=announcement.id,
        title=announcement.title,
        body=announcement.body,
        audience=announcement.audience,
        audience_user_ids=announcement.audience_user_ids,
        expires_at=announcement.expires_at,
        pinned=announcement.pinned,
        posted_by_name=user.name,
        created_at=announcement.created_at,
    )


@router.delete("/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_announcement(
    announcement_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> None:
    announcement = await db.get(Announcement, announcement_id)
    if announcement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
    await db.delete(announcement)
    await db.commit()

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_admin
from app.db.models.content_bucket import ContentBucket
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.content_bucket import ContentBucketCreate, ContentBucketOut

router = APIRouter(prefix="/content-buckets", tags=["content-buckets"])


@router.get("", response_model=list[ContentBucketOut])
async def list_content_buckets(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ContentBucket]:
    result = await db.execute(select(ContentBucket).order_by(ContentBucket.name))
    return list(result.scalars().all())


@router.post("", response_model=ContentBucketOut, status_code=status.HTTP_201_CREATED)
async def create_content_bucket(
    payload: ContentBucketCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> ContentBucket:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Content bucket name is required.")
    existing = await db.execute(select(ContentBucket).where(ContentBucket.name == name))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This content bucket already exists.")

    bucket = ContentBucket(name=name)
    db.add(bucket)
    await db.commit()
    await db.refresh(bucket)
    return bucket


@router.delete("/{bucket_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_content_bucket(
    bucket_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> None:
    bucket = await db.get(ContentBucket, bucket_id)
    if bucket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content bucket not found")
    await db.delete(bucket)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This content bucket is used by existing tickets and can't be removed.",
        )

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_admin
from app.db.models.creator_category_tier import CreatorCategoryTier
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.creator_category_tier import CreatorCategoryTierCreate, CreatorCategoryTierOut

router = APIRouter(prefix="/creator-category-tiers", tags=["creator-category-tiers"])


@router.get("", response_model=list[CreatorCategoryTierOut])
async def list_creator_category_tiers(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[CreatorCategoryTier]:
    result = await db.execute(select(CreatorCategoryTier).order_by(CreatorCategoryTier.min_followers))
    return list(result.scalars().all())


@router.post("", response_model=CreatorCategoryTierOut, status_code=status.HTTP_201_CREATED)
async def create_creator_category_tier(
    payload: CreatorCategoryTierCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> CreatorCategoryTier:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category name is required.")
    existing = await db.execute(select(CreatorCategoryTier).where(CreatorCategoryTier.name == name))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This category already exists.")

    tier = CreatorCategoryTier(name=name, min_followers=payload.min_followers, max_followers=payload.max_followers)
    db.add(tier)
    await db.commit()
    await db.refresh(tier)
    return tier


@router.delete("/{tier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_creator_category_tier(
    tier_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> None:
    tier = await db.get(CreatorCategoryTier, tier_id)
    if tier is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    await db.delete(tier)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Could not remove this category.")

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_admin
from app.db.models.content_category import ContentCategory
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.content_category import ContentCategoryCreate, ContentCategoryOut

router = APIRouter(prefix="/content-categories", tags=["content-categories"])


@router.get("", response_model=list[ContentCategoryOut])
async def list_content_categories(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ContentCategory]:
    result = await db.execute(select(ContentCategory).order_by(ContentCategory.name))
    return list(result.scalars().all())


@router.post("", response_model=ContentCategoryOut, status_code=status.HTTP_201_CREATED)
async def create_content_category(
    payload: ContentCategoryCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> ContentCategory:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category name is required.")
    existing = await db.execute(select(ContentCategory).where(ContentCategory.name == name))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This category already exists.")

    category = ContentCategory(name=name)
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_content_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> None:
    category = await db.get(ContentCategory, category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    await db.delete(category)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This category is used by existing creators and can't be removed.",
        )

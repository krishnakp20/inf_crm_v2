from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_admin
from app.db.models.language import Language
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.language import LanguageCreate, LanguageOut

router = APIRouter(prefix="/languages", tags=["languages"])


@router.get("", response_model=list[LanguageOut])
async def list_languages(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Language]:
    result = await db.execute(select(Language).order_by(Language.name))
    return list(result.scalars().all())


@router.post("", response_model=LanguageOut, status_code=status.HTTP_201_CREATED)
async def create_language(
    payload: LanguageCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> Language:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Language name is required.")
    existing = await db.execute(select(Language).where(Language.name == name))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This language already exists.")

    language = Language(name=name)
    db.add(language)
    await db.commit()
    await db.refresh(language)
    return language


@router.delete("/{language_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_language(
    language_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> None:
    language = await db.get(Language, language_id)
    if language is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Language not found")
    await db.delete(language)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This language is used by existing collaborations and can't be removed.",
        )

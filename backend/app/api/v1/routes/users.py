from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user, require_admin
from app.core.security import hash_password, verify_password
from app.db.models.enums import UserRole
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.user import ChangePasswordRequest, UserCreate, UserLimits, UserOut

router = APIRouter(prefix="/users", tags=["users"])


async def _active_advisor_count(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count()).select_from(User).where(User.role == UserRole.advisor, User.is_active.is_(True))
    )
    return result.scalar_one()


@router.get("/limits", response_model=UserLimits)
async def get_limits(_: User = Depends(require_admin)) -> UserLimits:
    return UserLimits(max_active_advisors=settings.max_active_advisors)


@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)) -> User:
    return user


@router.get("", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[User]:
    result = await db.execute(select(User).order_by(User.name))
    return list(result.scalars().all())


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> User:
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    if payload.role == UserRole.advisor and await _active_advisor_count(db) >= settings.max_active_advisors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum of {settings.max_active_advisors} active advisors reached. Deactivate one first.",
        )

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        must_change_password=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/{user_id}/deactivate", response_model=UserOut)
async def deactivate_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
) -> User:
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if target.role != UserRole.advisor:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only advisor accounts can be deactivated.")
    if target.id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't deactivate your own account.")

    target.is_active = False
    await db.commit()
    await db.refresh(target)
    return target


@router.post("/{user_id}/activate", response_model=UserOut)
async def activate_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> User:
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if target.role != UserRole.advisor:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only advisor accounts can be reactivated.")

    if not target.is_active and await _active_advisor_count(db) >= settings.max_active_advisors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum of {settings.max_active_advisors} active advisors reached. Deactivate one first.",
        )

    target.is_active = True
    await db.commit()
    await db.refresh(target)
    return target


@router.post("/me/change-password", response_model=UserOut)
async def change_password(
    payload: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> User:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")

    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    await db.commit()
    await db.refresh(user)
    return user

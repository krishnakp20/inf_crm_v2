from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user, require_admin
from app.core.security import hash_password, verify_password
from app.db.models.collaboration import Collaboration
from app.db.models.creator import Creator
from app.db.models.enums import CollabStage, OwnershipEventType, UserRole
from app.db.models.ownership_event import OwnershipEvent
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.user import (
    ChangePasswordRequest,
    DeactivateUserRequest,
    DeactivationImpact,
    UserCreate,
    UserLimits,
    UserOut,
    UserUpdate,
)

router = APIRouter(prefix="/users", tags=["users"])


async def _active_advisor_count(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count()).select_from(User).where(User.role == UserRole.advisor, User.is_active.is_(True))
    )
    return result.scalar_one()


async def _validate_supervisor_id(db: AsyncSession, supervisor_id: int) -> None:
    supervisor = await db.get(User, supervisor_id)
    if supervisor is None or supervisor.role != UserRole.supervisor:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a valid supervisor.")


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

    supervisor_id = payload.supervisor_id if payload.role == UserRole.advisor else None
    if supervisor_id is not None:
        await _validate_supervisor_id(db, supervisor_id)

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        supervisor_id=supervisor_id,
        must_change_password=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> User:
    """Also how a promotion/demotion is done -- someone moving from
    Influencer Agent to Supervisor (or any other role change) has their
    existing role updated in place rather than needing a brand-new
    account. Admin accounts are exempt entirely, matching the existing
    "can't be deactivated" protection."""
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    fields_set = payload.model_fields_set

    if "role" in fields_set and payload.role is not None and payload.role != target.role:
        if target.role == UserRole.admin or payload.role == UserRole.admin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Admin accounts can't be changed here."
            )
        if (
            payload.role == UserRole.advisor
            and target.is_active
            and await _active_advisor_count(db) >= settings.max_active_advisors
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum of {settings.max_active_advisors} active advisors reached. Deactivate one first.",
            )
        if target.role == UserRole.supervisor:
            # Moving them off Supervisor -- don't leave any Influencer
            # Agents pointing at a supervisor_id that's no longer one.
            await db.execute(update(User).where(User.supervisor_id == target.id).values(supervisor_id=None))
        target.role = payload.role
        if payload.role != UserRole.advisor:
            target.supervisor_id = None

    if "supervisor_id" in fields_set:
        effective_role = payload.role if "role" in fields_set and payload.role is not None else target.role
        if effective_role != UserRole.advisor:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Only Influencer Agents can have a supervisor."
            )
        if payload.supervisor_id is not None:
            if payload.supervisor_id == target.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="A user can't supervise themselves."
                )
            await _validate_supervisor_id(db, payload.supervisor_id)
        target.supervisor_id = payload.supervisor_id

    await db.commit()
    await db.refresh(target)
    return target


@router.get("/{user_id}/deactivation-impact", response_model=DeactivationImpact)
async def deactivation_impact(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> DeactivationImpact:
    """What deactivating this user would leave stranded -- their still-active
    creators and collaborations, i.e. exactly what needs either archiving or
    reassigning. Already-archived creators and Dead Leads collabs need no
    decision, so they're not counted."""
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    creator_count = (
        await db.execute(
            select(func.count())
            .select_from(Creator)
            .where(Creator.owner_id == user_id, Creator.is_archived.is_(False))
        )
    ).scalar_one()
    active_collab_count = (
        await db.execute(
            select(func.count())
            .select_from(Collaboration)
            .where(Collaboration.owner_id == user_id, Collaboration.stage != CollabStage.dead_leads)
        )
    ).scalar_one()
    return DeactivationImpact(creator_count=creator_count, active_collab_count=active_collab_count)


@router.post("/{user_id}/deactivate", response_model=UserOut)
async def deactivate_user(
    user_id: int,
    payload: DeactivateUserRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
) -> User:
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if target.role == UserRole.admin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin accounts can't be deactivated.")

    now = datetime.now(timezone.utc)

    if payload.action == "archive":
        if not payload.reason or not payload.reason.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="A note is required to archive their leads."
            )
        reason = payload.reason.strip()
        creators = (
            await db.execute(select(Creator).where(Creator.owner_id == user_id, Creator.is_archived.is_(False)))
        ).scalars().all()
        for creator in creators:
            creator.is_archived = True
            creator.archived_at = now
            creator.archive_reason = reason
            db.add(
                OwnershipEvent(
                    creator_id=creator.id,
                    user_id=creator.owner_id,
                    event_type=OwnershipEventType.revoked,
                    actor_id=user.id,
                    note=reason,
                )
            )
    elif payload.action == "reassign":
        if payload.new_owner_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose an advisor to reassign to.")
        new_owner = await db.get(User, payload.new_owner_id)
        if new_owner is None or new_owner.role != UserRole.advisor or not new_owner.is_active or new_owner.id == user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a different, active advisor to reassign to."
            )
        creators = (await db.execute(select(Creator).where(Creator.owner_id == user_id))).scalars().all()
        for creator in creators:
            creator.owner_id = new_owner.id
            db.add(
                OwnershipEvent(
                    creator_id=creator.id,
                    user_id=new_owner.id,
                    event_type=OwnershipEventType.admin_assigned,
                    actor_id=user.id,
                )
            )
        await db.execute(
            update(Collaboration)
            .where(Collaboration.owner_id == user_id)
            .values(owner_id=new_owner.id, last_activity_at=now)
        )

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
    if target.role == UserRole.admin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin accounts are always active.")

    if (
        target.role == UserRole.advisor
        and not target.is_active
        and await _active_advisor_count(db) >= settings.max_active_advisors
    ):
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

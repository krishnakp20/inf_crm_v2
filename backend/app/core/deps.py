from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.models.enums import UserRole
from app.db.models.user import User
from app.db.session import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise credentials_error

    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_error

    user = await db.get(User, int(user_id))
    if user is None:
        raise credentials_error
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated.",
        )
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


async def scoped_owner_ids(user: User, db: AsyncSession) -> list[int] | None:
    """Role-aware data scope.

    None = unrestricted (Admin). A list restricts to those owner ids.
    Advisor -> [self.id]. Supervisor -> [self.id, *their team's advisor ids].
    """
    if user.role == UserRole.admin:
        return None
    if user.role == UserRole.advisor:
        return [user.id]
    if user.role == UserRole.supervisor:
        result = await db.execute(select(User.id).where(User.supervisor_id == user.id))
        team_ids = [row[0] for row in result.all()]
        return [user.id, *team_ids]
    # Marketer/Editor have no creator-workspace scope at all.
    return []


async def owner_scope_filter(
    user: User, db: AsyncSession, requested_owner_id: int | None
) -> list[int] | None:
    """Merge a role's data scope with an optional explicit ?owner_id= filter.

    Returns None for "no restriction" (only possible for an Admin with no
    explicit filter). Returns [] when the request asks for someone outside
    the caller's scope -- callers should treat that as zero rows, not a 403.
    """
    scope = await scoped_owner_ids(user, db)
    if requested_owner_id is None:
        return scope
    if scope is None:
        return [requested_owner_id]
    return [requested_owner_id] if requested_owner_id in scope else []


async def require_creator_workspace_access(user: User = Depends(get_current_user)) -> User:
    """Hard-blocks Marketer/Editor from the creator workspace (Database/My Creators/etc)."""
    if user.role in (UserRole.marketer, UserRole.editor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not available for this role.",
        )
    return user


async def require_campaign_access(user: User = Depends(get_current_user)) -> User:
    """Hard-blocks Editor from Campaigns -- their real work there ("Links")
    belongs to Partnership Hub, not yet built."""
    if user.role == UserRole.editor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not available for this role.",
        )
    return user


async def analytics_owner_scope(user: User, db: AsyncSession) -> list[int] | None:
    """Analytics-specific override of scoped_owner_ids: Marketer sees
    unrestricted (all-owner) data here, unlike every other module where
    scoped_owner_ids returns [] for Marketer/Editor. Confirmed against the
    reference site's role switcher -- Marketer's Analytics view has no tabs
    and shows aggregate data spanning every advisor. Editor never reaches
    this call -- blocked upstream by require_analytics_access."""
    if user.role in (UserRole.admin, UserRole.marketer):
        return None
    return await scoped_owner_ids(user, db)


async def require_analytics_access(user: User = Depends(get_current_user)) -> User:
    """Hard-blocks Editor from Analytics -- confirmed against the reference
    site's role switcher (Editor's nav never showed Analytics)."""
    if user.role == UserRole.editor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not available for this role.",
        )
    return user

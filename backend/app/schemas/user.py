from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from app.db.models.enums import UserRole


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.advisor
    supervisor_id: int | None = None


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: UserRole
    supervisor_id: int | None
    must_change_password: bool
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    supervisor_id: int | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class UserLimits(BaseModel):
    max_active_advisors: int


class DeactivationImpact(BaseModel):
    # Only what actually needs a decision -- already-archived creators and
    # Dead Leads collabs stay exactly as they are either way.
    creator_count: int
    active_collab_count: int


class DeactivateUserRequest(BaseModel):
    # None when there's nothing to move (deactivation impact was zero) --
    # the frontend skips the prompt entirely in that case.
    action: Literal["archive", "reassign"] | None = None
    reason: str | None = None
    new_owner_id: int | None = None

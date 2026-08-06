from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.db.models.enums import UserRole


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.advisor


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: UserRole
    must_change_password: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)

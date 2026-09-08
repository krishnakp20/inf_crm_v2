from datetime import datetime

from pydantic import BaseModel, field_validator


class CreatorCategoryTierCreate(BaseModel):
    name: str
    min_followers: int
    max_followers: int | None = None

    @field_validator("min_followers")
    @classmethod
    def min_nonneg(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Minimum followers can't be negative.")
        return v

    @field_validator("max_followers")
    @classmethod
    def max_after_min(cls, v: int | None, info) -> int | None:
        min_followers = info.data.get("min_followers")
        if v is not None and min_followers is not None and v <= min_followers:
            raise ValueError("Maximum followers must be greater than the minimum.")
        return v


class CreatorCategoryTierOut(BaseModel):
    id: int
    name: str
    min_followers: int
    max_followers: int | None
    created_at: datetime

    class Config:
        from_attributes = True

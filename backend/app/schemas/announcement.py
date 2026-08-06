from datetime import date

from pydantic import BaseModel, Field


class AnnouncementCreate(BaseModel):
    title: str = Field(max_length=60)
    body: str
    audience: str = "everyone"
    audience_user_ids: list[int] | None = None
    expires_at: date | None = None
    pinned: bool = True

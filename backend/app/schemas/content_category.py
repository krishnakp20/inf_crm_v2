from datetime import datetime

from pydantic import BaseModel


class ContentCategoryCreate(BaseModel):
    name: str


class ContentCategoryOut(BaseModel):
    id: int
    name: str
    created_at: datetime

    class Config:
        from_attributes = True

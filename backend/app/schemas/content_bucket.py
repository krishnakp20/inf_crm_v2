from datetime import datetime

from pydantic import BaseModel


class ContentBucketCreate(BaseModel):
    name: str


class ContentBucketOut(BaseModel):
    id: int
    name: str
    created_at: datetime

    class Config:
        from_attributes = True

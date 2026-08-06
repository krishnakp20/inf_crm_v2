from datetime import datetime

from pydantic import BaseModel


class ProductCreate(BaseModel):
    name: str
    owner_id: int
    target_videos: int = 0


class ProductUpdate(BaseModel):
    name: str | None = None
    owner_id: int | None = None
    target_videos: int | None = None


class ProductOut(BaseModel):
    id: int
    name: str
    owner_id: int
    target_videos: int
    created_at: datetime

    class Config:
        from_attributes = True


class ProductPerformance(ProductOut):
    owner_name: str
    videos_live: float

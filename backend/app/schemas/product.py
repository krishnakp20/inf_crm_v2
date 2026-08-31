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


class ProductVariantCreate(BaseModel):
    name: str


class ProductVariantOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class ProductOut(BaseModel):
    id: int
    name: str
    owner_id: int
    target_videos: int
    created_at: datetime
    variants: list[ProductVariantOut] = []

    class Config:
        from_attributes = True


class ProductPerformance(ProductOut):
    owner_name: str  # whoever's account this product row was created under -- NOT a performance signal
    videos_live: float
    # Real per-advisor breakdown of this product's live-video credit, keyed
    # by advisor name -- who actually delivered the videos, unlike owner_name
    # above. Empty for advisors with zero credit on this product.
    credit_by_owner: dict[str, float]

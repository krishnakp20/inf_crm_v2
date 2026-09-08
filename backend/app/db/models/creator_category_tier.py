from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CreatorCategoryTier(Base):
    """Admin-defined follower-count bands (e.g. "Nano": 1,000-10,000) used
    to classify a creator by their current followers_count. Fully separate
    from Creator.category (free-text content niche, e.g. "Beauty") -- this
    is a second, independent classification. A creator's tier is never
    stored; it's resolved on the fly against these ranges wherever shown,
    so it always reflects the current follower count and the current
    tier definitions."""

    __tablename__ = "creator_category_tiers"
    __table_args__ = (CheckConstraint("min_followers >= 0", name="ck_creator_category_tier_min_nonneg"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60), unique=True)
    min_followers: Mapped[int] = mapped_column(Integer)
    # None = unbounded ("500,000+").
    max_followers: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

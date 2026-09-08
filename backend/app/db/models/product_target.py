from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ProductTarget(Base):
    __tablename__ = "product_targets"
    __table_args__ = (UniqueConstraint("user_id", "product_id", name="uq_product_target_user_product"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    # The agent sets only this -- weekly is never stored, always derived at
    # read time from monthly_target and the current month's day count (see
    # services/product_targets.py:derive_weekly_target), so it can't go
    # stale across a month boundary the way a stored value would.
    monthly_target: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

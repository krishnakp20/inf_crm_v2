from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ProductTarget(Base):
    __tablename__ = "product_targets"
    __table_args__ = (
        UniqueConstraint("user_id", "product_id", "month", name="uq_product_target_user_product_month"),
        # NULLs are distinct to Postgres, so the standing (NULL-month) row needs its own partial unique index.
        Index(
            "uq_product_target_standing",
            "user_id",
            "product_id",
            unique=True,
            postgresql_where=text("month IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    # The agent sets only this -- weekly is never stored, always derived at
    # read time from monthly_target and the current month's day count (see
    # services/product_targets.py:derive_weekly_target), so it can't go
    # stale across a month boundary the way a stored value would.
    monthly_target: Mapped[int] = mapped_column(Integer, default=0)
    # First day of the month this target is for. NULL = the standing target:
    # it applies to every month that has no figure of its own (and is what every
    # target set before month-wise targets existed became). For a month with no
    # row, the latest earlier month's row carries forward -- see
    # services/product_targets.py:effective_targets.
    month: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

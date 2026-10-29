from pydantic import BaseModel


class ProductTargetSet(BaseModel):
    product_id: int
    monthly_target: int
    # 'YYYY-MM': the month this target is for. Omitted = the standing target
    # (kept for older callers; the app always sends a month).
    month: str | None = None
    # Admin-only -- set/view another user's targets instead of your own.
    # Silently ignored (defaults to the caller) for every other role.
    user_id: int | None = None


class ProductTargetOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    monthly_target: int
    # The month this figure is shown for ('YYYY-MM'), where it came from, and
    # -- when it is carried forward -- which month it was set for.
    month: str
    source: str  # "month" | "carried" | "standing"
    source_month: str | None = None
    # Derived, never stored -- see services/product_targets.py:derive_weekly_target.
    weekly_target: int
    weekly_progress: float
    monthly_progress: float


class ProductTargetMonthOut(BaseModel):
    """One month that has targets of its own, for the month-wise list."""

    month: str
    total_target: int
    product_count: int

from pydantic import BaseModel


class ProductTargetSet(BaseModel):
    product_id: int
    monthly_target: int
    # Admin-only -- set/view another user's targets instead of your own.
    # Silently ignored (defaults to the caller) for every other role.
    user_id: int | None = None


class ProductTargetOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    monthly_target: int
    # Derived, never stored -- see services/product_targets.py:derive_weekly_target.
    weekly_target: int
    weekly_progress: float
    monthly_progress: float

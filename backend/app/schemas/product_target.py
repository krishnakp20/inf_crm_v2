from pydantic import BaseModel


class ProductTargetSet(BaseModel):
    product_id: int
    monthly_target: int


class ProductTargetOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    monthly_target: int
    # Derived, never stored -- see services/product_targets.py:derive_weekly_target.
    weekly_target: int
    weekly_progress: float
    monthly_progress: float

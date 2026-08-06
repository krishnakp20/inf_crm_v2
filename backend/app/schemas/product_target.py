from pydantic import BaseModel


class ProductTargetSet(BaseModel):
    product_id: int
    weekly_target: int
    monthly_target: int


class ProductTargetOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    weekly_target: int
    monthly_target: int
    weekly_progress: float
    monthly_progress: float

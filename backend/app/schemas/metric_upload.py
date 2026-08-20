from datetime import datetime

from pydantic import BaseModel

from app.db.models.enums import MetricImportStatus


class MetricUploadResult(BaseModel):
    total_rows: int
    updated: int
    skipped: int
    errors: list[str]


class MetricImportOut(BaseModel):
    id: int
    filename: str
    total_rows: int
    updated_rows: int
    skipped_rows: int
    status: MetricImportStatus
    uploaded_by_name: str
    created_at: datetime

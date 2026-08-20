from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models.enums import MetricImportStatus


class MetricImport(Base):
    __tablename__ = "metric_imports"

    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    total_rows: Mapped[int] = mapped_column(Integer, default=0)
    updated_rows: Mapped[int] = mapped_column(Integer, default=0)
    skipped_rows: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[MetricImportStatus] = mapped_column(
        Enum(MetricImportStatus, name="metric_import_status"), default=MetricImportStatus.completed
    )
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

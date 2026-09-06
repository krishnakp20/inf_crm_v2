from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    target_videos: Mapped[int] = mapped_column(Integer, default=0)
    # Disabled products stay fully intact for every collaboration that
    # already references them (name, shade, history, reports -- untouched);
    # they're just excluded from product pickers/filters going forward.
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

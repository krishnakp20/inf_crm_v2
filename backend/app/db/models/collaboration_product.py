from sqlalchemy import Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CollaborationProduct(Base):
    __tablename__ = "collaboration_products"
    __table_args__ = (UniqueConstraint("collaboration_id", "product_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    collaboration_id: Mapped[int] = mapped_column(ForeignKey("collaborations.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    is_live_attributed: Mapped[bool] = mapped_column(Boolean, default=False)

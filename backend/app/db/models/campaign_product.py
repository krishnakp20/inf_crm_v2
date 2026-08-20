from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CampaignProduct(Base):
    __tablename__ = "campaign_products"
    __table_args__ = (UniqueConstraint("campaign_id", "product_id", name="uq_campaign_product"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("campaigns.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    # Informational "planning goal" -- not required to sum to Campaign.target_videos.
    target_videos: Mapped[int] = mapped_column(Integer, default=0)

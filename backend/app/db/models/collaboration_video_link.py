from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models.enums import Platform


class CollaborationVideoLink(Base):
    """Additional (platform, link) pairs beyond the first -- a Collaboration
    can go live on more than one platform (e.g. an Instagram Reel and a
    YouTube video for the same deal). The first pair still lives on
    Collaboration.video_link/.platform directly (keeps Metric Upload's
    existing POC-code+video-link matching and Campaigns' "Add video" flow
    unchanged); this table holds the 2nd, 3rd, ... entries."""

    __tablename__ = "collaboration_video_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    collaboration_id: Mapped[int] = mapped_column(
        ForeignKey("collaborations.id", ondelete="CASCADE"), index=True
    )
    platform: Mapped[Platform] = mapped_column(Enum(Platform, name="platform"))
    url: Mapped[str] = mapped_column(String(300))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

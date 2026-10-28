from datetime import date, datetime

from pydantic import BaseModel

from app.schemas.approval_request import ApprovalRequestOut
from app.schemas.product import ProductPerformance


class NotificationOut(BaseModel):
    kind: str  # "approval" | "approval_resolved" | "partnership" | "deadline_warning"
    id: int  # source row id -- unique within kind, not across kinds
    # The bell shows: agent (who is handling the card) -> influencer -> the page it opens.
    agent_name: str
    creator_name: str
    creator_handle: str
    page_name: str
    subtitle: str
    priority: str  # "high" | "normal"
    created_at: datetime
    link: str


class KpiSummary(BaseModel):
    total_creators: int
    active_reels: int
    partnership_pending: int
    ads_live: int
    follow_ups_completed_today: int
    follow_ups_total_today: int


class NameCount(BaseModel):
    name: str
    count: int


class ActiveReelRow(BaseModel):
    collab_id: int
    collab_code: str
    creator_name: str
    creator_handle: str
    products: str  # primary product first, comma separated
    agent_name: str  # the user who owns the card the reel is live on
    live_date: date | None
    video_link: str | None
    poc_code: str | None


class ActiveReelsOut(BaseModel):
    """Drill-down behind the Dashboard "Active reels" tile: exactly the videos
    counted by KpiSummary.active_reels, so total always equals the tile."""

    total: int
    by_agent: list[NameCount]
    rows: list[ActiveReelRow]


class CreatorAddedRow(BaseModel):
    creator_id: int
    name: str
    instagram_handle: str
    owner_name: str
    category: str
    followers_count: int
    created_at: datetime


class CreatorsAddedOut(BaseModel):
    """Drill-down behind the Dashboard "Total creators" tile: exactly the
    creators counted by KpiSummary.total_creators."""

    total: int
    by_owner: list[NameCount]
    rows: list[CreatorAddedRow]


class FunnelStage(BaseModel):
    stage: str
    label: str
    count: int
    conversion_pct: float | None


class TargetRow(BaseModel):
    user_id: int
    name: str
    weekly_completed: float
    weekly_due: int
    weekly_pct: float
    monthly_completed: float
    monthly_due: int
    monthly_pct: float


class ActivityItem(BaseModel):
    headline: str
    detail: str
    created_at: datetime


class AnnouncementOut(BaseModel):
    id: int
    title: str
    body: str
    audience: str
    audience_user_ids: list[int] | None
    expires_at: date | None
    pinned: bool
    posted_by_name: str
    created_at: datetime


class DashboardResponse(BaseModel):
    kpis: KpiSummary
    funnel: list[FunnelStage]
    funnel_moved_this_week: int
    targets: list[TargetRow]
    product_performance: list[ProductPerformance]
    approval_requests: list[ApprovalRequestOut]
    activity: list[ActivityItem]
    announcement: AnnouncementOut | None
    placeholder_notice: str | None = None

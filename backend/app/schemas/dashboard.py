from datetime import date, datetime

from pydantic import BaseModel

from app.schemas.approval_request import ApprovalRequestOut
from app.schemas.product import ProductPerformance


class KpiSummary(BaseModel):
    total_creators: int
    new_this_month: int
    active_reels: int
    active_reels_growth_pct: float
    active_reels_added_this_month: int
    partnership_pending: int
    ads_live: int
    follow_ups_completed_today: int
    follow_ups_total_today: int


class FunnelStage(BaseModel):
    stage: str
    label: str
    count: int
    conversion_pct: float | None


class TargetRow(BaseModel):
    user_id: int
    name: str
    weekly_completed: int
    weekly_due: int
    weekly_pct: float
    monthly_completed: int
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

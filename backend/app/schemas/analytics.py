from pydantic import BaseModel

from app.schemas.dashboard import FunnelStage


class OverviewMetrics(BaseModel):
    new_leads: int
    reply_rate_pct: float
    commercial_lock_rate_pct: float
    avg_time_to_lock_days: float | None
    content_went_live: int


class LeadConversion(BaseModel):
    funnel: list[FunnelStage]
    overall_conversion_pct: float


class StageAgeing(BaseModel):
    stage: str
    label: str
    open_records: int
    avg_age_days: float


class CostMetrics(BaseModel):
    total_commercial_locked: float
    cost_per_live_video: float | None
    cost_per_1k_views: float | None
    total_views: int
    avg_engagement_pct: float


class TeamPerformanceRow(BaseModel):
    user_id: int
    name: str
    leads_worked: int
    reply_rate_pct: float
    deals_locked: int
    content_live: int
    overdue: int
    avg_speed_days: float | None
    crm_health_pct: float

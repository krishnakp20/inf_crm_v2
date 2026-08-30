from pydantic import BaseModel


class AnalyticsBusinessImpact(BaseModel):
    revenue: float | None  # Admin-only; null = not-yet-wired Metric Upload placeholder
    roas: float | None  # Admin-only; null = placeholder
    ads_live: int  # all roles; Closed & Live tickets in Partnership Hub


class AnalyticsPerformanceOverview(BaseModel):
    live_videos: int
    total_views: int
    cpv: float | None  # null for Marketer, or when views==0
    hit_rate_pct: float
    hits: int
    total_live_videos_for_hit_rate: int
    cost_per_comment: float | None  # null for Marketer, or when comments==0
    total_comments: int


class AnalyticsProductPerformanceRow(BaseModel):
    product_id: int
    product_name: str
    videos: float  # fractional live-video credit
    views: int
    comments: int
    cost_per_comment: float | None  # null for Marketer


class AnalyticsCostEfficiency(BaseModel):
    avg_creator_cost: float | None
    total_creator_cost: float
    cost_per_hit: float | None


class AnalyticsCommercialLocked(BaseModel):
    total_locked: float  # sum of commercial_amount for every collab locked in the period
    achieved: float  # same, restricted to collabs currently at stage=live
    committed: float  # same, restricted to collabs not currently live (total_locked - achieved)


class AnalyticsWhatIsWorkingRow(BaseModel):
    rank: int
    dimension_value: str
    videos: int
    views: int
    comments: int
    hit_rate_pct: float


class AnalyticsWhatIsWorking(BaseModel):
    content_bucket: list[AnalyticsWhatIsWorkingRow]
    language: list[AnalyticsWhatIsWorkingRow]
    creator_category: list[AnalyticsWhatIsWorkingRow]


class AnalyticsPipelineVelocityRow(BaseModel):
    label: str
    avg_days: float | None
    delta_days: float | None  # negative = faster than the prior equivalent period
    sample_size: int


class AnalyticsTargetRow(BaseModel):
    user_id: int
    user_name: str
    credit: float
    target: float
    pct: float


class AnalyticsResponse(BaseModel):
    scope_label: str
    date_range_label: str
    live_video_count: int
    business_impact: AnalyticsBusinessImpact
    performance_overview: AnalyticsPerformanceOverview
    product_performance: list[AnalyticsProductPerformanceRow]
    cost_efficiency: AnalyticsCostEfficiency | None  # None entirely for Marketer
    commercial_locked: AnalyticsCommercialLocked | None  # None entirely for Marketer
    what_is_working: AnalyticsWhatIsWorking
    pipeline_velocity: list[AnalyticsPipelineVelocityRow]
    target_vs_achieved: list[AnalyticsTargetRow]
    show_cpv: bool
    show_cost_efficiency: bool
    show_revenue: bool

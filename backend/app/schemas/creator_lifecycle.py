from datetime import datetime

from pydantic import BaseModel


class LifecycleTrackStep(BaseModel):
    label: str
    status: str  # "complete" | "current" | "upcoming"


class LifecycleTimelineEntry(BaseModel):
    icon: str  # "stage" | "video" | "commercial" | "ownership" | "added"
    title: str
    timestamp_label: str
    description: str


class LifecycleSummary(BaseModel):
    added_at: datetime
    current_stage_label: str
    videos_delivered: int
    last_video_live_at: datetime | None
    last_commercial_locked: float | None


class VideoHistoryRow(BaseModel):
    product_name: str
    live_date: datetime
    cost: float | None
    views: int | None
    comments: int | None
    status: str  # "Live" | "Archived"


class CommercialHistoryRow(BaseModel):
    collab_code: str
    product_name: str
    creator_quote: float | None
    agent_counter: float | None
    creator_counter: float | None
    locked: float | None
    user_name: str
    date: datetime


class CommercialHistorySummary(BaseModel):
    last_locked_amount: float | None
    last_locked_product_name: str | None
    average_locked: float | None
    retained_count: int
    rows: list[CommercialHistoryRow]


class OwnershipHistoryEntry(BaseModel):
    user_name: str
    initials: str
    status: str  # "current" | "previous"
    note: str
    since_label: str


class ActivityLogEntry(BaseModel):
    event_type: str  # "assigned" | "transferred" | "admin_assigned" | "revoked"
    title: str
    description: str
    actor_name: str | None
    timestamp_label: str


class CreatorLifecycle(BaseModel):
    creator_name: str
    creator_handle: str
    followers_count: int
    owner_name: str
    collab_code: str | None
    summary: LifecycleSummary
    track: list[LifecycleTrackStep]
    timeline: list[LifecycleTimelineEntry]
    video_history: list[VideoHistoryRow]
    commercial_history: CommercialHistorySummary
    ownership_history: list[OwnershipHistoryEntry]
    activity_log: list[ActivityLogEntry]

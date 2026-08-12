from datetime import datetime

from pydantic import BaseModel

from app.db.models.enums import CreatorStage, CreatorStatus


class CreatorCreate(BaseModel):
    name: str
    instagram_handle: str
    phone: str | None = None
    email: str | None = None
    city: str | None = None
    instagram_link: str | None = None
    category: str
    followers_count: int = 0
    owner_id: int | None = None
    status: CreatorStatus = CreatorStatus.none
    notes: str | None = None


class CreatorUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    city: str | None = None
    instagram_link: str | None = None
    category: str | None = None
    followers_count: int | None = None
    owner_id: int | None = None
    status: CreatorStatus | None = None
    notes: str | None = None
    is_archived: bool | None = None
    archive_reason: str | None = None


class StageTransition(BaseModel):
    to_stage: CreatorStage
    note: str | None = None


class TransferOwnership(BaseModel):
    new_owner_id: int


class BulkAssign(BaseModel):
    creator_ids: list[int]
    new_owner_id: int


class CreatorOut(BaseModel):
    id: int
    name: str
    instagram_handle: str
    phone: str | None
    email: str | None
    city: str | None
    instagram_link: str | None
    category: str
    followers_count: int
    owner_id: int
    current_stage: CreatorStage
    status: CreatorStatus
    notes: str | None
    is_archived: bool
    created_at: datetime
    last_activity_at: datetime

    class Config:
        from_attributes = True


class CreatorTableRow(BaseModel):
    id: int
    name: str
    instagram_handle: str
    phone: str | None
    category: str
    followers_count: int
    owner_id: int
    status: CreatorStatus
    is_archived: bool
    archived_at: datetime | None
    archive_reason: str | None
    created_at: datetime
    videos_delivered: int
    last_cost: float | None
    last_video_live_at: datetime | None
    last_video_product_name: str | None
    comments_count: int | None
    current_collab_stage_label: str | None


class CreatorTableResponse(BaseModel):
    items: list[CreatorTableRow]
    total: int


class BulkUploadResult(BaseModel):
    created: int
    skipped: int
    errors: list[str]


class CreatorListResponse(BaseModel):
    items: list[CreatorOut]
    total: int


class OwnershipMatch(BaseModel):
    id: int
    name: str
    instagram_handle: str
    owner_id: int
    current_stage: CreatorStage

    class Config:
        from_attributes = True


class BoardStats(BaseModel):
    active_creators: int
    overdue_actions: int
    due_today: int
    weekly_target_pct: float
    follow_ups_completed_today: int
    follow_ups_total_today: int


class NextAction(BaseModel):
    id: int
    type: str
    due_at: datetime
    priority: str


class StageTimelineEntry(BaseModel):
    stage: CreatorStage
    label: str
    status: str
    event_date: datetime | None
    note: str | None


class CreatorDetail(BaseModel):
    creator: CreatorOut
    owner_name: str
    next_action: NextAction | None
    stage_timeline: list[StageTimelineEntry]

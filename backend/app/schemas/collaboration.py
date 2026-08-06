from datetime import datetime

from pydantic import BaseModel

from app.db.models.enums import CollabStage, CreatorStatus, PaymentStatus


class CollaborationCreate(BaseModel):
    creator_id: int
    owner_id: int | None = None
    primary_product_id: int
    additional_product_ids: list[int] = []
    live_attribution_product_ids: list[int] = []
    priority: CreatorStatus = CreatorStatus.active
    stage: CollabStage = CollabStage.new_lead
    note: str | None = None
    creator_reply: str | None = None
    commercial_quoted: float | None = None
    counter_quote_agent: float | None = None
    counter_quote_creator: float | None = None
    commercial_amount: float | None = None
    tracking_link: str | None = None
    order_id: str | None = None


class CollaborationUpdate(BaseModel):
    priority: CreatorStatus | None = None
    note: str | None = None
    creator_reply: str | None = None
    commercial_quoted: float | None = None
    counter_quote_agent: float | None = None
    counter_quote_creator: float | None = None
    commercial_amount: float | None = None
    tracking_link: str | None = None
    order_id: str | None = None
    payment_status: PaymentStatus | None = None
    additional_product_ids: list[int] | None = None
    live_attribution_product_ids: list[int] | None = None


class CollabStageTransition(BaseModel):
    to_stage: CollabStage
    note: str | None = None
    creator_reply: str | None = None
    commercial_quoted: float | None = None
    counter_quote_agent: float | None = None
    counter_quote_creator: float | None = None
    commercial_amount: float | None = None
    live_attribution_product_ids: list[int] | None = None
    creator_phone: str | None = None
    creator_email: str | None = None


class StageRequirementError(BaseModel):
    message: str
    missing_fields: list[str]


class CollabProductOut(BaseModel):
    product_id: int
    product_name: str
    is_primary: bool
    is_live_attributed: bool
    credit: float | None


class CollaborationOut(BaseModel):
    id: int
    collab_code: str
    creator_id: int
    creator_name: str
    creator_handle: str
    products: list[CollabProductOut]
    owner_id: int
    owner_name: str
    stage: CollabStage
    priority: CreatorStatus
    payment_status: PaymentStatus
    commercial_amount: float | None
    note: str | None
    creator_reply: str | None
    commercial_quoted: float | None
    counter_quote_agent: float | None
    counter_quote_creator: float | None
    tracking_link: str | None
    order_id: str | None
    is_overdue: bool
    creator_total_collabs: int
    creator_videos_live: int
    created_at: datetime
    last_activity_at: datetime


class CollabBoardStats(BaseModel):
    unique_creators: int
    active_collaborations: int
    videos_live: int
    dead_leads: int

from datetime import date, datetime

from pydantic import BaseModel

from app.db.models.enums import CollabStage, ContentType, CreatorStatus, DealType, PaymentStatus


class CollaborationCreate(BaseModel):
    creator_id: int
    owner_id: int | None = None
    primary_product_id: int
    additional_product_ids: list[int] = []
    live_attribution_product_ids: list[int] = []
    # Optional product_id -> variant_id map; only for products that have a
    # shade selected. Products not in this map get variant_id=NULL.
    product_variants: dict[int, int] = {}
    priority: CreatorStatus = CreatorStatus.active
    stage: CollabStage = CollabStage.new_lead
    note: str | None = None
    creator_reply: str | None = None
    commercial_quoted: float | None = None
    counter_quote_agent: float | None = None
    counter_quote_creator: float | None = None
    commercial_amount: float | None = None
    deal_type: DealType | None = None
    content_type: ContentType | None = None
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
    deal_type: DealType | None = None
    content_type: ContentType | None = None
    tracking_link: str | None = None
    order_id: str | None = None
    poc_code: str | None = None
    video_link: str | None = None
    video_live_date: date | None = None
    payment_status: PaymentStatus | None = None
    additional_product_ids: list[int] | None = None
    live_attribution_product_ids: list[int] | None = None
    product_variants: dict[int, int] | None = None


class CollabStageTransition(BaseModel):
    to_stage: CollabStage
    note: str | None = None
    creator_reply: str | None = None
    commercial_quoted: float | None = None
    counter_quote_agent: float | None = None
    counter_quote_creator: float | None = None
    commercial_amount: float | None = None
    deal_type: DealType | None = None
    content_type: ContentType | None = None
    live_attribution_product_ids: list[int] | None = None
    creator_phone: str | None = None
    creator_email: str | None = None
    # Optional -- only meaningful when to_stage=="live". Left blank, the
    # date this move actually happens is used instead (see
    # collab_pipeline.effective_live_dates).
    video_live_date: date | None = None


class StageRequirementError(BaseModel):
    message: str
    missing_fields: list[str]


class CollabProductOut(BaseModel):
    product_id: int
    product_name: str
    is_primary: bool
    is_live_attributed: bool
    credit: float | None
    variant_id: int | None = None
    variant_name: str | None = None


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
    deal_type: DealType | None
    content_type: ContentType | None
    tracking_link: str | None
    order_id: str | None
    poc_code: str | None
    video_link: str | None
    video_live_date: date | None  # explicit value, if the user set one
    effective_live_date: date | None  # video_live_date, or the stage-move date if unset
    is_overdue: bool
    creator_total_collabs: int
    creator_videos_live: int
    created_at: datetime
    last_activity_at: datetime
    ownership_revoked_at: datetime | None
    approval_status: str | None = None  # "pending" | "approved" | "rejected"
    approval_target: str | None = None  # "admin" | "supervisor"


class CollabBoardStats(BaseModel):
    unique_creators: int
    active_collaborations: int
    videos_live: int
    dead_leads: int

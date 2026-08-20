from datetime import date, datetime

from pydantic import BaseModel, field_validator

from app.db.models.enums import Platform, PartnershipCollabStatus, TicketStatus


class PartnershipTakeActionRequest(BaseModel):
    requested_ad_rights: bool = False
    requested_ad_code: bool = False
    requested_cta_link: bool = False
    collab_status: PartnershipCollabStatus
    response_due_at: date | None = None
    remark: str

    @field_validator("remark")
    @classmethod
    def remark_required(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("A remark is required.")
        return v


class PartnershipBulkTakeActionRequest(PartnershipTakeActionRequest):
    ticket_ids: list[int]


class PartnershipRespondRequest(BaseModel):
    """Single combined shape for both Advisor and Editor responses -- the
    route branches on the requester's role to decide which subset of these
    optional fields actually applies, avoiding a fragile Union request body."""

    ad_code: str | None = None
    ad_right_duration_days: int | None = None
    ad_right_expires_at: date | None = None
    ad_rights_agent_counter: float | None = None
    cta_link: str | None = None
    remark: str

    @field_validator("remark")
    @classmethod
    def remark_required(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("A remark is required.")
        return v


class PartnershipAdminCounterRequest(BaseModel):
    ad_rights_admin_counter: float
    collab_status: PartnershipCollabStatus | None = None
    remark: str

    @field_validator("remark")
    @classmethod
    def remark_required(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("A remark is required.")
        return v


class PartnershipRequestChangeRequest(BaseModel):
    remark: str
    collab_status: PartnershipCollabStatus | None = None

    @field_validator("remark")
    @classmethod
    def remark_required(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("A remark is required.")
        return v


class PartnershipVerifyCloseRequest(BaseModel):
    ad_rights_amount: float | None = None
    remark: str | None = None


class PartnershipMetadataRequest(BaseModel):
    content_bucket: str | None = None
    language: str | None = None


class PartnershipRemarkOut(BaseModel):
    id: int
    author_id: int
    author_name: str
    author_role: str
    body: str
    tag: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class PartnershipOverviewRow(BaseModel):
    ticket_id: int
    collaboration_id: int
    collab_code: str
    poc_code: str | None
    video_name: str
    creator_handle: str
    product_names: list[str]
    owner_id: int
    owner_name: str
    live_date: datetime | None
    comments_count: int | None
    views_count: int | None
    content_bucket: str | None
    language: str | None
    creator_category: str
    platform: Platform | None
    # Commercial figures -- null for Marketer/Supervisor via redact_commercial().
    ad_rights_creator_quote: float | None
    ad_rights_agent_counter: float | None
    ad_rights_admin_counter: float | None
    ad_rights_amount: float | None
    ad_code: str | None
    ad_right_duration_days: int | None
    ad_right_expires_at: date | None
    cta_link: str | None
    ticket_status: TicketStatus
    collab_status: PartnershipCollabStatus
    latest_remark: str | None
    latest_remark_author: str | None
    remark_count: int


class PartnershipOpenRow(PartnershipOverviewRow):
    aging_bucket: str | None
    aging_days: int | None
    response_due_at: date | None
    requested: list[str]


class PartnershipTicketDetailOut(BaseModel):
    id: int
    collaboration_id: int
    collab_code: str
    video_name: str
    creator_handle: str
    product_names: list[str]
    owner_id: int
    owner_name: str
    live_date: datetime | None
    content_bucket: str | None
    language: str | None
    ticket_status: TicketStatus
    collab_status: PartnershipCollabStatus
    requested_ad_rights: bool
    requested_ad_code: bool
    requested_cta_link: bool
    ad_rights_creator_quote: float | None
    ad_rights_agent_counter: float | None
    ad_rights_admin_counter: float | None
    ad_rights_amount: float | None
    ad_code: str | None
    ad_right_duration_days: int | None
    ad_right_expires_at: date | None
    cta_link: str | None
    response_due_at: date | None
    aging_bucket: str | None
    aging_days: int | None
    remarks: list[PartnershipRemarkOut]


class PartnershipEditorTicketOut(BaseModel):
    """Narrow, Editor-only view -- omits ad code/rights/commercial fields
    entirely rather than nulling them, since Editor's whole workspace is
    scoped to the CTA-link action."""

    id: int
    collaboration_id: int
    collab_code: str
    video_name: str
    product_names: list[str]
    owner_id: int
    owner_name: str
    live_date: datetime | None
    ticket_status: TicketStatus
    cta_link: str | None
    remarks: list[PartnershipRemarkOut]


class PartnershipStats(BaseModel):
    video_register: int
    open_tickets: int
    awaiting_my_action: int
    closed_and_live: int

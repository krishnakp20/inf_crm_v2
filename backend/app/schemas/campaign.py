from datetime import date, datetime

from pydantic import BaseModel

from app.db.models.enums import CampaignStatus, Platform


class CampaignProductGoalIn(BaseModel):
    product_id: int
    target_videos: int = 0


class CampaignParticipantIn(BaseModel):
    user_id: int
    allocation: int = 0
    is_mandatory: bool = False


class CampaignCreate(BaseModel):
    name: str
    status: CampaignStatus = CampaignStatus.draft
    target_videos: int = 0
    creators_needed: int | None = None
    deadline: date | None = None
    demographic: str | None = None
    language: str | None = None
    platforms: list[Platform] = []
    products: list[CampaignProductGoalIn] = []
    participants: list[CampaignParticipantIn] = []


class CampaignUpdate(BaseModel):
    name: str | None = None
    status: CampaignStatus | None = None
    target_videos: int | None = None
    creators_needed: int | None = None
    deadline: date | None = None
    demographic: str | None = None
    language: str | None = None
    platforms: list[Platform] | None = None


class CampaignProductOut(BaseModel):
    product_id: int
    product_name: str
    target_videos: int
    live_credit: float


class CampaignParticipantOut(BaseModel):
    user_id: int
    user_name: str
    allocation: int
    is_mandatory: bool
    live_count: int


class CampaignOut(BaseModel):
    id: int
    campaign_code: str
    name: str
    status: CampaignStatus
    target_videos: int
    creators_needed: int | None
    deadline: date | None
    demographic: str | None
    language: str | None
    platforms: list[Platform]
    products: list[CampaignProductOut]
    participants: list[CampaignParticipantOut]
    live_ads_count: int
    committed: int
    unassigned: int
    progress_pct: float
    created_by: int
    created_at: datetime


class CampaignListItem(BaseModel):
    id: int
    campaign_code: str
    name: str
    status: CampaignStatus
    deadline: date | None
    platforms: list[Platform]
    product_names: list[str]
    participant_count: int
    committed: int
    unassigned: int
    live_ads_count: int
    target_videos: int
    progress_pct: float
    creators_needed: int | None
    created_at: datetime


class CampaignStats(BaseModel):
    total_campaigns: int
    live_ads: int
    target_ads: int
    target_completion_pct: float


class CampaignParticipantJoin(BaseModel):
    allocation: int


class CampaignAddVideoRequest(BaseModel):
    collab_code: str
    platform: Platform


class CampaignAdOut(BaseModel):
    """Lightweight row shape for the Campaigns page's "Ads" tab -- deliberately
    not the full CollaborationOut (which lives behind the creator-workspace
    guard that blocks Marketer; Ads must stay visible to Marketer)."""

    collab_id: int
    collab_code: str
    campaign_id: int
    campaign_name: str
    product_names: list[str]
    platform: Platform | None
    owner_id: int
    owner_name: str
    live_date: datetime | None
    views_count: int | None
    comments_count: int | None

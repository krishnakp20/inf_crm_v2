from datetime import datetime

from pydantic import BaseModel

from app.db.models.enums import ApprovalPriority, ApprovalStatus


class ApprovalRequestCreate(BaseModel):
    collaboration_id: int
    priority: ApprovalPriority = ApprovalPriority.normal
    note: str


class ApprovalRequestOut(BaseModel):
    id: int
    request_code: str
    collaboration_id: int
    creator_name: str
    creator_handle: str
    product_name: str
    collab_stage_label: str
    requested_by: int
    requested_by_name: str
    priority: ApprovalPriority
    note: str
    status: ApprovalStatus
    created_at: datetime
    resolved_at: datetime | None

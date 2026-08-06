from datetime import datetime

from pydantic import BaseModel

from app.db.models.enums import FollowUpStatus, Priority


class FollowUpOut(BaseModel):
    id: int
    creator_id: int
    assigned_to: int
    type: str
    due_at: datetime
    priority: Priority
    status: FollowUpStatus
    completed_at: datetime | None

    class Config:
        from_attributes = True

from datetime import datetime

from pydantic import BaseModel


class CreatorFileOut(BaseModel):
    id: int
    creator_id: int
    uploaded_by: int
    uploaded_by_name: str
    original_filename: str
    content_type: str
    size_bytes: int
    created_at: datetime

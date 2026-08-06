from datetime import datetime

from pydantic import BaseModel

from app.db.models.enums import MessageChannel


class MessageCreate(BaseModel):
    channel: MessageChannel
    body: str


class MessageOut(BaseModel):
    id: int
    creator_id: int
    author_id: int
    author_name: str
    channel: MessageChannel
    body: str
    created_at: datetime

    class Config:
        from_attributes = True

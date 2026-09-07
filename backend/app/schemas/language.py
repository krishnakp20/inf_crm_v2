from datetime import datetime

from pydantic import BaseModel


class LanguageCreate(BaseModel):
    name: str


class LanguageOut(BaseModel):
    id: int
    name: str
    created_at: datetime

    class Config:
        from_attributes = True

from pydantic import BaseModel

from app.db.models.enums import CollabStage


class StageDeadlineRuleOut(BaseModel):
    stage: CollabStage
    label: str
    max_days: int | None


class StageDeadlineRuleUpdate(BaseModel):
    stage: CollabStage
    max_days: int | None


class StageDeadlineRulesUpdate(BaseModel):
    rules: list[StageDeadlineRuleUpdate]

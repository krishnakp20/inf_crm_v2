from pydantic import BaseModel

from app.db.models.enums import CreatorStage


class StageDeadlineRuleOut(BaseModel):
    stage: CreatorStage
    label: str
    max_days: int | None


class StageDeadlineRuleUpdate(BaseModel):
    stage: CreatorStage
    max_days: int | None


class StageDeadlineRulesUpdate(BaseModel):
    rules: list[StageDeadlineRuleUpdate]

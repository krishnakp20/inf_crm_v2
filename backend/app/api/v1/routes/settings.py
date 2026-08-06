from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends

from app.core.deps import require_admin
from app.db.models.stage_deadline_rule import StageDeadlineRule
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.stage_deadline_rule import StageDeadlineRuleOut, StageDeadlineRulesUpdate
from app.services.pipeline import CONFIGURABLE_DEADLINE_STAGES, DEADLINE_STAGE_LABELS

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/stage-deadlines", response_model=list[StageDeadlineRuleOut])
async def list_stage_deadlines(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[StageDeadlineRuleOut]:
    result = await db.execute(select(StageDeadlineRule))
    existing = {rule.stage: rule.max_days for rule in result.scalars().all()}
    return [
        StageDeadlineRuleOut(stage=stage, label=DEADLINE_STAGE_LABELS[stage], max_days=existing.get(stage))
        for stage in CONFIGURABLE_DEADLINE_STAGES
    ]


@router.put("/stage-deadlines", response_model=list[StageDeadlineRuleOut])
async def update_stage_deadlines(
    payload: StageDeadlineRulesUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[StageDeadlineRuleOut]:
    result = await db.execute(select(StageDeadlineRule))
    existing = {rule.stage: rule for rule in result.scalars().all()}

    for update in payload.rules:
        if update.stage in existing:
            existing[update.stage].max_days = update.max_days
        else:
            rule = StageDeadlineRule(stage=update.stage, max_days=update.max_days)
            db.add(rule)
            existing[update.stage] = rule

    await db.commit()

    result = await db.execute(select(StageDeadlineRule))
    updated = {rule.stage: rule.max_days for rule in result.scalars().all()}
    return [
        StageDeadlineRuleOut(stage=stage, label=DEADLINE_STAGE_LABELS[stage], max_days=updated.get(stage))
        for stage in CONFIGURABLE_DEADLINE_STAGES
    ]

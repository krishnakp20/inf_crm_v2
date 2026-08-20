from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends, File, UploadFile

from app.core.deps import require_admin
from app.db.models.metric_import import MetricImport
from app.db.models.stage_deadline_rule import StageDeadlineRule
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.metric_upload import MetricImportOut, MetricUploadResult
from app.schemas.stage_deadline_rule import StageDeadlineRuleOut, StageDeadlineRulesUpdate
from app.services.metric_upload import process_metric_upload
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


@router.post("/metric-upload", response_model=MetricUploadResult)
async def upload_metrics(
    upload: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
) -> MetricUploadResult:
    raw = await upload.read()
    return await process_metric_upload(db, upload.filename or "", raw, user.id)


@router.get("/metric-upload/history", response_model=list[MetricImportOut])
async def metric_upload_history(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[MetricImportOut]:
    result = await db.execute(
        select(MetricImport, User.name)
        .join(User, User.id == MetricImport.uploaded_by)
        .order_by(desc(MetricImport.created_at))
        .limit(20)
    )
    return [
        MetricImportOut(
            id=mi.id,
            filename=mi.filename,
            total_rows=mi.total_rows,
            updated_rows=mi.updated_rows,
            skipped_rows=mi.skipped_rows,
            status=mi.status,
            uploaded_by_name=name,
            created_at=mi.created_at,
        )
        for mi, name in result.all()
    ]

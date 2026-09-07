import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, or_, select

from app.db.models.collaboration import Collaboration
from app.db.models.creator import Creator
from app.db.models.enums import CollabStage, UserRole
from app.db.models.user import User
from app.db.session import AsyncSessionLocal
from app.services.collab_pipeline import (
    COLLAB_STAGE_LABELS,
    apply_stage_transition,
    is_stage_deadline_exceeded,
    load_stage_deadline_days,
)

# Fixed thresholds -- no admin-configurable settings, matching the reference
# site's fixed "60 days / 6 months" copy exactly. These stay as a backstop
# catch-all for any stage the admin hasn't set a Settings > Stage deadlines
# value for -- a per-stage configured deadline (see load_stage_deadline_days)
# fires independently and can be tighter than this.
ACTIVE_STALE_DAYS = 60
# ~6 months as a fixed day-count approximation -- no calendar-accurate date
# library (e.g. dateutil) is a project dependency, and adding one solely for
# this would be unwarranted.
LIVE_STALE_DAYS = 182


async def find_stale_collaborations(db, deadline_days: dict[CollabStage, int | None]) -> list[Collaboration]:
    now = datetime.now(timezone.utc)
    active_cutoff = now - timedelta(days=ACTIVE_STALE_DAYS)
    live_cutoff = now - timedelta(days=LIVE_STALE_DAYS)
    conditions = [
        and_(Collaboration.stage != CollabStage.live, Collaboration.last_activity_at < active_cutoff),
        and_(Collaboration.stage == CollabStage.live, Collaboration.last_activity_at < live_cutoff),
    ]
    for stage, max_days in deadline_days.items():
        if max_days is not None:
            conditions.append(
                and_(Collaboration.stage == stage, Collaboration.last_activity_at < now - timedelta(days=max_days))
            )

    stmt = select(Collaboration).where(Collaboration.stage != CollabStage.dead_leads, or_(*conditions))
    return list((await db.execute(stmt)).scalars().all())


async def _system_actor_id(db) -> int | None:
    """No system-user sentinel exists in this schema -- use the lowest-id
    Admin as the CollabStageEvent actor, with a self-explanatory note
    carrying the real reason. Returns None if no Admin exists yet (fresh/
    unseeded DB) so the sweep can no-op safely.
    """
    result = await db.execute(select(User.id).where(User.role == UserRole.admin).order_by(User.id).limit(1))
    return result.scalar_one_or_none()


async def run_dead_zone_sweep() -> int:
    async with AsyncSessionLocal() as db:
        actor_id = await _system_actor_id(db)
        if actor_id is None:
            return 0
        deadline_days = await load_stage_deadline_days(db)
        stale = await find_stale_collaborations(db, deadline_days)
        moved = 0
        for collab in stale:
            creator = await db.get(Creator, collab.creator_id)
            max_days = deadline_days.get(collab.stage)
            if max_days is not None and is_stage_deadline_exceeded(collab, deadline_days):
                # The admin's own Settings > Stage deadlines rule for this
                # stage is the more specific, more informative reason --
                # prefer it over the generic catch-all note even if the
                # 60-day/6-month rule would also have caught this card.
                note = (
                    f"Automatically moved after exceeding the {max_days}-day "
                    f"{COLLAB_STAGE_LABELS[collab.stage]} stage deadline"
                )
            elif collab.stage == CollabStage.live:
                note = "Automatically moved after 6 months Live with no activity"
            else:
                note = "Automatically moved after 60 days with no activity"
            await apply_stage_transition(db, collab, creator, CollabStage.dead_leads, actor_id, note, bump_activity=False)
            collab.ownership_revoked_at = datetime.now(timezone.utc)
            moved += 1
        await db.commit()
        return moved


if __name__ == "__main__":
    result = asyncio.run(run_dead_zone_sweep())
    print(f"Dead zone sweep moved {result} collaboration(s).")

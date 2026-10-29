import re
from calendar import monthrange
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.collaboration import Collaboration
from app.db.models.collaboration_product import CollaborationProduct
from app.db.models.enums import CollabStage
from app.db.models.product_target import ProductTarget

_MONTH_RE = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])$")


def current_month() -> date:
    now = datetime.now(timezone.utc)
    return date(now.year, now.month, 1)


def parse_month(value: str | None) -> date:
    """'YYYY-MM' -> first day of that month. None -> the current month."""
    if value is None or value == "":
        return current_month()
    m = _MONTH_RE.match(value)
    if not m:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Month must look like 2026-09.")
    return date(int(m.group(1)), int(m.group(2)), 1)


def month_key(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def month_bounds(first_day: date) -> tuple[date, date]:
    """First and last calendar day of the month starting at `first_day`."""
    return first_day, date(first_day.year, first_day.month, monthrange(first_day.year, first_day.month)[1])


@dataclass
class EffectiveTarget:
    row_id: int
    value: int
    # "month"    -> this month has its own figure
    # "carried"  -> no figure for this month; the latest earlier month's carries forward
    # "standing" -> no month-specific figure at all; the standing (no-month) target applies
    source: str
    source_month: date | None


async def effective_targets(
    db: AsyncSession, user_ids: list[int] | None, month: date, product_id: int | None = None
) -> dict[tuple[int, int], EffectiveTarget]:
    """The monthly target in force for each (user, product) in `month`.

    A figure set for that exact month wins; otherwise the latest EARLIER month's
    figure carries forward (set it once, it keeps applying until changed);
    otherwise the standing target (the rows that existed before month-wise
    targets, month NULL). Later months never affect an earlier month.
    """
    stmt = select(ProductTarget)
    if user_ids is not None:
        stmt = stmt.where(ProductTarget.user_id.in_(user_ids))
    if product_id is not None:
        stmt = stmt.where(ProductTarget.product_id == product_id)
    rows = (await db.execute(stmt)).scalars().all()

    standing: dict[tuple[int, int], ProductTarget] = {}
    best: dict[tuple[int, int], ProductTarget] = {}
    for row in rows:
        key = (row.user_id, row.product_id)
        if row.month is None:
            standing[key] = row
        elif row.month <= month and (key not in best or row.month > best[key].month):
            best[key] = row

    result: dict[tuple[int, int], EffectiveTarget] = {}
    for key in set(standing) | set(best):
        if key in best:
            row = best[key]
            result[key] = EffectiveTarget(
                row.id, row.monthly_target, "month" if row.month == month else "carried", row.month
            )
        else:
            row = standing[key]
            result[key] = EffectiveTarget(row.id, row.monthly_target, "standing", None)
    return result


def derive_weekly_target(monthly_target: int, at: datetime) -> int:
    """The agent only ever sets a monthly target; this is the one place that
    turns it into a weekly figure -- monthly spread evenly across the
    current calendar month's actual day count, expressed as a 7-day rate.
    Recomputed fresh on every read (never stored) so it can't go stale
    across a month boundary (a 28-day February vs a 31-day month gives a
    different weekly rate for the same monthly target)."""
    days_in_month = monthrange(at.year, at.month)[1]
    return round(monthly_target * 7 / days_in_month)


async def get_video_credit_by_product_since(
    db: AsyncSession, owner_id: int, window_start: datetime
) -> dict[int, float]:
    """Same fractional-credit split as get_video_credit_by_product, scoped to
    one advisor and time-windowed by last_activity_at (the same proxy for
    "when a collaboration reached Live" used elsewhere in this codebase)."""
    stmt = (
        select(
            CollaborationProduct.collaboration_id,
            CollaborationProduct.product_id,
            CollaborationProduct.is_primary,
            CollaborationProduct.is_live_attributed,
        )
        .join(Collaboration, Collaboration.id == CollaborationProduct.collaboration_id)
        .where(
            Collaboration.stage == CollabStage.live,
            Collaboration.owner_id == owner_id,
            Collaboration.last_activity_at >= window_start,
        )
    )
    rows = (await db.execute(stmt)).all()

    by_collab: dict[int, list[tuple[int, bool, bool]]] = defaultdict(list)
    for collab_id, product_id, is_primary, is_live_attributed in rows:
        by_collab[collab_id].append((product_id, is_primary, is_live_attributed))

    credit: dict[int, float] = defaultdict(float)
    for links in by_collab.values():
        live_attributed = [pid for pid, _, live in links if live]
        if live_attributed:
            share = 1.0 / len(live_attributed)
            for pid in live_attributed:
                credit[pid] += share
        else:
            primary = next((pid for pid, is_primary, _ in links if is_primary), None)
            if primary is not None:
                credit[primary] += 1.0
    return dict(credit)

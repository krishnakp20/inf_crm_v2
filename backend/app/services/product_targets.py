from collections import defaultdict
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.collaboration import Collaboration
from app.db.models.collaboration_product import CollaborationProduct
from app.db.models.enums import CollabStage


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

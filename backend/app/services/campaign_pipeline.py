from collections import defaultdict

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.campaign import Campaign
from app.db.models.campaign_participant import CampaignParticipant
from app.db.models.collaboration import Collaboration
from app.db.models.collaboration_product import CollaborationProduct
from app.db.models.enums import CollabStage, UserRole
from app.db.models.user import User


async def next_campaign_code(db: AsyncSession) -> str:
    count = (await db.execute(select(func.count(Campaign.id)))).scalar_one()
    return f"CMP-{count + 1:04d}"


async def get_video_credit_by_product_for_campaign(db: AsyncSession, campaign_id: int) -> dict[int, float]:
    """Per-product fractional Live-video credit within one campaign. Same
    even-split-across-is_live_attributed-else-is_primary logic as
    collab_pipeline.get_video_credit_by_product, scoped by campaign_id
    instead of owner_ids -- used only for the informational "Product
    contribution" panel, never the top-line campaign progress number."""
    stmt = (
        select(
            CollaborationProduct.collaboration_id,
            CollaborationProduct.product_id,
            CollaborationProduct.is_primary,
            CollaborationProduct.is_live_attributed,
        )
        .join(Collaboration, Collaboration.id == CollaborationProduct.collaboration_id)
        .where(Collaboration.stage == CollabStage.live, Collaboration.campaign_id == campaign_id)
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


async def campaign_live_ads_count(db: AsyncSession, campaign_id: int) -> int:
    stmt = select(func.count(Collaboration.id)).where(
        Collaboration.campaign_id == campaign_id, Collaboration.stage == CollabStage.live
    )
    return (await db.execute(stmt)).scalar_one()


async def scoped_campaign_ids(user: User, db: AsyncSession) -> list[int] | None:
    """None = unrestricted browse (Admin, Marketer, and Advisor -- agents can
    browse the full campaign catalog to decide whether to self-join).
    Supervisor is restricted to campaigns where at least one of their team's
    advisors participates. Editor gets no access at all (blocked earlier by
    require_campaign_access, but return [] defensively)."""
    if user.role in (UserRole.admin, UserRole.marketer, UserRole.advisor):
        return None
    if user.role == UserRole.supervisor:
        team_result = await db.execute(select(User.id).where(User.supervisor_id == user.id))
        team_ids = [user.id, *[row[0] for row in team_result.all()]]
        result = await db.execute(
            select(CampaignParticipant.campaign_id.distinct()).where(CampaignParticipant.user_id.in_(team_ids))
        )
        return [row[0] for row in result.all()]
    return []

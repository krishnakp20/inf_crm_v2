from collections import defaultdict
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_admin, require_campaign_access
from app.db.models.campaign import Campaign
from app.db.models.campaign_participant import CampaignParticipant
from app.db.models.campaign_product import CampaignProduct
from app.db.models.collab_stage_event import CollabStageEvent
from app.db.models.collaboration import Collaboration
from app.db.models.collaboration_product import CollaborationProduct
from app.db.models.enums import CampaignStatus, CollabStage, Platform, UserRole
from app.db.models.product import Product
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.campaign import (
    CampaignAddVideoRequest,
    CampaignAdOut,
    CampaignCreate,
    CampaignListItem,
    CampaignOut,
    CampaignParticipantIn,
    CampaignParticipantJoin,
    CampaignParticipantOut,
    CampaignProductOut,
    CampaignStats,
    CampaignUpdate,
)
from app.services.campaign_pipeline import (
    campaign_live_ads_count,
    get_video_credit_by_product_for_campaign,
    next_campaign_code,
    scoped_campaign_ids,
)
from app.services.collab_pipeline import effective_live_dates

router = APIRouter(prefix="/campaigns", tags=["campaigns"], dependencies=[Depends(require_campaign_access)])


async def _get_campaign_or_404(campaign_id: int, db: AsyncSession, user: User) -> Campaign:
    campaign = await db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    scope = await scoped_campaign_ids(user, db)
    if scope is not None and campaign.id not in scope:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return campaign


async def _list_stats(db: AsyncSession, campaigns: list[Campaign]) -> dict:
    campaign_ids = [c.id for c in campaigns]
    if not campaign_ids:
        return {
            "products": {}, "participants": {}, "live": {},
        }

    product_rows = await db.execute(
        select(CampaignProduct.campaign_id, Product.name)
        .join(Product, Product.id == CampaignProduct.product_id)
        .where(CampaignProduct.campaign_id.in_(campaign_ids))
    )
    products: dict[int, list[str]] = defaultdict(list)
    for cid, name in product_rows.all():
        products[cid].append(name)

    participant_rows = await db.execute(
        select(
            CampaignParticipant.campaign_id,
            func.count(CampaignParticipant.id),
            func.coalesce(func.sum(CampaignParticipant.allocation), 0),
        )
        .where(CampaignParticipant.campaign_id.in_(campaign_ids))
        .group_by(CampaignParticipant.campaign_id)
    )
    participants: dict[int, tuple[int, int]] = {cid: (cnt, committed) for cid, cnt, committed in participant_rows.all()}

    live_rows = await db.execute(
        select(Collaboration.campaign_id, func.count(Collaboration.id))
        .where(Collaboration.campaign_id.in_(campaign_ids), Collaboration.stage == CollabStage.live)
        .group_by(Collaboration.campaign_id)
    )
    live: dict[int, int] = dict(live_rows.all())

    return {"products": products, "participants": participants, "live": live}


def _to_list_item(campaign: Campaign, stats: dict) -> CampaignListItem:
    participant_count, committed = stats["participants"].get(campaign.id, (0, 0))
    live_ads = stats["live"].get(campaign.id, 0)
    unassigned = max(campaign.target_videos - committed, 0)
    progress_pct = round(live_ads / campaign.target_videos * 100, 1) if campaign.target_videos else 0.0
    return CampaignListItem(
        id=campaign.id,
        campaign_code=campaign.campaign_code,
        name=campaign.name,
        status=campaign.status,
        deadline=campaign.deadline,
        platforms=[Platform(p) for p in (campaign.platforms or [])],
        product_names=stats["products"].get(campaign.id, []),
        participant_count=participant_count,
        committed=committed,
        unassigned=unassigned,
        live_ads_count=live_ads,
        target_videos=campaign.target_videos,
        progress_pct=progress_pct,
        creators_needed=campaign.creators_needed,
        created_at=campaign.created_at,
    )


@router.get("", response_model=list[CampaignListItem])
async def list_campaigns(
    status_filter: CampaignStatus | None = Query(None, alias="status"),
    product_id: int | None = None,
    platform: Platform | None = None,
    user_id: int | None = None,
    deadline_from: date | None = None,
    deadline_to: date | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[CampaignListItem]:
    scope = await scoped_campaign_ids(user, db)

    stmt = select(Campaign)
    if scope is not None:
        stmt = stmt.where(Campaign.id.in_(scope))
    if status_filter is not None:
        stmt = stmt.where(Campaign.status == status_filter)
    if product_id is not None:
        stmt = stmt.where(
            Campaign.id.in_(select(CampaignProduct.campaign_id).where(CampaignProduct.product_id == product_id))
        )
    if user_id is not None:
        stmt = stmt.where(
            Campaign.id.in_(select(CampaignParticipant.campaign_id).where(CampaignParticipant.user_id == user_id))
        )
    if deadline_from is not None:
        stmt = stmt.where(Campaign.deadline >= deadline_from)
    if deadline_to is not None:
        stmt = stmt.where(Campaign.deadline <= deadline_to)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(or_(Campaign.name.ilike(pattern), Campaign.campaign_code.ilike(pattern)))

    campaigns = list((await db.execute(stmt.order_by(Campaign.created_at.desc()))).scalars().all())
    if platform is not None:
        campaigns = [c for c in campaigns if platform.value in (c.platforms or [])]

    stats = await _list_stats(db, campaigns)
    return [_to_list_item(c, stats) for c in campaigns]


@router.get("/stats", response_model=CampaignStats)
async def campaign_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CampaignStats:
    scope = await scoped_campaign_ids(user, db)
    stmt = select(Campaign)
    if scope is not None:
        stmt = stmt.where(Campaign.id.in_(scope))
    campaigns = list((await db.execute(stmt)).scalars().all())

    campaign_ids = [c.id for c in campaigns]
    live_ads = 0
    if campaign_ids:
        live_ads = (
            await db.execute(
                select(func.count(Collaboration.id)).where(
                    Collaboration.campaign_id.in_(campaign_ids), Collaboration.stage == CollabStage.live
                )
            )
        ).scalar_one()
    target_ads = sum(c.target_videos for c in campaigns)
    target_completion_pct = round(live_ads / target_ads * 100, 1) if target_ads else 0.0

    return CampaignStats(
        total_campaigns=len(campaigns),
        live_ads=live_ads,
        target_ads=target_ads,
        target_completion_pct=target_completion_pct,
    )


@router.get("/ads", response_model=list[CampaignAdOut])
async def list_ads(
    campaign_id: int | None = None,
    product_id: int | None = None,
    platform: Platform | None = None,
    user_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[CampaignAdOut]:
    scope = await scoped_campaign_ids(user, db)

    stmt = (
        select(Collaboration, Campaign, User)
        .join(Campaign, Campaign.id == Collaboration.campaign_id)
        .join(User, User.id == Collaboration.owner_id)
        .where(Collaboration.campaign_id.isnot(None), Collaboration.stage == CollabStage.live)
    )
    if scope is not None:
        stmt = stmt.where(Collaboration.campaign_id.in_(scope))
    if campaign_id is not None:
        stmt = stmt.where(Collaboration.campaign_id == campaign_id)
    if platform is not None:
        stmt = stmt.where(Collaboration.platform == platform)
    if user_id is not None:
        stmt = stmt.where(Collaboration.owner_id == user_id)
    if product_id is not None:
        stmt = stmt.where(
            Collaboration.id.in_(
                select(CollaborationProduct.collaboration_id).where(CollaborationProduct.product_id == product_id)
            )
        )

    rows = (await db.execute(stmt.order_by(Collaboration.last_activity_at.desc()))).all()
    collab_ids = [c.id for c, _, _ in rows]

    products_by_collab: dict[int, list[str]] = defaultdict(list)
    if collab_ids:
        product_rows = await db.execute(
            select(CollaborationProduct.collaboration_id, Product.name)
            .join(Product, Product.id == CollaborationProduct.product_id)
            .where(CollaborationProduct.collaboration_id.in_(collab_ids))
        )
        for collab_id, name in product_rows.all():
            products_by_collab[collab_id].append(name)

    # Prefers each collab's explicit video_live_date when the user set one,
    # falling back to the first transition-to-Live event -- see
    # collab_pipeline.effective_live_dates for the shared rule.
    live_date_by_collab: dict[int, datetime] = {
        collab_id: datetime.combine(d, datetime.min.time(), tzinfo=timezone.utc)
        for collab_id, d in (await effective_live_dates(db, collab_ids)).items()
    }

    return [
        CampaignAdOut(
            collab_id=collab.id,
            collab_code=collab.collab_code,
            campaign_id=campaign.id,
            campaign_name=campaign.name,
            product_names=products_by_collab.get(collab.id, []),
            platform=collab.platform,
            owner_id=owner.id,
            owner_name=owner.name,
            live_date=live_date_by_collab.get(collab.id),
            views_count=collab.views_count,
            comments_count=collab.comments_count,
        )
        for collab, campaign, owner in rows
    ]


@router.get("/{campaign_id}", response_model=CampaignOut)
async def get_campaign(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CampaignOut:
    campaign = await _get_campaign_or_404(campaign_id, db, user)
    return await _to_full_out(campaign, db)


async def _to_full_out(campaign: Campaign, db: AsyncSession) -> CampaignOut:
    product_rows = (
        await db.execute(
            select(CampaignProduct.product_id, Product.name, CampaignProduct.target_videos)
            .join(Product, Product.id == CampaignProduct.product_id)
            .where(CampaignProduct.campaign_id == campaign.id)
        )
    ).all()
    credit_by_product = await get_video_credit_by_product_for_campaign(db, campaign.id)
    products = [
        CampaignProductOut(
            product_id=pid, product_name=name, target_videos=target, live_credit=round(credit_by_product.get(pid, 0.0), 2)
        )
        for pid, name, target in product_rows
    ]

    participant_rows = (
        await db.execute(
            select(CampaignParticipant.user_id, User.name, CampaignParticipant.allocation, CampaignParticipant.is_mandatory)
            .join(User, User.id == CampaignParticipant.user_id)
            .where(CampaignParticipant.campaign_id == campaign.id)
        )
    ).all()
    live_by_owner = dict(
        (
            await db.execute(
                select(Collaboration.owner_id, func.count(Collaboration.id))
                .where(Collaboration.campaign_id == campaign.id, Collaboration.stage == CollabStage.live)
                .group_by(Collaboration.owner_id)
            )
        ).all()
    )
    participants = [
        CampaignParticipantOut(
            user_id=uid, user_name=name, allocation=allocation, is_mandatory=is_mandatory,
            live_count=live_by_owner.get(uid, 0),
        )
        for uid, name, allocation, is_mandatory in participant_rows
    ]

    committed = sum(p.allocation for p in participants)
    live_ads_count = await campaign_live_ads_count(db, campaign.id)
    unassigned = max(campaign.target_videos - committed, 0)
    progress_pct = round(live_ads_count / campaign.target_videos * 100, 1) if campaign.target_videos else 0.0

    return CampaignOut(
        id=campaign.id,
        campaign_code=campaign.campaign_code,
        name=campaign.name,
        status=campaign.status,
        target_videos=campaign.target_videos,
        creators_needed=campaign.creators_needed,
        deadline=campaign.deadline,
        demographic=campaign.demographic,
        language=campaign.language,
        platforms=[Platform(p) for p in (campaign.platforms or [])],
        products=products,
        participants=participants,
        live_ads_count=live_ads_count,
        committed=committed,
        unassigned=unassigned,
        progress_pct=progress_pct,
        created_by=campaign.created_by,
        created_at=campaign.created_at,
    )


@router.post("", response_model=CampaignOut, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    payload: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
) -> CampaignOut:
    campaign_code = await next_campaign_code(db)
    campaign = Campaign(
        campaign_code=campaign_code,
        name=payload.name,
        status=payload.status,
        target_videos=payload.target_videos,
        creators_needed=payload.creators_needed,
        deadline=payload.deadline,
        demographic=payload.demographic,
        language=payload.language,
        platforms=[p.value for p in payload.platforms] or None,
        created_by=user.id,
    )
    db.add(campaign)
    await db.flush()

    for goal in payload.products:
        db.add(CampaignProduct(campaign_id=campaign.id, product_id=goal.product_id, target_videos=goal.target_videos))
    for participant in payload.participants:
        db.add(
            CampaignParticipant(
                campaign_id=campaign.id,
                user_id=participant.user_id,
                allocation=participant.allocation,
                is_mandatory=participant.is_mandatory,
            )
        )

    await db.commit()
    await db.refresh(campaign)
    return await _to_full_out(campaign, db)


@router.patch("/{campaign_id}", response_model=CampaignOut)
async def update_campaign(
    campaign_id: int,
    payload: CampaignUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> CampaignOut:
    campaign = await db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "platforms" in update_data:
        update_data["platforms"] = [p.value for p in payload.platforms] if payload.platforms else None
    for field, value in update_data.items():
        setattr(campaign, field, value)

    await db.commit()
    await db.refresh(campaign)
    return await _to_full_out(campaign, db)


async def _committed_excluding(db: AsyncSession, campaign_id: int, exclude_user_id: int | None) -> int:
    stmt = select(func.coalesce(func.sum(CampaignParticipant.allocation), 0)).where(
        CampaignParticipant.campaign_id == campaign_id
    )
    if exclude_user_id is not None:
        stmt = stmt.where(CampaignParticipant.user_id != exclude_user_id)
    return (await db.execute(stmt)).scalar_one()


@router.post("/{campaign_id}/participants", response_model=CampaignOut)
async def add_participant(
    campaign_id: int,
    payload: CampaignParticipantIn,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> CampaignOut:
    campaign = await db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    committed = await _committed_excluding(db, campaign_id, payload.user_id)
    if committed + payload.allocation > campaign.target_videos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Allocation exceeds remaining capacity ({campaign.target_videos - committed} open).",
        )

    existing = (
        await db.execute(
            select(CampaignParticipant).where(
                CampaignParticipant.campaign_id == campaign_id, CampaignParticipant.user_id == payload.user_id
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        existing.allocation = payload.allocation
        existing.is_mandatory = payload.is_mandatory
    else:
        db.add(
            CampaignParticipant(
                campaign_id=campaign_id,
                user_id=payload.user_id,
                allocation=payload.allocation,
                is_mandatory=payload.is_mandatory,
            )
        )
    await db.commit()
    return await _to_full_out(campaign, db)


@router.post("/{campaign_id}/join", response_model=CampaignOut)
async def join_campaign(
    campaign_id: int,
    payload: CampaignParticipantJoin,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CampaignOut:
    if user.role != UserRole.advisor:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Influencer Agents can self-join a campaign.")

    campaign = await db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    if campaign.status not in (CampaignStatus.scheduled, CampaignStatus.live):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This campaign isn't open to join right now.")

    committed = await _committed_excluding(db, campaign_id, user.id)
    if committed + payload.allocation > campaign.target_videos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Allocation exceeds remaining capacity ({campaign.target_videos - committed} open).",
        )

    existing = (
        await db.execute(
            select(CampaignParticipant).where(
                CampaignParticipant.campaign_id == campaign_id, CampaignParticipant.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        existing.allocation = payload.allocation
    else:
        db.add(CampaignParticipant(campaign_id=campaign_id, user_id=user.id, allocation=payload.allocation, is_mandatory=False))
    await db.commit()
    return await _to_full_out(campaign, db)


@router.delete("/{campaign_id}/participants/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_participant(
    campaign_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> None:
    participant = (
        await db.execute(
            select(CampaignParticipant).where(
                CampaignParticipant.campaign_id == campaign_id, CampaignParticipant.user_id == user_id
            )
        )
    ).scalar_one_or_none()
    if participant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
    await db.delete(participant)
    await db.commit()


async def _require_video_link_access(campaign_id: int, collab: Collaboration, db: AsyncSession, user: User) -> None:
    if user.role == UserRole.admin:
        return
    if user.role != UserRole.advisor:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not available for this role.")
    if collab.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only link your own collaborations.")
    is_participant = (
        await db.execute(
            select(CampaignParticipant.id).where(
                CampaignParticipant.campaign_id == campaign_id, CampaignParticipant.user_id == user.id
            )
        )
    ).first()
    if is_participant is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Join this campaign before linking a video.")


@router.post("/{campaign_id}/videos", response_model=CampaignOut)
async def add_video(
    campaign_id: int,
    payload: CampaignAddVideoRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CampaignOut:
    campaign = await db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    collab = (
        await db.execute(select(Collaboration).where(Collaboration.collab_code == payload.collab_code))
    ).scalar_one_or_none()
    if collab is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No collaboration with that code.")
    if collab.stage != CollabStage.live:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only a Live collaboration can be linked.")

    await _require_video_link_access(campaign_id, collab, db, user)

    collab.campaign_id = campaign_id
    collab.platform = payload.platform
    await db.commit()
    return await _to_full_out(campaign, db)


@router.delete("/{campaign_id}/videos/{collab_id}", response_model=CampaignOut)
async def remove_video(
    campaign_id: int,
    collab_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CampaignOut:
    campaign = await db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    collab = await db.get(Collaboration, collab_id)
    if collab is None or collab.campaign_id != campaign_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This video isn't linked to this campaign.")

    await _require_video_link_access(campaign_id, collab, db, user)

    collab.campaign_id = None
    await db.commit()
    return await _to_full_out(campaign, db)

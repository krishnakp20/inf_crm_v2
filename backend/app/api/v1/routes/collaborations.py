from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, exists, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import (
    get_current_user,
    owner_scope_filter,
    require_admin,
    require_creator_workspace_access,
    scoped_owner_ids,
)
from app.db.models.approval_request import ApprovalRequest
from app.db.models.collab_stage_event import CollabStageEvent
from app.db.models.collaboration import Collaboration
from app.db.models.collaboration_product import CollaborationProduct
from app.db.models.creator import Creator
from app.db.models.enums import CollabStage, UserRole
from app.db.models.partnership_ticket import PartnershipTicket
from app.db.models.product import Product
from app.db.models.product_variant import ProductVariant
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.collaboration import (
    CollabBoardStats,
    CollabProductOut,
    CollabStageTransition,
    CollaborationCreate,
    CollaborationOut,
    CollaborationUpdate,
)
from app.services.collab_pipeline import (
    COLLAB_OVERDUE_MAX_DAYS,
    COLLAB_STAGE_INDEX,
    STAGE_REQUIRED_FIELDS,
    STARTABLE_STAGES,
    apply_stage_transition,
    effective_live_dates,
    is_video_live,
)

router = APIRouter(
    prefix="/collaborations", tags=["collaborations"], dependencies=[Depends(require_creator_workspace_access)]
)


def _is_overdue(collab: Collaboration) -> bool:
    max_days = COLLAB_OVERDUE_MAX_DAYS.get(collab.stage)
    if max_days is None:
        return False
    age = datetime.now(timezone.utc) - collab.last_activity_at
    return age > timedelta(days=max_days)


async def _get_collaboration_or_404(collab_id: int, db: AsyncSession, user: User | None = None) -> Collaboration:
    collab = await db.get(Collaboration, collab_id)
    if collab is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collaboration not found")
    if user is not None:
        owner_ids = await scoped_owner_ids(user, db)
        if owner_ids is not None and collab.owner_id not in owner_ids:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collaboration not found")
    return collab


async def _next_collab_code(db: AsyncSession, year: int) -> str:
    """Next CLB-{year}-XXXX code, based on the highest number actually in
    use for this year rather than a total row count -- COUNT(*) silently
    goes stale (and starts colliding with existing codes) the moment any
    collaboration is ever deleted, since the count then undercounts the
    highest number already issued."""
    prefix = f"CLB-{year}-"
    codes = (
        await db.execute(select(Collaboration.collab_code).where(Collaboration.collab_code.like(f"{prefix}%")))
    ).scalars().all()
    max_num = max((int(suffix) for code in codes if (suffix := code[len(prefix) :]).isdigit()), default=0)
    return f"{prefix}{max_num + 1:04d}"


async def _creator_aggregates(db: AsyncSession, creator_ids: list[int]) -> dict[int, tuple[int, int]]:
    """Returns {creator_id: (total_collabs, videos_live)} across ALL of that
    creator's collaborations (not just the ones in the current filtered list).
    A collab counts as one video once Live, regardless of how many products
    share credit for it -- see get_video_credit_by_product for the per-product
    split used on the Dashboard instead."""
    if not creator_ids:
        return {}
    result = await db.execute(
        select(Collaboration.creator_id, Collaboration.stage).where(Collaboration.creator_id.in_(creator_ids))
    )
    aggregates: dict[int, tuple[int, int]] = {cid: (0, 0) for cid in creator_ids}
    for creator_id, stage in result.all():
        total, live = aggregates[creator_id]
        aggregates[creator_id] = (total + 1, live + (1 if is_video_live(stage) else 0))
    return aggregates


async def _validate_product_variants(
    db: AsyncSession, product_variants: dict[int, int], linked_product_ids: set[int]
) -> dict[int, int]:
    """Confirms every product_id in the map is actually linked to this
    collaboration and every variant_id genuinely belongs to that product --
    returns the map unchanged if valid, otherwise 400s."""
    if not product_variants:
        return {}
    unknown_products = set(product_variants) - linked_product_ids
    if unknown_products:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A shade was set for a product that isn't linked to this collaboration.",
        )
    variants = (
        (await db.execute(select(ProductVariant).where(ProductVariant.id.in_(product_variants.values()))))
        .scalars()
        .all()
    )
    variant_by_id = {v.id: v for v in variants}
    for product_id, variant_id in product_variants.items():
        variant = variant_by_id.get(variant_id)
        if variant is None or variant.product_id != product_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid shade for this product.")
    return product_variants


async def _load_products_for_collabs(db: AsyncSession, collab_ids: list[int]) -> dict[int, list[CollabProductOut]]:
    if not collab_ids:
        return {}
    result = await db.execute(
        select(
            CollaborationProduct.collaboration_id,
            CollaborationProduct.product_id,
            Product.name,
            CollaborationProduct.is_primary,
            CollaborationProduct.is_live_attributed,
            CollaborationProduct.variant_id,
            ProductVariant.name,
        )
        .join(Product, Product.id == CollaborationProduct.product_id)
        .outerjoin(ProductVariant, ProductVariant.id == CollaborationProduct.variant_id)
        .where(CollaborationProduct.collaboration_id.in_(collab_ids))
    )
    rows = result.all()

    by_collab: dict[int, list[tuple[int, str, bool, bool, int | None, str | None]]] = {}
    for collab_id, product_id, product_name, is_primary, is_live_attributed, variant_id, variant_name in rows:
        by_collab.setdefault(collab_id, []).append(
            (product_id, product_name, is_primary, is_live_attributed, variant_id, variant_name)
        )

    out: dict[int, list[CollabProductOut]] = {}
    for collab_id, links in by_collab.items():
        live_count = sum(1 for _, _, _, live, _, _ in links if live)
        out[collab_id] = [
            CollabProductOut(
                product_id=pid,
                product_name=name,
                is_primary=is_primary,
                is_live_attributed=is_live,
                credit=(1 / live_count) if is_live and live_count else None,
                variant_id=variant_id,
                variant_name=variant_name,
            )
            for pid, name, is_primary, is_live, variant_id, variant_name in sorted(links, key=lambda l: not l[2])
        ]
    return out


async def _latest_approval_by_collab(
    db: AsyncSession, collab_ids: list[int]
) -> dict[int, tuple[str, str]]:
    """Most recent ApprovalRequest per collaboration_id (status, target) --
    drives the Kanban card's approval-shield color (gray/yellow/green/red)."""
    if not collab_ids:
        return {}
    rn = (
        func.row_number()
        .over(partition_by=ApprovalRequest.collaboration_id, order_by=ApprovalRequest.created_at.desc())
        .label("rn")
    )
    subq = (
        select(
            ApprovalRequest.collaboration_id.label("collaboration_id"),
            ApprovalRequest.status.label("status"),
            ApprovalRequest.target.label("target"),
            rn,
        )
        .where(ApprovalRequest.collaboration_id.in_(collab_ids))
        .subquery()
    )
    stmt = select(subq.c.collaboration_id, subq.c.status, subq.c.target).where(subq.c.rn == 1)
    rows = (await db.execute(stmt)).all()
    return {cid: (approval_status.value, target.value) for cid, approval_status, target in rows}


def _to_out(
    collab: Collaboration,
    creator: Creator,
    owner: User,
    products: list[CollabProductOut],
    agg: tuple[int, int],
    approval: tuple[str, str] | None = None,
    effective_live_date: date | None = None,
) -> CollaborationOut:
    total, live = agg
    return CollaborationOut(
        id=collab.id,
        collab_code=collab.collab_code,
        creator_id=collab.creator_id,
        creator_name=creator.name,
        creator_handle=creator.instagram_handle,
        products=products,
        owner_id=collab.owner_id,
        owner_name=owner.name,
        stage=collab.stage,
        priority=collab.priority,
        payment_status=collab.payment_status,
        commercial_amount=float(collab.commercial_amount) if collab.commercial_amount is not None else None,
        note=collab.note,
        creator_reply=collab.creator_reply,
        commercial_quoted=float(collab.commercial_quoted) if collab.commercial_quoted is not None else None,
        counter_quote_agent=float(collab.counter_quote_agent) if collab.counter_quote_agent is not None else None,
        counter_quote_creator=(
            float(collab.counter_quote_creator) if collab.counter_quote_creator is not None else None
        ),
        deal_type=collab.deal_type,
        content_type=collab.content_type,
        tracking_link=collab.tracking_link,
        order_id=collab.order_id,
        poc_code=collab.poc_code,
        video_link=collab.video_link,
        video_live_date=collab.video_live_date,
        effective_live_date=effective_live_date or collab.video_live_date,
        is_overdue=_is_overdue(collab),
        creator_total_collabs=total,
        creator_videos_live=live,
        created_at=collab.created_at,
        last_activity_at=collab.last_activity_at,
        ownership_revoked_at=collab.ownership_revoked_at,
        approval_status=approval[0] if approval else None,
        approval_target=approval[1] if approval else None,
    )


@router.get("", response_model=list[CollaborationOut])
async def list_collaborations(
    owner_id: int | None = None,
    product_id: int | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    include_dead: bool = True,
    limit: int = Query(200, le=1000),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[CollaborationOut]:
    owner_ids = await owner_scope_filter(user, db, owner_id)

    stmt = (
        select(Collaboration, Creator, User)
        .join(Creator, Creator.id == Collaboration.creator_id)
        .join(User, User.id == Collaboration.owner_id)
    )
    if owner_ids is not None:
        stmt = stmt.where(Collaboration.owner_id.in_(owner_ids))
    if product_id is not None:
        stmt = stmt.where(
            exists(
                select(CollaborationProduct.id).where(
                    CollaborationProduct.collaboration_id == Collaboration.id,
                    CollaborationProduct.product_id == product_id,
                )
            )
        )
    if not include_dead:
        stmt = stmt.where(Collaboration.stage != CollabStage.dead_leads)
    if date_from is not None:
        stmt = stmt.where(Collaboration.created_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(Collaboration.created_at < date_to + timedelta(days=1))
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(or_(Creator.name.ilike(pattern), Creator.instagram_handle.ilike(pattern)))

    stmt = stmt.order_by(Collaboration.last_activity_at.desc()).limit(limit)
    result = await db.execute(stmt)
    rows = result.all()

    aggregates = await _creator_aggregates(db, list({row[1].id for row in rows}))
    products_by_collab = await _load_products_for_collabs(db, [row[0].id for row in rows])
    approvals_by_collab = await _latest_approval_by_collab(db, [row[0].id for row in rows])
    live_dates_by_collab = await effective_live_dates(db, [row[0].id for row in rows])
    return [
        _to_out(
            c,
            creator,
            owner,
            products_by_collab.get(c.id, []),
            aggregates[creator.id],
            approvals_by_collab.get(c.id),
            live_dates_by_collab.get(c.id),
        )
        for c, creator, owner in rows
    ]


@router.get("/board-stats", response_model=CollabBoardStats)
async def collab_board_stats(
    owner_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CollabBoardStats:
    owner_ids = await owner_scope_filter(user, db, owner_id)

    stmt = select(Collaboration)
    if owner_ids is not None:
        stmt = stmt.where(Collaboration.owner_id.in_(owner_ids))
    result = await db.execute(stmt)
    collabs = list(result.scalars().all())

    unique_creators = len({c.creator_id for c in collabs})
    active_collaborations = sum(1 for c in collabs if c.stage != CollabStage.dead_leads)
    videos_live = sum(1 for c in collabs if is_video_live(c.stage))
    dead_leads = sum(1 for c in collabs if c.stage == CollabStage.dead_leads)

    return CollabBoardStats(
        unique_creators=unique_creators,
        active_collaborations=active_collaborations,
        videos_live=videos_live,
        dead_leads=dead_leads,
    )


@router.post("", response_model=CollaborationOut, status_code=status.HTTP_201_CREATED)
async def create_collaboration(
    payload: CollaborationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CollaborationOut:
    return await _create_collaboration(db, payload, user)


async def _create_collaboration(
    db: AsyncSession, payload: CollaborationCreate, user: User
) -> CollaborationOut:
    if payload.stage not in STARTABLE_STAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dead Leads isn't a valid starting stage -- move a card there instead of creating into it.",
        )

    required = STAGE_REQUIRED_FIELDS[payload.stage]
    if "creator_reply" in required and not (payload.creator_reply and payload.creator_reply.strip()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Creator reply is required for this stage.")
    if "commercial_quoted" in required and payload.commercial_quoted is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Commercial quoted is required for this stage.")
    if "commercial_amount" in required and payload.commercial_amount is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Commercial locked amount is required for this stage.")
    if "deal_type" in required and payload.deal_type is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Deal type (Paid/Barter) is required for this stage.")
    if "content_type" in required and payload.content_type is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Content type (Integrated/Dedicated) is required for this stage.")
    if "live_attribution" in required and not payload.live_attribution_product_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select every product featured in this video before creating a Live collaboration.",
        )

    creator = await db.get(Creator, payload.creator_id)
    if creator is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Creator not found")

    additional_ids = [pid for pid in dict.fromkeys(payload.additional_product_ids) if pid != payload.primary_product_id]
    all_product_ids = [payload.primary_product_id, *additional_ids]
    products = (await db.execute(select(Product).where(Product.id.in_(all_product_ids)))).scalars().all()
    if len(products) != len(all_product_ids):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more products not found")

    live_attribution_ids = set(payload.live_attribution_product_ids)
    if live_attribution_ids - set(all_product_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Live attribution can only include products already linked to this collaboration.",
        )

    variant_by_product = await _validate_product_variants(db, payload.product_variants, set(all_product_ids))

    owner_ids = await scoped_owner_ids(user, db)
    if owner_ids is not None and payload.owner_id is not None and payload.owner_id not in owner_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a valid owner within your team.")
    owner_id = payload.owner_id or user.id
    owner = await db.get(User, owner_id)
    if owner is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Owner not found")

    year = datetime.now(timezone.utc).year
    for attempt in range(3):
        collab_code = await _next_collab_code(db, year)
        collab = Collaboration(
            collab_code=collab_code,
            creator_id=payload.creator_id,
            owner_id=owner_id,
            stage=payload.stage,
            priority=payload.priority,
            note=payload.note,
            creator_reply=payload.creator_reply,
            commercial_quoted=payload.commercial_quoted,
            counter_quote_agent=payload.counter_quote_agent,
            counter_quote_creator=payload.counter_quote_creator,
            commercial_amount=payload.commercial_amount,
            deal_type=payload.deal_type,
            content_type=payload.content_type,
            tracking_link=payload.tracking_link,
            order_id=payload.order_id,
        )
        db.add(collab)
        try:
            await db.flush()
            break
        except IntegrityError:
            # Two requests computed the same next number at once -- roll
            # back and recompute against current state, up to 3 tries.
            await db.rollback()
            if attempt == 2:
                raise

    db.add(
        CollaborationProduct(
            collaboration_id=collab.id,
            product_id=payload.primary_product_id,
            is_primary=True,
            is_live_attributed=payload.primary_product_id in live_attribution_ids,
            variant_id=variant_by_product.get(payload.primary_product_id),
        )
    )
    for pid in additional_ids:
        db.add(
            CollaborationProduct(
                collaboration_id=collab.id,
                product_id=pid,
                is_primary=False,
                is_live_attributed=pid in live_attribution_ids,
                variant_id=variant_by_product.get(pid),
            )
        )

    db.add(CollabStageEvent(collaboration_id=collab.id, from_stage=None, to_stage=payload.stage, actor_id=user.id))
    await db.commit()
    await db.refresh(collab)

    aggregates = await _creator_aggregates(db, [creator.id])
    products_by_collab = await _load_products_for_collabs(db, [collab.id])
    live_date = (await effective_live_dates(db, [collab.id])).get(collab.id)
    return _to_out(
        collab, creator, owner, products_by_collab.get(collab.id, []), aggregates[creator.id], None, live_date
    )


@router.post("/{collab_id}/clone", response_model=CollaborationOut, status_code=status.HTTP_201_CREATED)
async def clone_collaboration(
    collab_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CollaborationOut:
    """Duplicates a collaboration for a second (or third...) deliverable
    from the same creator -- same creator, products/shades, priority,
    commercial terms, deal/content type, tracking info, and note, but a
    fresh collab_code/id and reset to New leads, since the clone needs to
    walk its own pipeline (reply, negotiation, delivery, live) rather than
    inheriting the source card's stage, video link, live date or payment
    status."""
    source = await _get_collaboration_or_404(collab_id, db, user)
    products = (await _load_products_for_collabs(db, [source.id])).get(source.id, [])
    if not products:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Source collaboration has no linked products.")
    primary = next((p for p in products if p.is_primary), products[0])
    additional = [p for p in products if p.product_id != primary.product_id]

    payload = CollaborationCreate(
        creator_id=source.creator_id,
        owner_id=source.owner_id,
        primary_product_id=primary.product_id,
        additional_product_ids=[p.product_id for p in additional],
        live_attribution_product_ids=[],
        product_variants={p.product_id: p.variant_id for p in products if p.variant_id is not None},
        priority=source.priority,
        stage=CollabStage.new_lead,
        note=source.note,
        creator_reply=source.creator_reply,
        commercial_quoted=source.commercial_quoted,
        counter_quote_agent=source.counter_quote_agent,
        counter_quote_creator=source.counter_quote_creator,
        commercial_amount=source.commercial_amount,
        deal_type=source.deal_type,
        content_type=source.content_type,
        tracking_link=source.tracking_link,
        order_id=source.order_id,
    )
    return await _create_collaboration(db, payload, user)


@router.delete("/{collab_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collaboration(
    collab_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> None:
    """Admin-only. Deletes exactly this one Collab ID, at any stage --
    the creator record and any of its other collaboration cards are
    untouched (a creator can hold several collab cards, see the
    clone-card feature)."""
    collab = await db.get(Collaboration, collab_id)
    if collab is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collaboration not found")

    await db.execute(delete(PartnershipTicket).where(PartnershipTicket.collaboration_id == collab_id))
    await db.execute(delete(ApprovalRequest).where(ApprovalRequest.collaboration_id == collab_id))
    await db.execute(delete(CollabStageEvent).where(CollabStageEvent.collaboration_id == collab_id))
    await db.execute(delete(CollaborationProduct).where(CollaborationProduct.collaboration_id == collab_id))
    await db.delete(collab)
    await db.commit()


@router.patch("/{collab_id}", response_model=CollaborationOut)
async def update_collaboration(
    collab_id: int,
    payload: CollaborationUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CollaborationOut:
    collab = await _get_collaboration_or_404(collab_id, db, user)
    update_data = payload.model_dump(exclude_unset=True)
    additional_product_ids = update_data.pop("additional_product_ids", None)
    live_attribution_product_ids = update_data.pop("live_attribution_product_ids", None)
    product_variants = update_data.pop("product_variants", None)

    for field, value in update_data.items():
        setattr(collab, field, value)

    if additional_product_ids is not None or live_attribution_product_ids is not None or product_variants is not None:
        existing_links = (
            (
                await db.execute(
                    select(CollaborationProduct).where(CollaborationProduct.collaboration_id == collab.id)
                )
            )
            .scalars()
            .all()
        )
        primary_link = next((link for link in existing_links if link.is_primary), None)
        primary_product_id = primary_link.product_id if primary_link else None

        if additional_product_ids is not None:
            keep_ids = {primary_product_id, *additional_product_ids} if primary_product_id else set(
                additional_product_ids
            )
            for link in existing_links:
                if not link.is_primary and link.product_id not in keep_ids:
                    await db.delete(link)
            existing_ids = {link.product_id for link in existing_links}
            for pid in additional_product_ids:
                if pid != primary_product_id and pid not in existing_ids:
                    db.add(CollaborationProduct(collaboration_id=collab.id, product_id=pid, is_primary=False))
            await db.flush()
            existing_links = (
                (
                    await db.execute(
                        select(CollaborationProduct).where(CollaborationProduct.collaboration_id == collab.id)
                    )
                )
                .scalars()
                .all()
            )

        if live_attribution_product_ids is not None:
            linked_ids = {link.product_id for link in existing_links}
            invalid = set(live_attribution_product_ids) - linked_ids
            if invalid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Live attribution can only include products already linked to this collaboration.",
                )
            for link in existing_links:
                link.is_live_attributed = link.product_id in live_attribution_product_ids

        if product_variants is not None:
            linked_ids = {link.product_id for link in existing_links}
            variant_by_product = await _validate_product_variants(db, product_variants, linked_ids)
            links_by_product = {link.product_id: link for link in existing_links}
            for product_id, link in links_by_product.items():
                link.variant_id = variant_by_product.get(product_id)

    collab.last_activity_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(collab)

    creator = await db.get(Creator, collab.creator_id)
    owner = await db.get(User, collab.owner_id)
    aggregates = await _creator_aggregates(db, [collab.creator_id])
    products_by_collab = await _load_products_for_collabs(db, [collab.id])
    live_date = (await effective_live_dates(db, [collab.id])).get(collab.id)
    return _to_out(
        collab,
        creator,
        owner,
        products_by_collab.get(collab.id, []),
        aggregates[collab.creator_id],
        None,
        live_date,
    )


@router.post("/{collab_id}/stage", response_model=CollaborationOut)
async def transition_collab_stage(
    collab_id: int,
    payload: CollabStageTransition,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CollaborationOut:
    collab = await _get_collaboration_or_404(collab_id, db, user)
    creator = await db.get(Creator, collab.creator_id)

    if collab.stage == CollabStage.dead_leads and payload.to_stage != CollabStage.dead_leads and user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only an admin can move a card out of Dead Leads.",
        )

    is_forward_move = COLLAB_STAGE_INDEX[payload.to_stage] > COLLAB_STAGE_INDEX[collab.stage]
    if is_forward_move:
        required = STAGE_REQUIRED_FIELDS.get(payload.to_stage, [])
        missing: list[str] = []

        if "creator_reply" in required and not (
            (payload.creator_reply and payload.creator_reply.strip())
            or (collab.creator_reply and collab.creator_reply.strip())
        ):
            missing.append("creator_reply")
        # Phone isn't required to add a new lead, but the creator must be
        # reachable once they've actually replied -- same stage threshold as
        # creator_reply itself. Email stays optional throughout.
        if "creator_reply" in required and not (
            (payload.creator_phone and payload.creator_phone.strip()) or (creator.phone and creator.phone.strip())
        ):
            missing.append("creator_phone")
        if "commercial_quoted" in required and payload.commercial_quoted is None and collab.commercial_quoted is None:
            missing.append("commercial_quoted")
        if "commercial_amount" in required and payload.commercial_amount is None and collab.commercial_amount is None:
            missing.append("commercial_amount")
        if "deal_type" in required and payload.deal_type is None and collab.deal_type is None:
            missing.append("deal_type")
        if "content_type" in required and payload.content_type is None and collab.content_type is None:
            missing.append("content_type")
        if "live_attribution" in required:
            has_existing_attribution = (
                await db.execute(
                    select(CollaborationProduct.id).where(
                        CollaborationProduct.collaboration_id == collab.id,
                        CollaborationProduct.is_live_attributed.is_(True),
                    )
                )
            ).first() is not None
            if not payload.live_attribution_product_ids and not has_existing_attribution:
                missing.append("live_attribution")

        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "This move needs a few fields filled in first.",
                    "missing_fields": missing,
                },
            )

        if payload.creator_phone is not None:
            creator.phone = payload.creator_phone
        if payload.creator_email is not None:
            creator.email = payload.creator_email
        if payload.creator_reply is not None:
            collab.creator_reply = payload.creator_reply
        if payload.commercial_quoted is not None:
            collab.commercial_quoted = payload.commercial_quoted
        if payload.counter_quote_agent is not None:
            collab.counter_quote_agent = payload.counter_quote_agent
        if payload.counter_quote_creator is not None:
            collab.counter_quote_creator = payload.counter_quote_creator
        if payload.commercial_amount is not None:
            collab.commercial_amount = payload.commercial_amount
        if payload.deal_type is not None:
            collab.deal_type = payload.deal_type
        if payload.content_type is not None:
            collab.content_type = payload.content_type
        if payload.live_attribution_product_ids is not None:
            links = (
                (
                    await db.execute(
                        select(CollaborationProduct).where(CollaborationProduct.collaboration_id == collab.id)
                    )
                )
                .scalars()
                .all()
            )
            linked_ids = {link.product_id for link in links}
            invalid = set(payload.live_attribution_product_ids) - linked_ids
            if invalid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Live attribution can only include products already linked to this collaboration.",
                )
            for link in links:
                link.is_live_attributed = link.product_id in payload.live_attribution_product_ids

    if payload.video_live_date is not None:
        collab.video_live_date = payload.video_live_date

    await apply_stage_transition(db, collab, creator, payload.to_stage, user.id, payload.note, bump_activity=True)

    await db.commit()
    await db.refresh(collab)

    creator = await db.get(Creator, collab.creator_id)
    owner = await db.get(User, collab.owner_id)
    aggregates = await _creator_aggregates(db, [collab.creator_id])
    products_by_collab = await _load_products_for_collabs(db, [collab.id])
    live_date = (await effective_live_dates(db, [collab.id])).get(collab.id)
    return _to_out(
        collab,
        creator,
        owner,
        products_by_collab.get(collab.id, []),
        aggregates[collab.creator_id],
        None,
        live_date,
    )

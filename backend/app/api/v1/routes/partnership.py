from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, scoped_owner_ids
from app.db.models.collab_stage_event import CollabStageEvent
from app.db.models.collaboration import Collaboration
from app.db.models.collaboration_product import CollaborationProduct
from app.db.models.creator import Creator
from app.db.models.enums import CollabStage, PartnershipCollabStatus, Platform, TicketStatus, UserRole
from app.db.models.partnership_remark import PartnershipRemark
from app.db.models.partnership_ticket import PartnershipTicket
from app.db.models.product import Product
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.partnership import (
    PartnershipAdminCounterRequest,
    PartnershipBulkTakeActionRequest,
    PartnershipEditorTicketOut,
    PartnershipMetadataRequest,
    PartnershipOpenRow,
    PartnershipOverviewRow,
    PartnershipRemarkOut,
    PartnershipRequestChangeRequest,
    PartnershipRespondRequest,
    PartnershipStats,
    PartnershipTakeActionRequest,
    PartnershipTicketDetailOut,
    PartnershipVerifyCloseRequest,
)
from app.services.collab_pipeline import effective_live_dates
from app.services.partnership_pipeline import (
    REMARK_TAG_ADMIN_COUNTER,
    REMARK_TAG_ADMIN_REQUEST,
    REMARK_TAG_AGENT_RESPONSE,
    REMARK_TAG_CHANGE_REQUESTED,
    REMARK_TAG_CTA_SUBMITTED,
    REMARK_TAG_VERIFIED_CLOSED,
    aging_bucket,
    partnership_stats,
    redact_commercial,
    redact_for_editor,
    requested_chips,
    scoped_ticket_ids,
    should_redact_commercial,
)

# Deliberately NO router-level access guard (unlike campaigns.router's
# require_campaign_access). Editor must be admitted here -- their real work
# ("CTA tasks") lives in this module, just hard-scoped to requested_cta_link
# tickets inside each handler. Do not "fix" this by copy-pasting a guard.
router = APIRouter(prefix="/partnership", tags=["partnership"])


async def _get_ticket_or_404(ticket_id: int, db: AsyncSession, user: User) -> tuple[PartnershipTicket, Collaboration]:
    ticket = await db.get(PartnershipTicket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    collab = await db.get(Collaboration, ticket.collaboration_id)

    if user.role in (UserRole.admin, UserRole.marketer):
        return ticket, collab
    if user.role == UserRole.editor:
        if not ticket.requested_cta_link:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
        return ticket, collab
    owner_ids = await scoped_owner_ids(user, db)
    if owner_ids is not None and collab.owner_id not in owner_ids:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return ticket, collab


async def _batch_load(db: AsyncSession, tickets: list[PartnershipTicket]) -> dict:
    collab_ids = [t.collaboration_id for t in tickets]
    ticket_ids = [t.id for t in tickets]
    if not collab_ids:
        return {"collabs": {}, "products": {}, "live_dates": {}, "remarks": {}}

    collabs_result = await db.execute(
        select(Collaboration, Creator, User)
        .join(Creator, Creator.id == Collaboration.creator_id)
        .join(User, User.id == Collaboration.owner_id)
        .where(Collaboration.id.in_(collab_ids))
    )
    collabs_by_id = {c.id: (c, creator, owner) for c, creator, owner in collabs_result.all()}

    products_result = await db.execute(
        select(CollaborationProduct.collaboration_id, Product.name)
        .join(Product, Product.id == CollaborationProduct.product_id)
        .where(CollaborationProduct.collaboration_id.in_(collab_ids))
    )
    products_by_collab: dict[int, list[str]] = defaultdict(list)
    for cid, name in products_result.all():
        products_by_collab[cid].append(name)

    # Prefers each collab's explicit video_live_date when the user set one,
    # falling back to the first transition-to-Live event -- see
    # collab_pipeline.effective_live_dates for the shared rule.
    effective_dates = await effective_live_dates(db, collab_ids)
    live_date_by_collab: dict[int, datetime] = {
        cid: datetime.combine(d, datetime.min.time(), tzinfo=timezone.utc) for cid, d in effective_dates.items()
    }

    remarks_result = await db.execute(
        select(PartnershipRemark, User.name)
        .join(User, User.id == PartnershipRemark.author_id)
        .where(PartnershipRemark.ticket_id.in_(ticket_ids))
        .order_by(PartnershipRemark.created_at.desc())
    )
    remarks_by_ticket: dict[int, list[tuple[PartnershipRemark, str]]] = defaultdict(list)
    for remark, author_name in remarks_result.all():
        remarks_by_ticket[remark.ticket_id].append((remark, author_name))

    return {
        "collabs": collabs_by_id,
        "products": products_by_collab,
        "live_dates": live_date_by_collab,
        "remarks": remarks_by_ticket,
    }


def _to_overview_row(ticket: PartnershipTicket, batch: dict, user: User) -> PartnershipOverviewRow:
    collab, creator, owner = batch["collabs"][ticket.collaboration_id]
    products = batch["products"].get(ticket.collaboration_id, [])
    live_date = batch["live_dates"].get(ticket.collaboration_id)
    remarks = batch["remarks"].get(ticket.id, [])
    latest_remark, latest_author = (remarks[0][0].body, remarks[0][1]) if remarks else (None, None)

    data = dict(
        ticket_id=ticket.id,
        collaboration_id=collab.id,
        collab_code=collab.collab_code,
        poc_code=collab.poc_code,
        video_name=creator.name,
        creator_handle=creator.instagram_handle,
        product_names=products,
        owner_id=owner.id,
        owner_name=owner.name,
        live_date=live_date,
        comments_count=collab.comments_count,
        views_count=collab.views_count,
        content_bucket=ticket.content_bucket,
        language=ticket.language,
        creator_category=creator.category,
        platform=collab.platform,
        ad_rights_creator_quote=ticket.ad_rights_creator_quote,
        ad_rights_agent_counter=ticket.ad_rights_agent_counter,
        ad_rights_admin_counter=ticket.ad_rights_admin_counter,
        ad_rights_amount=ticket.ad_rights_amount,
        ad_code=ticket.ad_code,
        ad_right_duration_days=ticket.ad_right_duration_days,
        ad_right_expires_at=ticket.ad_right_expires_at,
        cta_link=ticket.cta_link,
        ticket_status=ticket.ticket_status,
        collab_status=ticket.collab_status,
        latest_remark=latest_remark,
        latest_remark_author=latest_author,
        remark_count=len(remarks),
    )
    if user.role == UserRole.editor:
        data = redact_for_editor(data)
    elif should_redact_commercial(user):
        data = redact_commercial(data)
    return PartnershipOverviewRow(**data)


def _to_open_row(ticket: PartnershipTicket, batch: dict, user: User) -> PartnershipOpenRow:
    overview = _to_overview_row(ticket, batch, user)
    bucket, days = aging_bucket(ticket.first_requested_at, ticket.ticket_status)
    return PartnershipOpenRow(
        **overview.model_dump(),
        aging_bucket=bucket,
        aging_days=days,
        response_due_at=ticket.response_due_at,
        requested=requested_chips(ticket),
    )


async def _filtered_tickets(
    db: AsyncSession,
    user: User,
    owner_id: int | None,
    product_id: int | None,
    platform: Platform | None,
    content_bucket: str | None,
    language: str | None,
    category: str | None,
    search: str | None,
) -> list[PartnershipTicket]:
    scope = await scoped_ticket_ids(user, db)
    stmt = select(PartnershipTicket).join(Collaboration, Collaboration.id == PartnershipTicket.collaboration_id)
    if scope is not None:
        stmt = stmt.where(PartnershipTicket.id.in_(scope))
    if owner_id is not None:
        stmt = stmt.where(Collaboration.owner_id == owner_id)
    if platform is not None:
        stmt = stmt.where(Collaboration.platform == platform)
    if content_bucket is not None:
        stmt = stmt.where(PartnershipTicket.content_bucket == content_bucket)
    if language is not None:
        stmt = stmt.where(PartnershipTicket.language == language)
    if product_id is not None:
        stmt = stmt.where(
            Collaboration.id.in_(
                select(CollaborationProduct.collaboration_id).where(CollaborationProduct.product_id == product_id)
            )
        )
    if category is not None or search:
        stmt = stmt.join(Creator, Creator.id == Collaboration.creator_id)
        if category is not None:
            stmt = stmt.where(Creator.category == category)
        if search:
            pattern = f"%{search}%"
            stmt = stmt.where(or_(Creator.name.ilike(pattern), Creator.instagram_handle.ilike(pattern)))

    return list((await db.execute(stmt)).scalars().all())


@router.get("/stats", response_model=PartnershipStats)
async def get_partnership_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PartnershipStats:
    return await partnership_stats(db, user)


@router.get("", response_model=list[PartnershipOverviewRow])
async def list_overview(
    owner_id: int | None = None,
    product_id: int | None = None,
    platform: Platform | None = None,
    content_bucket: str | None = None,
    language: str | None = None,
    category: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[PartnershipOverviewRow]:
    tickets = await _filtered_tickets(db, user, owner_id, product_id, platform, content_bucket, language, category, search)
    batch = await _batch_load(db, tickets)
    return [_to_overview_row(t, batch, user) for t in tickets]


@router.get("/open", response_model=list[PartnershipOpenRow])
async def list_open(
    owner_id: int | None = None,
    product_id: int | None = None,
    platform: Platform | None = None,
    content_bucket: str | None = None,
    language: str | None = None,
    category: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[PartnershipOpenRow]:
    tickets = await _filtered_tickets(db, user, owner_id, product_id, platform, content_bucket, language, category, search)
    tickets = [t for t in tickets if t.ticket_status != TicketStatus.closed_and_live]
    batch = await _batch_load(db, tickets)
    return [_to_open_row(t, batch, user) for t in tickets]


@router.get("/closed", response_model=list[PartnershipOverviewRow])
async def list_closed(
    owner_id: int | None = None,
    product_id: int | None = None,
    platform: Platform | None = None,
    content_bucket: str | None = None,
    language: str | None = None,
    category: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[PartnershipOverviewRow]:
    tickets = await _filtered_tickets(db, user, owner_id, product_id, platform, content_bucket, language, category, search)
    tickets = [t for t in tickets if t.ticket_status == TicketStatus.closed_and_live]
    batch = await _batch_load(db, tickets)
    return [_to_overview_row(t, batch, user) for t in tickets]


@router.get("/{ticket_id}")
async def get_ticket_detail(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ticket, collab = await _get_ticket_or_404(ticket_id, db, user)
    batch = await _batch_load(db, [ticket])
    _, creator, owner = batch["collabs"][ticket.collaboration_id]
    products = batch["products"].get(ticket.collaboration_id, [])
    live_date = batch["live_dates"].get(ticket.collaboration_id)
    remark_pairs = batch["remarks"].get(ticket.id, [])
    author_ids = {r.author_id for r, _ in remark_pairs}
    authors_result = await db.execute(select(User.id, User.role).where(User.id.in_(author_ids))) if author_ids else None
    role_by_author = {uid: role for uid, role in authors_result.all()} if authors_result is not None else {}
    remarks = [
        PartnershipRemarkOut(
            id=r.id, author_id=r.author_id, author_name=name,
            author_role=role_by_author[r.author_id].value,
            body=r.body, tag=r.tag, created_at=r.created_at,
        )
        for r, name in remark_pairs
    ]

    if user.role == UserRole.editor:
        return PartnershipEditorTicketOut(
            id=ticket.id,
            collaboration_id=collab.id,
            collab_code=collab.collab_code,
            video_name=creator.name,
            product_names=products,
            owner_id=owner.id,
            owner_name=owner.name,
            live_date=live_date,
            ticket_status=ticket.ticket_status,
            cta_link=ticket.cta_link,
            remarks=remarks,
        )

    bucket, days = aging_bucket(ticket.first_requested_at, ticket.ticket_status)
    data = dict(
        id=ticket.id,
        collaboration_id=collab.id,
        collab_code=collab.collab_code,
        video_name=creator.name,
        creator_handle=creator.instagram_handle,
        product_names=products,
        owner_id=owner.id,
        owner_name=owner.name,
        live_date=live_date,
        content_bucket=ticket.content_bucket,
        language=ticket.language,
        ticket_status=ticket.ticket_status,
        collab_status=ticket.collab_status,
        requested_ad_rights=ticket.requested_ad_rights,
        requested_ad_code=ticket.requested_ad_code,
        requested_cta_link=ticket.requested_cta_link,
        ad_rights_creator_quote=ticket.ad_rights_creator_quote,
        ad_rights_agent_counter=ticket.ad_rights_agent_counter,
        ad_rights_admin_counter=ticket.ad_rights_admin_counter,
        ad_rights_amount=ticket.ad_rights_amount,
        ad_code=ticket.ad_code,
        ad_right_duration_days=ticket.ad_right_duration_days,
        ad_right_expires_at=ticket.ad_right_expires_at,
        cta_link=ticket.cta_link,
        response_due_at=ticket.response_due_at,
        aging_bucket=bucket,
        aging_days=days,
        remarks=remarks,
    )
    if should_redact_commercial(user):
        data = redact_commercial(data)
    return PartnershipTicketDetailOut(**data)


def _apply_take_action(ticket: PartnershipTicket, payload: PartnershipTakeActionRequest, actor: User, db: AsyncSession) -> None:
    ticket.requested_ad_rights = payload.requested_ad_rights
    ticket.requested_ad_code = payload.requested_ad_code
    ticket.requested_cta_link = payload.requested_cta_link
    ticket.collab_status = payload.collab_status
    ticket.response_due_at = payload.response_due_at
    if ticket.first_requested_at is None:
        ticket.first_requested_at = datetime.now(timezone.utc)
    ticket.ticket_status = TicketStatus.pending_at_user
    db.add(PartnershipRemark(ticket_id=ticket.id, author_id=actor.id, body=payload.remark, tag=REMARK_TAG_ADMIN_REQUEST))


@router.post("/{ticket_id}/take-action")
async def take_action(
    ticket_id: int,
    payload: PartnershipTakeActionRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role not in (UserRole.admin, UserRole.marketer):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not available for this role.")
    ticket, _ = await _get_ticket_or_404(ticket_id, db, user)
    _apply_take_action(ticket, payload, user, db)
    await db.commit()
    return await get_ticket_detail(ticket_id, db, user)


@router.post("/take-action/bulk")
async def take_action_bulk(
    payload: PartnershipBulkTakeActionRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, int]:
    if user.role not in (UserRole.admin, UserRole.marketer):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not available for this role.")
    updated = 0
    for ticket_id in payload.ticket_ids:
        ticket, _ = await _get_ticket_or_404(ticket_id, db, user)
        _apply_take_action(ticket, payload, user, db)
        updated += 1
    await db.commit()
    return {"updated": updated}


@router.post("/{ticket_id}/respond")
async def respond_to_ticket(
    ticket_id: int,
    payload: PartnershipRespondRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ticket, collab = await _get_ticket_or_404(ticket_id, db, user)
    if ticket.ticket_status != TicketStatus.pending_at_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This ticket isn't awaiting your response.")

    if user.role == UserRole.editor:
        if not payload.cta_link:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A CTA link is required.")
        ticket.cta_link = payload.cta_link
        db.add(PartnershipRemark(ticket_id=ticket.id, author_id=user.id, body=payload.remark, tag=REMARK_TAG_CTA_SUBMITTED))
    elif user.role == UserRole.advisor:
        if collab.owner_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This isn't your collaboration.")
        if payload.ad_code is not None:
            ticket.ad_code = payload.ad_code
        if payload.ad_right_duration_days is not None:
            ticket.ad_right_duration_days = payload.ad_right_duration_days
        if payload.ad_right_expires_at is not None:
            ticket.ad_right_expires_at = payload.ad_right_expires_at
        if payload.ad_rights_agent_counter is not None:
            ticket.ad_rights_agent_counter = payload.ad_rights_agent_counter
        db.add(PartnershipRemark(ticket_id=ticket.id, author_id=user.id, body=payload.remark, tag=REMARK_TAG_AGENT_RESPONSE))
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not available for this role.")

    ticket.ticket_status = TicketStatus.pending_at_admin
    await db.commit()
    return await get_ticket_detail(ticket_id, db, user)


@router.post("/{ticket_id}/send-counter", response_model=PartnershipTicketDetailOut)
async def send_counter(
    ticket_id: int,
    payload: PartnershipAdminCounterRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    ticket, _ = await _get_ticket_or_404(ticket_id, db, user)
    ticket.ad_rights_admin_counter = payload.ad_rights_admin_counter
    if payload.collab_status is not None:
        ticket.collab_status = payload.collab_status
    ticket.ticket_status = TicketStatus.pending_at_user
    db.add(PartnershipRemark(ticket_id=ticket.id, author_id=user.id, body=payload.remark, tag=REMARK_TAG_ADMIN_COUNTER))
    await db.commit()
    return await get_ticket_detail(ticket_id, db, user)


@router.post("/{ticket_id}/request-change", response_model=PartnershipTicketDetailOut)
async def request_change(
    ticket_id: int,
    payload: PartnershipRequestChangeRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    ticket, _ = await _get_ticket_or_404(ticket_id, db, user)
    if payload.collab_status is not None:
        ticket.collab_status = payload.collab_status
    ticket.ticket_status = TicketStatus.pending_at_user
    db.add(PartnershipRemark(ticket_id=ticket.id, author_id=user.id, body=payload.remark, tag=REMARK_TAG_CHANGE_REQUESTED))
    await db.commit()
    return await get_ticket_detail(ticket_id, db, user)


@router.post("/{ticket_id}/metadata", response_model=PartnershipTicketDetailOut)
async def update_metadata(
    ticket_id: int,
    payload: PartnershipMetadataRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role not in (UserRole.admin, UserRole.advisor):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not available for this role.")
    ticket, _ = await _get_ticket_or_404(ticket_id, db, user)
    ticket.content_bucket = payload.content_bucket
    ticket.language = payload.language
    await db.commit()
    return await get_ticket_detail(ticket_id, db, user)


@router.post("/{ticket_id}/verify-close", response_model=PartnershipTicketDetailOut)
async def verify_close(
    ticket_id: int,
    payload: PartnershipVerifyCloseRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    ticket, _ = await _get_ticket_or_404(ticket_id, db, user)
    if ticket.requested_ad_rights and payload.ad_rights_amount is None and ticket.ad_rights_amount is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A locked commercial amount is required to close.")
    if payload.ad_rights_amount is not None:
        ticket.ad_rights_amount = payload.ad_rights_amount
    ticket.ticket_status = TicketStatus.closed_and_live
    ticket.collab_status = PartnershipCollabStatus.closed_and_live
    if payload.remark:
        db.add(PartnershipRemark(ticket_id=ticket.id, author_id=user.id, body=payload.remark, tag=REMARK_TAG_VERIFIED_CLOSED))
    await db.commit()
    return await get_ticket_detail(ticket_id, db, user)

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import (
    get_current_user,
    owner_scope_filter,
    require_creator_workspace_access,
    scoped_owner_ids,
)
from app.db.models.approval_request import ApprovalRequest
from app.db.models.collaboration import Collaboration
from app.db.models.collaboration_product import CollaborationProduct
from app.db.models.creator import Creator
from app.db.models.enums import ApprovalStatus, ApprovalTarget, UserRole
from app.db.models.product import Product
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.approval_request import ApprovalRequestCreate, ApprovalRequestOut
from app.services.collab_pipeline import COLLAB_STAGE_LABELS

router = APIRouter(
    prefix="/approval-requests",
    tags=["approval-requests"],
    dependencies=[Depends(require_creator_workspace_access)],
)


async def _get_primary_product(db: AsyncSession, collaboration_id: int) -> Product | None:
    result = await db.execute(
        select(Product)
        .join(CollaborationProduct, CollaborationProduct.product_id == Product.id)
        .where(
            CollaborationProduct.collaboration_id == collaboration_id,
            CollaborationProduct.is_primary.is_(True),
        )
    )
    return result.scalar_one_or_none()


def _to_out(req: ApprovalRequest, collab: Collaboration, creator: Creator, product: Product | None, requester: User) -> ApprovalRequestOut:
    return ApprovalRequestOut(
        id=req.id,
        request_code=req.request_code,
        collaboration_id=req.collaboration_id,
        creator_name=creator.name,
        creator_handle=creator.instagram_handle,
        product_name=product.name if product else "",
        collab_stage_label=COLLAB_STAGE_LABELS[collab.stage],
        requested_by=req.requested_by,
        requested_by_name=requester.name,
        priority=req.priority,
        note=req.note,
        status=req.status,
        target=req.target,
        created_at=req.created_at,
        resolved_at=req.resolved_at,
    )


@router.get("", response_model=list[ApprovalRequestOut])
async def list_approval_requests(
    owner_id: int | None = None,
    status_filter: ApprovalStatus | None = Query(None, alias="status"),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ApprovalRequestOut]:
    stmt = (
        select(ApprovalRequest, Collaboration, Creator, User)
        .join(Collaboration, Collaboration.id == ApprovalRequest.collaboration_id)
        .join(Creator, Creator.id == Collaboration.creator_id)
        .join(User, User.id == ApprovalRequest.requested_by)
    )
    if user.role == UserRole.advisor:
        stmt = stmt.where(ApprovalRequest.requested_by == user.id)
    else:
        owner_ids = await owner_scope_filter(user, db, owner_id)
        if owner_ids is not None:
            stmt = stmt.where(Collaboration.owner_id.in_(owner_ids))
        if user.role == UserRole.supervisor:
            # A supervisor's queue only surfaces requests actually routed to
            # them -- admin-targeted requests stay admin-only even though
            # the collaboration is within this supervisor's team.
            stmt = stmt.where(ApprovalRequest.target == ApprovalTarget.supervisor)

    if status_filter is not None:
        stmt = stmt.where(ApprovalRequest.status == status_filter)

    stmt = stmt.order_by(ApprovalRequest.created_at.desc()).limit(limit)
    rows = (await db.execute(stmt)).all()
    return [
        _to_out(req, collab, creator, await _get_primary_product(db, collab.id), requester)
        for req, collab, creator, requester in rows
    ]


@router.post("", response_model=ApprovalRequestOut, status_code=status.HTTP_201_CREATED)
async def create_approval_request(
    payload: ApprovalRequestCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ApprovalRequestOut:
    collab = await db.get(Collaboration, payload.collaboration_id)
    if collab is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collaboration not found")
    owner_ids = await scoped_owner_ids(user, db)
    if owner_ids is not None and collab.owner_id not in owner_ids:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collaboration not found")

    if payload.target == ApprovalTarget.supervisor:
        owner = await db.get(User, collab.owner_id)
        if owner is None or owner.supervisor_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This creator's owner has no supervisor assigned -- send to Admin instead.",
            )

    year = datetime.now(timezone.utc).year
    count = (await db.execute(select(func.count(ApprovalRequest.id)))).scalar_one()
    request_code = f"APR-{year}-{count + 1:04d}"

    req = ApprovalRequest(
        request_code=request_code,
        collaboration_id=payload.collaboration_id,
        requested_by=user.id,
        priority=payload.priority,
        note=payload.note,
        target=payload.target,
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)

    creator = await db.get(Creator, collab.creator_id)
    product = await _get_primary_product(db, collab.id)
    return _to_out(req, collab, creator, product, user)


async def _get_request_or_404(request_id: int, db: AsyncSession) -> ApprovalRequest:
    req = await db.get(ApprovalRequest, request_id)
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval request not found")
    return req


async def _require_can_resolve(req: ApprovalRequest, db: AsyncSession, user: User) -> None:
    """Admin can resolve any request. A supervisor can only resolve one
    that's actually routed to them (target=supervisor) and within their
    own team -- everyone else (including a supervisor viewing an
    admin-targeted request) is forbidden."""
    if user.role == UserRole.admin:
        return
    if user.role == UserRole.supervisor and req.target == ApprovalTarget.supervisor:
        collab = await db.get(Collaboration, req.collaboration_id)
        owner_ids = await scoped_owner_ids(user, db)
        if collab is not None and (owner_ids is None or collab.owner_id in owner_ids):
            return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to resolve this request.")


@router.post("/{request_id}/approve", response_model=ApprovalRequestOut)
async def approve_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ApprovalRequestOut:
    req = await _get_request_or_404(request_id, db)
    await _require_can_resolve(req, db, user)
    req.status = ApprovalStatus.approved
    req.resolved_at = datetime.now(timezone.utc)
    req.resolved_by = user.id
    await db.commit()
    await db.refresh(req)

    collab = await db.get(Collaboration, req.collaboration_id)
    creator = await db.get(Creator, collab.creator_id)
    product = await _get_primary_product(db, collab.id)
    requester = await db.get(User, req.requested_by)
    return _to_out(req, collab, creator, product, requester)


@router.post("/{request_id}/reject", response_model=ApprovalRequestOut)
async def reject_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ApprovalRequestOut:
    req = await _get_request_or_404(request_id, db)
    await _require_can_resolve(req, db, user)
    req.status = ApprovalStatus.rejected
    req.resolved_at = datetime.now(timezone.utc)
    req.resolved_by = user.id
    await db.commit()
    await db.refresh(req)

    collab = await db.get(Collaboration, req.collaboration_id)
    creator = await db.get(Creator, collab.creator_id)
    product = await _get_primary_product(db, collab.id)
    requester = await db.get(User, req.requested_by)
    return _to_out(req, collab, creator, product, requester)

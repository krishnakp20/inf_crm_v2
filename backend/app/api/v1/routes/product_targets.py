from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.models.enums import UserRole
from app.db.models.product import Product
from app.db.models.product_target import ProductTarget
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.product_target import ProductTargetMonthOut, ProductTargetOut, ProductTargetSet
from app.services.collab_pipeline import get_video_credit_by_product_and_owner
from app.services.product_targets import (
    EffectiveTarget,
    current_month,
    derive_weekly_target,
    effective_targets,
    get_video_credit_by_product_since,
    month_bounds,
    month_key,
    parse_month,
)

router = APIRouter(prefix="/product-targets", tags=["product-targets"])


async def _resolve_target_user_id(db: AsyncSession, user: User, requested_user_id: int | None) -> int:
    """Everyone manages their own targets by default. Only an admin may pass
    a different user_id, to set/view targets on someone else's behalf (e.g.
    an advisor who hasn't set their own yet) -- silently ignored for every
    other role, which always ends up managing their own regardless of what
    they pass."""
    if requested_user_id is None or user.role != UserRole.admin:
        return user.id
    target_user = await db.get(User, requested_user_id)
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return requested_user_id


async def _progress(db: AsyncSession, user_id: int, month: date) -> tuple[dict[int, float], dict[int, float]]:
    """(this week's credit, the month's credit) per product for one user. The month is
    counted by each video's real live date, the same rule as Analytics / My Creators."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    weekly_credit = await get_video_credit_by_product_since(db, user_id, week_start)
    first, last = month_bounds(month)
    by_product = await get_video_credit_by_product_and_owner(db, [user_id], first, last)
    monthly_credit = {pid: by_owner.get(user_id, 0.0) for pid, by_owner in by_product.items()}
    return weekly_credit, monthly_credit


def _to_out(
    target: EffectiveTarget,
    product_id: int,
    product_name: str,
    month: date,
    weekly_credit: dict[int, float],
    monthly_credit: dict[int, float],
) -> ProductTargetOut:
    now = datetime.now(timezone.utc)
    return ProductTargetOut(
        id=target.row_id,
        product_id=product_id,
        product_name=product_name,
        monthly_target=target.value,
        month=month_key(month),
        source=target.source,
        source_month=month_key(target.source_month) if target.source == "carried" and target.source_month else None,
        weekly_target=derive_weekly_target(target.value, now),
        weekly_progress=round(weekly_credit.get(product_id, 0.0), 2),
        monthly_progress=round(monthly_credit.get(product_id, 0.0), 2),
    )


@router.get("", response_model=list[ProductTargetOut])
async def list_my_targets(
    user_id: int | None = None,
    month: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ProductTargetOut]:
    """The targets in force for one month (default: this month): the month's own figure,
    else the latest earlier month's carried forward, else the standing target."""
    target_user_id = await _resolve_target_user_id(db, user, user_id)
    month_start = parse_month(month)
    effective = await effective_targets(db, [target_user_id], month_start)
    if not effective:
        return []
    names = dict(
        (await db.execute(select(Product.id, Product.name).where(Product.id.in_([pid for _, pid in effective])))).all()
    )
    weekly_credit, monthly_credit = await _progress(db, target_user_id, month_start)
    rows = [
        _to_out(t, pid, names.get(pid, ""), month_start, weekly_credit, monthly_credit)
        for (_, pid), t in effective.items()
    ]
    return sorted(rows, key=lambda r: r.product_name.lower())


@router.get("/months", response_model=list[ProductTargetMonthOut])
async def list_target_months(
    user_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ProductTargetMonthOut]:
    """Months that have targets of their own for this user (newest first), for the month-wise list."""
    target_user_id = await _resolve_target_user_id(db, user, user_id)
    rows = (
        await db.execute(
            select(
                ProductTarget.month,
                func.coalesce(func.sum(ProductTarget.monthly_target), 0),
                func.count(ProductTarget.id),
            )
            .where(ProductTarget.user_id == target_user_id, ProductTarget.month.is_not(None))
            .group_by(ProductTarget.month)
            .order_by(ProductTarget.month.desc())
        )
    ).all()
    return [ProductTargetMonthOut(month=month_key(m), total_target=int(total), product_count=count) for m, total, count in rows]


@router.post("", response_model=ProductTargetOut, status_code=status.HTTP_201_CREATED)
async def set_my_target(
    payload: ProductTargetSet,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProductTargetOut:
    target_user_id = await _resolve_target_user_id(db, user, payload.user_id)
    product = await db.get(Product, payload.product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    if payload.monthly_target < 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A target cannot be negative.")

    # A month, when given, is its own row; no month = the standing target.
    row_month = parse_month(payload.month) if payload.month else None
    month_filter = ProductTarget.month == row_month if row_month is not None else ProductTarget.month.is_(None)
    existing = (
        await db.execute(
            select(ProductTarget).where(
                ProductTarget.user_id == target_user_id, ProductTarget.product_id == payload.product_id, month_filter
            )
        )
    ).scalar_one_or_none()

    if existing is None:
        existing = ProductTarget(user_id=target_user_id, product_id=payload.product_id, month=row_month)
        db.add(existing)

    existing.monthly_target = payload.monthly_target
    await db.commit()
    await db.refresh(existing)

    shown_month = row_month or current_month()
    effective = (await effective_targets(db, [target_user_id], shown_month, payload.product_id))[
        (target_user_id, payload.product_id)
    ]
    weekly_credit, monthly_credit = await _progress(db, target_user_id, shown_month)
    return _to_out(effective, payload.product_id, product.name, shown_month, weekly_credit, monthly_credit)

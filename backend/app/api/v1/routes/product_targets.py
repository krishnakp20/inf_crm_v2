from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.models.enums import UserRole
from app.db.models.product import Product
from app.db.models.product_target import ProductTarget
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.product_target import ProductTargetOut, ProductTargetSet
from app.services.product_targets import derive_weekly_target, get_video_credit_by_product_since

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


@router.get("", response_model=list[ProductTargetOut])
async def list_my_targets(
    user_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ProductTargetOut]:
    target_user_id = await _resolve_target_user_id(db, user, user_id)
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    weekly_credit = await get_video_credit_by_product_since(db, target_user_id, week_start)
    monthly_credit = await get_video_credit_by_product_since(db, target_user_id, month_start)

    rows = (
        await db.execute(
            select(ProductTarget, Product.name)
            .join(Product, Product.id == ProductTarget.product_id)
            .where(ProductTarget.user_id == target_user_id)
            .order_by(Product.name)
        )
    ).all()

    return [
        ProductTargetOut(
            id=target.id,
            product_id=target.product_id,
            product_name=product_name,
            monthly_target=target.monthly_target,
            weekly_target=derive_weekly_target(target.monthly_target, now),
            weekly_progress=round(weekly_credit.get(target.product_id, 0.0), 2),
            monthly_progress=round(monthly_credit.get(target.product_id, 0.0), 2),
        )
        for target, product_name in rows
    ]


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

    existing = (
        await db.execute(
            select(ProductTarget).where(
                ProductTarget.user_id == target_user_id, ProductTarget.product_id == payload.product_id
            )
        )
    ).scalar_one_or_none()

    if existing is None:
        existing = ProductTarget(user_id=target_user_id, product_id=payload.product_id)
        db.add(existing)

    existing.monthly_target = payload.monthly_target
    await db.commit()
    await db.refresh(existing)

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    weekly_credit = await get_video_credit_by_product_since(db, target_user_id, week_start)
    monthly_credit = await get_video_credit_by_product_since(db, target_user_id, month_start)

    return ProductTargetOut(
        id=existing.id,
        product_id=existing.product_id,
        product_name=product.name,
        monthly_target=existing.monthly_target,
        weekly_target=derive_weekly_target(existing.monthly_target, now),
        weekly_progress=round(weekly_credit.get(existing.product_id, 0.0), 2),
        monthly_progress=round(monthly_credit.get(existing.product_id, 0.0), 2),
    )

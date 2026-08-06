from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.models.product import Product
from app.db.models.product_target import ProductTarget
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.product_target import ProductTargetOut, ProductTargetSet
from app.services.product_targets import get_video_credit_by_product_since

router = APIRouter(prefix="/product-targets", tags=["product-targets"])


@router.get("", response_model=list[ProductTargetOut])
async def list_my_targets(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ProductTargetOut]:
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    weekly_credit = await get_video_credit_by_product_since(db, user.id, week_start)
    monthly_credit = await get_video_credit_by_product_since(db, user.id, month_start)

    rows = (
        await db.execute(
            select(ProductTarget, Product.name)
            .join(Product, Product.id == ProductTarget.product_id)
            .where(ProductTarget.user_id == user.id)
            .order_by(Product.name)
        )
    ).all()

    return [
        ProductTargetOut(
            id=target.id,
            product_id=target.product_id,
            product_name=product_name,
            weekly_target=target.weekly_target,
            monthly_target=target.monthly_target,
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
    product = await db.get(Product, payload.product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    existing = (
        await db.execute(
            select(ProductTarget).where(
                ProductTarget.user_id == user.id, ProductTarget.product_id == payload.product_id
            )
        )
    ).scalar_one_or_none()

    if existing is None:
        existing = ProductTarget(user_id=user.id, product_id=payload.product_id)
        db.add(existing)

    existing.weekly_target = payload.weekly_target
    existing.monthly_target = payload.monthly_target
    await db.commit()
    await db.refresh(existing)

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    weekly_credit = await get_video_credit_by_product_since(db, user.id, week_start)
    monthly_credit = await get_video_credit_by_product_since(db, user.id, month_start)

    return ProductTargetOut(
        id=existing.id,
        product_id=existing.product_id,
        product_name=product.name,
        weekly_target=existing.weekly_target,
        monthly_target=existing.monthly_target,
        weekly_progress=round(weekly_credit.get(existing.product_id, 0.0), 2),
        monthly_progress=round(monthly_credit.get(existing.product_id, 0.0), 2),
    )

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_admin
from app.db.models.product import Product
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.product import ProductCreate, ProductOut, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
async def list_products(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Product]:
    result = await db.execute(select(Product).order_by(Product.name))
    return list(result.scalars().all())


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> Product:
    existing = await db.execute(select(Product).where(Product.name == payload.name))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product already exists")

    product = Product(name=payload.name, owner_id=payload.owner_id, target_videos=payload.target_videos)
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@router.patch("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> Product:
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    await db.commit()
    await db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> None:
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    await db.delete(product)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This product is used by existing collaborations or campaigns and can't be removed.",
        )

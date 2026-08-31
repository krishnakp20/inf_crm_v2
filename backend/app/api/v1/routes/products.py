from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_admin
from app.db.models.product import Product
from app.db.models.product_variant import ProductVariant
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.product import (
    ProductCreate,
    ProductOut,
    ProductUpdate,
    ProductVariantCreate,
    ProductVariantOut,
)

router = APIRouter(prefix="/products", tags=["products"])


async def _variants_by_product(db: AsyncSession, product_ids: list[int]) -> dict[int, list[ProductVariantOut]]:
    if not product_ids:
        return {}
    result = await db.execute(
        select(ProductVariant).where(ProductVariant.product_id.in_(product_ids)).order_by(ProductVariant.name)
    )
    by_product: dict[int, list[ProductVariantOut]] = {}
    for variant in result.scalars().all():
        by_product.setdefault(variant.product_id, []).append(ProductVariantOut.model_validate(variant))
    return by_product


@router.get("", response_model=list[ProductOut])
async def list_products(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ProductOut]:
    products = (await db.execute(select(Product).order_by(Product.name))).scalars().all()
    variants_by_product = await _variants_by_product(db, [p.id for p in products])
    return [
        ProductOut(
            id=p.id,
            name=p.name,
            owner_id=p.owner_id,
            target_videos=p.target_videos,
            created_at=p.created_at,
            variants=variants_by_product.get(p.id, []),
        )
        for p in products
    ]


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> ProductOut:
    existing = await db.execute(select(Product).where(Product.name == payload.name))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product already exists")

    product = Product(name=payload.name, owner_id=payload.owner_id, target_videos=payload.target_videos)
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return ProductOut(
        id=product.id,
        name=product.name,
        owner_id=product.owner_id,
        target_videos=product.target_videos,
        created_at=product.created_at,
        variants=[],
    )


@router.patch("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> ProductOut:
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    await db.commit()
    await db.refresh(product)
    variants = (await _variants_by_product(db, [product.id])).get(product.id, [])
    return ProductOut(
        id=product.id,
        name=product.name,
        owner_id=product.owner_id,
        target_videos=product.target_videos,
        created_at=product.created_at,
        variants=variants,
    )


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


@router.post("/{product_id}/variants", response_model=ProductVariantOut, status_code=status.HTTP_201_CREATED)
async def create_product_variant(
    product_id: int,
    payload: ProductVariantCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> ProductVariant:
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Shade name is required.")

    existing = await db.execute(
        select(ProductVariant).where(ProductVariant.product_id == product_id, ProductVariant.name == name)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This shade already exists for this product.")

    variant = ProductVariant(product_id=product_id, name=name)
    db.add(variant)
    await db.commit()
    await db.refresh(variant)
    return variant


@router.delete("/{product_id}/variants/{variant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product_variant(
    product_id: int,
    variant_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> None:
    variant = await db.get(ProductVariant, variant_id)
    if variant is None or variant.product_id != product_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shade not found")
    # Any existing CollaborationProduct pointing at this shade has its
    # variant_id cleared automatically (ON DELETE SET NULL) -- deleting a
    # shade from the admin list never blocks or corrupts recorded
    # collaborations, it just stops offering that shade going forward.
    await db.delete(variant)
    await db.commit()

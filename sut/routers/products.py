from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from sut.database import get_db
from sut.models import Product, User, UserRole
from sut.schemas import ProductCreate, ProductStockUpdate, ProductResponse
from sut.auth import get_current_user, require_role

router = APIRouter(prefix="/api/products", tags=["Products"])


@router.get("", response_model=List[ProductResponse])
def list_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all available products (requires authentication)."""
    products = db.query(Product).order_by(Product.id.asc()).all()
    return products


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
):
    """Create a new product (admin only). Rejects duplicate SKU with 409 Conflict."""
    existing_product = db.query(Product).filter(Product.sku == payload.sku).first()
    if existing_product:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Product with SKU '{payload.sku}' already exists",
        )

    product = Product(
        sku=payload.sku,
        name=payload.name,
        price=payload.price,
        stock_quantity=payload.stock_quantity,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.patch("/{product_id}/stock", response_model=ProductResponse)
def update_product_stock(
    product_id: int,
    payload: ProductStockUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
):
    """Update stock quantity for a product (admin only)."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found",
        )

    product.stock_quantity = payload.stock_quantity
    db.commit()
    db.refresh(product)
    return product

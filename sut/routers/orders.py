from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from sut.database import get_db
from sut.models import Order, Product, User, UserRole, OrderStatus
from sut.schemas import OrderCreate, OrderStatusUpdate, OrderResponse
from sut.auth import get_current_user, require_role

router = APIRouter(prefix="/api/orders", tags=["Orders"])


def _to_order_response(order: Order) -> OrderResponse:
    """Format SQLAlchemy Order model into OrderResponse schema with product details."""
    return OrderResponse(
        id=order.id,
        user_id=order.user_id,
        product_id=order.product_id,
        product_sku=order.product.sku if order.product else None,
        product_name=order.product.name if order.product else None,
        quantity=order.quantity,
        total_price=order.total_price,
        status=OrderStatus(order.status),
        created_at=order.created_at,
    )


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new order.
    Atomically validates and decrements available product stock.
    Returns 404 if product not found.
    Returns 400 with detail 'Insufficient stock' if requested quantity > available stock.
    """
    # Look up product
    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    # Business rule: check available stock
    if payload.quantity > product.stock_quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient stock",
        )

    # Calculate total price
    total_price = round(product.price * payload.quantity, 2)

    # Atomically decrement stock and persist order
    product.stock_quantity -= payload.quantity

    order = Order(
        user_id=current_user.id,
        product_id=product.id,
        quantity=payload.quantity,
        total_price=total_price,
        status=OrderStatus.PENDING.value,
    )

    db.add(order)
    db.commit()
    db.refresh(order)

    return _to_order_response(order)


@router.get("", response_model=List[OrderResponse])
def list_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List orders.
    Regular users see only their own orders.
    Admins see all orders across all users.
    """
    query = db.query(Order).options(joinedload(Order.product))
    if current_user.role != UserRole.ADMIN.value:
        query = query.filter(Order.user_id == current_user.id)

    orders = query.order_by(Order.created_at.desc(), Order.id.desc()).all()
    return [_to_order_response(o) for o in orders]


@router.patch("/{order_id}/status", response_model=OrderResponse)
def update_order_status(
    order_id: int,
    payload: OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_role(UserRole.ADMIN)),
):
    """
    Update order status (admin only).
    If cancelling an order from PENDING status, restores product stock quantity.
    """
    order = (
        db.query(Order)
        .options(joinedload(Order.product))
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID {order_id} not found",
        )

    target_status = payload.status.value

    # Business rule: if cancelling from PENDING, restore stock
    if target_status == OrderStatus.CANCELLED.value and order.status == OrderStatus.PENDING.value:
        if order.product:
            order.product.stock_quantity += order.quantity

    order.status = target_status
    db.commit()
    db.refresh(order)

    return _to_order_response(order)

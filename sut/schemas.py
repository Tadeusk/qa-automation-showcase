from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, EmailStr
from sut.models import UserRole, OrderStatus


# --- Auth Schemas ---
class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    role: UserRole
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# --- Product Schemas ---
class ProductCreate(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64, description="Unique product SKU")
    name: str = Field(..., min_length=1, max_length=255, description="Product display name")
    price: float = Field(..., gt=0, description="Product unit price (must be greater than 0)")
    stock_quantity: int = Field(..., ge=0, description="Available stock (cannot be negative)")


class ProductStockUpdate(BaseModel):
    stock_quantity: int = Field(..., ge=0, description="Updated stock quantity (cannot be negative)")


class ProductResponse(BaseModel):
    id: int
    sku: str
    name: str
    price: float
    stock_quantity: int
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Order Schemas ---
class OrderCreate(BaseModel):
    product_id: int = Field(..., gt=0, description="ID of the product to order")
    quantity: int = Field(..., gt=0, description="Quantity to purchase (must be greater than 0)")


class OrderStatusUpdate(BaseModel):
    status: OrderStatus = Field(..., description="Target status: APPROVED or CANCELLED")


class OrderResponse(BaseModel):
    id: int
    user_id: int
    product_id: int
    product_sku: Optional[str] = None
    product_name: Optional[str] = None
    quantity: int
    total_price: float
    status: OrderStatus
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Test / Reset Schemas ---
class ResetResponse(BaseModel):
    status: str
    message: str
    seeded: Dict[str, Any]

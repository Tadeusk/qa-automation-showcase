import logging
from sqlalchemy.orm import Session
from sut.database import Base, engine
from sut.models import User, Product, Order, UserRole
from sut.auth import hash_password

logger = logging.getLogger("sut.seed")

DEFAULT_USERS = [
    {
        "email": "admin@example.com",
        "password": "Admin123!",
        "role": UserRole.ADMIN.value,
    },
    {
        "email": "user@example.com",
        "password": "User123!",
        "role": UserRole.USER.value,
    },
]

SAMPLE_PRODUCTS = [
    {
        "sku": "PROD-001",
        "name": "Wireless Mechanical Keyboard",
        "price": 99.99,
        "stock_quantity": 15,
    },
    {
        "sku": "PROD-002",
        "name": "Ergonomic Mouse",
        "price": 49.50,
        "stock_quantity": 25,
    },
    {
        "sku": "PROD-003",
        "name": "USB-C Monitor Hub",
        "price": 129.00,
        "stock_quantity": 5,
    },
]


def init_db() -> None:
    """Create all tables defined in Base metadata."""
    Base.metadata.create_all(bind=engine)


def seed_default_users(db: Session) -> int:
    """Seed default admin and user accounts if missing."""
    count = 0
    for u in DEFAULT_USERS:
        existing = db.query(User).filter(User.email == u["email"]).first()
        if not existing:
            user = User(
                email=u["email"],
                hashed_password=hash_password(u["password"]),
                role=u["role"],
            )
            db.add(user)
            count += 1
    if count > 0:
        db.commit()
        logger.info(f"Seeded {count} default user(s).")
    return count


def seed_sample_products(db: Session) -> int:
    """Seed sample products for testing/development."""
    count = 0
    for p in SAMPLE_PRODUCTS:
        existing = db.query(Product).filter(Product.sku == p["sku"]).first()
        if not existing:
            product = Product(
                sku=p["sku"],
                name=p["name"],
                price=p["price"],
                stock_quantity=p["stock_quantity"],
            )
            db.add(product)
            count += 1
    if count > 0:
        db.commit()
        logger.info(f"Seeded {count} sample product(s).")
    return count


def reset_database(db: Session) -> dict:
    """Clear all orders, products, and users, then re-seed defaults."""
    db.query(Order).delete()
    db.query(Product).delete()
    db.query(User).delete()
    db.commit()

    users_seeded = seed_default_users(db)
    products_seeded = seed_sample_products(db)

    return {
        "users": users_seeded,
        "products": products_seeded,
    }

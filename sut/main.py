import os
import sys

# Ensure parent directory is in sys.path so the app can be started either from
# the repository root (`uvicorn sut.main:app --reload`) or inside sut/ (`uvicorn main:app --reload`).
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from sut.database import SessionLocal
from sut.seed import init_db, seed_default_users, seed_sample_products
from sut.routers.auth import router as auth_router
from sut.routers.products import router as products_router
from sut.routers.orders import router as orders_router
from sut.routers.test import router as test_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler.
    Initializes database tables and seeds default user accounts and sample
    products on startup so the system is immediately ready for manual and automated testing.
    """
    init_db()
    db = SessionLocal()
    try:
        seed_default_users(db)
        seed_sample_products(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="Inventory & Order Management SUT",
    description="Clean, deterministic System Under Test for automated API & E2E UI testing.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware to support automated API and browser-based test frameworks
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files and root route
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
async def serve_index():
    """Serve the single-page application UI."""
    index_path = os.path.join(STATIC_DIR, "index.html")
    return FileResponse(index_path)


# Health Check
@app.get("/api/health", tags=["Health"])
async def health_check():
    """Health check endpoint for smoke checks and CI readiness probes."""
    return {"status": "ok", "service": "sut-inventory-order"}


# Include API Routers
app.include_router(auth_router)
app.include_router(products_router)
app.include_router(orders_router)
app.include_router(test_router)

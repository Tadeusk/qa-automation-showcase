from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from sut.config import settings
from sut.database import get_db
from sut.schemas import ResetResponse
from sut.seed import reset_database

router = APIRouter(prefix="/api/test", tags=["Testing Support"])


@router.post("/reset", response_model=ResetResponse)
def reset_test_data(db: Session = Depends(get_db)):
    """
    Testability endpoint:
    Clears all orders, products, and users, then re-seeds default admin & user
    accounts along with standard sample products for deterministic test execution.
    Only enabled when ENABLE_TEST_ENDPOINTS is true or ENV=test.
    """
    if not settings.ENABLE_TEST_ENDPOINTS and settings.ENV != "test":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Test reset endpoint is disabled in this environment.",
        )

    seeded_info = reset_database(db)
    return ResetResponse(
        status="success",
        message="Database reset and seeded successfully",
        seeded=seeded_info,
    )

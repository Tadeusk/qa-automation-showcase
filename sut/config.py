import os
from pydantic import BaseModel


class Settings(BaseModel):
    ENV: str = os.getenv("ENV", "development")
    ENABLE_TEST_ENDPOINTS: bool = os.getenv(
        "ENABLE_TEST_ENDPOINTS", "true"
    ).lower() in ("true", "1", "yes")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./sut.db")
    JWT_SECRET_KEY: str = os.getenv(
        "JWT_SECRET_KEY", "sut-test-secret-key-32-characters-long!!"
    )
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "1440")
    )


settings = Settings()

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Config(BaseSettings):
    base_url: str = "http://localhost:8000" 
    user_email: str = "user@example.com"
    user_password: str = "User123!"
    admin_email: str = "admin@example.com"
    admin_password: str = "Admin123!"
    headless: bool = True
    default_timeout_ms: int = 5000

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

@lru_cache
def get_settings() -> Config:
    return Config()
"""Application configuration from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://monitor:monitor@localhost:5432/monitor"
    jwt_secret: str = "change-this-secret-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    # Demo login (override via env in production)
    admin_username: str = "admin"
    admin_password: str = "admin123"


settings = Settings()

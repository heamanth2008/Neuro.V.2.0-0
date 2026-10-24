"""Application configuration using Pydantic Settings."""
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Get the directory where this config.py file lives (backend/)
BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Environment
    ENV: str = Field(default="dev", description="Environment: dev, prod, or test")

    # Database
    DATABASE_URL: str = Field(
        default="sqlite:///./dev.db",
        description="Database connection URL (sqlite for local, postgresql for prod)"
    )

    # JWT Authentication
    JWT_SECRET: str = Field(
        default="test-secret-key-for-testing-only-32-chars-minimum",
        description="Secret key for JWT token signing (required, no default in prod)"
    )
    JWT_ALGORITHM: str = Field(default="HS256", description="JWT signing algorithm")
    JWT_EXPIRE_MINUTES: int = Field(default=60 * 24 * 30, description="JWT token expiry in minutes (30 days)")

    # CORS
    ALLOWED_ORIGINS: str | list[str] = Field(
        default="http://localhost:3000,http://localhost:8000",
        description="Comma-separated list of allowed origins for CORS (required for credentials)"
    )

    # YouTube API
    YT_API_KEY: str | None = Field(default=None, description="YouTube Data API v3 key")

    # SMTP (optional, for password reset emails)
    SMTP_HOST: str | None = Field(default=None)
    SMTP_PORT: int = Field(default=587)
    SMTP_USER: str | None = Field(default=None)
    SMTP_PASSWORD: str | None = Field(default=None)
    SMTP_FROM_EMAIL: str | None = Field(default=None)
    SMTP_FROM_NAME: str = Field(default="Neuro Music")

    # Storage (optional, for avatar uploads)
    STORAGE_PROVIDER: str | None = Field(default=None, description="r2, s3, or local")
    STORAGE_ENDPOINT: str | None = Field(default=None, description="R2/S3 endpoint URL")
    STORAGE_BUCKET: str | None = Field(default=None, description="Bucket name")
    STORAGE_ACCESS_KEY: str | None = Field(default=None)
    STORAGE_SECRET_KEY: str | None = Field(default=None)
    STORAGE_PUBLIC_URL: str | None = Field(default=None, description="Public URL for served files")

    # App
    APP_VERSION: str = Field(default="2.0.0", description="Application version")

    # Rate limiting
    RATE_LIMIT_REQUESTS: int = Field(default=100, description="Requests per minute per IP")
    RATE_LIMIT_WINDOW: int = Field(default=60, description="Rate limit window in seconds")

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v: str | list[str]) -> list[str]:
        """Parse comma-separated origins into a list."""
        if isinstance(v, list):
            return v
        if v == "*":
            return ["*"]
        return [origin.strip() for origin in v.split(",") if origin.strip()]

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_postgres_url(cls, v: str) -> str:
        """Convert postgres:// to postgresql:// for SQLAlchemy compatibility (Render)."""
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql://", 1)
        return v

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.ENV.lower() == "prod"

    @property
    def allowed_origins_list(self) -> list[str]:
        """Get allowed origins as a list."""
        return self.parse_allowed_origins(self.ALLOWED_ORIGINS)


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
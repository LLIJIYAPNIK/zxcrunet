from enum import StrEnum

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(StrEnum):
    DEV = "dev"
    TEST = "test"
    PROD = "prod"


class Settings(BaseSettings):
    """Application settings, read from ZXC_* environment variables or .env."""

    model_config = SettingsConfigDict(env_prefix="ZXC_", env_file=".env", extra="ignore")

    env: Environment = Environment.DEV
    service_domain: str = "zxc.ru.net"
    # Parent domain of free site addresses; `localhost` in development (anna.localhost).
    sites_domain: str = "zxc.ru.net"
    database_url: str = "postgresql+asyncpg://zxc:zxc@localhost:5432/zxc"
    redis_url: str = "redis://localhost:6379/0"
    probe_timeout_seconds: float = 2.0

    # Public address of the web app; used for links in emails.
    public_url: str = "http://localhost:3000"
    # Origins allowed to send mutating requests (POST/PUT/PATCH/DELETE) to /api.
    allowed_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    session_cookie_name: str = "zxc_session"
    session_ttl_days: int = 30
    verify_email_ttl_hours: int = 48
    reset_password_ttl_minutes: int = 60
    register_per_ip_per_hour: int = 5

    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_start_tls: bool = False
    mail_from: str = "zxcrunet <no-reply@zxc.ru.net>"

    @property
    def cookie_secure(self) -> bool:
        return self.env == Environment.PROD

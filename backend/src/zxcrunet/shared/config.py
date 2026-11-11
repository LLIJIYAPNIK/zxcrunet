from enum import StrEnum

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
    database_url: str = "postgresql+asyncpg://zxc:zxc@localhost:5432/zxc"
    redis_url: str = "redis://localhost:6379/0"
    probe_timeout_seconds: float = 2.0

"""Imports every SQLAlchemy model so Base.metadata knows all tables (Alembic, tests)."""

from zxcrunet.identity.infrastructure import models as identity_models
from zxcrunet.plans.infrastructure import models as plans_models

__all__ = ["identity_models", "plans_models"]

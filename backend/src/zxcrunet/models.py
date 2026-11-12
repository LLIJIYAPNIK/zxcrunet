"""Imports every SQLAlchemy model so Base.metadata knows all tables (Alembic, tests)."""

from zxcrunet.catalog.infrastructure import models as catalog_models
from zxcrunet.identity.infrastructure import models as identity_models
from zxcrunet.media.infrastructure import adapters as media_models
from zxcrunet.plans.infrastructure import models as plans_models
from zxcrunet.sites.infrastructure import models as sites_models

__all__ = ["catalog_models", "identity_models", "media_models", "plans_models", "sites_models"]

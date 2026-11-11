from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from zxcrunet.shared.infrastructure.db import Base


class PlanModel(Base):
    __tablename__ = "plans"

    code: Mapped[str] = mapped_column(String(32), primary_key=True)
    title: Mapped[str] = mapped_column(String(64))
    max_sites: Mapped[int] = mapped_column(Integer)
    max_custom_domains: Mapped[int] = mapped_column(Integer)
    max_upload_mb: Mapped[int] = mapped_column(Integer)

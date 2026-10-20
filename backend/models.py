
from sqlalchemy import Boolean, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class StrategicSite(Base):
    __tablename__ = "strategic_sites"

    id: Mapped[str] = mapped_column(
        String(100),
        primary_key=True,
    )

    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        unique=True,
    )

    category: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        Text,
        default="",
    )

    lat: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    lng: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

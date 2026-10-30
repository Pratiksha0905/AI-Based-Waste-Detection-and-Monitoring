"""
EcoWatch AI — Report and Detection ORM models.

ProcessingStatus lifecycle:
  pending → processing → completed | failed

ReviewStatus lifecycle (admin-controlled):
  pending_review → reviewed | resolved | rejected
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, deferred, mapped_column, relationship

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # ── Image storage ──────────────────────────────────────────────────────────
    # Opaque identifier retained for API compatibility; image bytes live in the DB.
    image_key: Mapped[str] = mapped_column(String(512), nullable=False)
    image_data: Mapped[Optional[bytes]] = deferred(
        mapped_column(LargeBinary, nullable=True)
    )
    image_media_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    # ── Location ───────────────────────────────────────────────────────────────
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)

    # ── Metadata ───────────────────────────────────────────────────────────────
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, onupdate=_now
    )

    # ── Processing ─────────────────────────────────────────────────────────────
    processing_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending", index=True
    )
    # Number of times inference has been attempted
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    processing_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ── Admin review ───────────────────────────────────────────────────────────
    review_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending_review", index=True
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship("User", back_populates="reports")  # noqa: F821
    detections: Mapped[list["Detection"]] = relationship(
        "Detection", back_populates="report", cascade="all, delete-orphan", lazy="select"
    )

    # Composite index for hotspot spatial queries
    __table_args__ = (
        Index("ix_reports_lat_lng", "latitude", "longitude"),
        Index("ix_reports_user_submitted", "user_id", "submitted_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<Report id={self.id!r} user={self.user_id!r} "
            f"status={self.processing_status!r}>"
        )


class Detection(Base):
    __tablename__ = "detections"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    report_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # ── YOLO output ────────────────────────────────────────────────────────────
    predicted_class: Mapped[str] = mapped_column(String(64), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)

    # Normalised bounding box [x1, y1, x2, y2] stored as four separate columns
    # (avoids JSON parsing on every query and enables future indexed range scans)
    bbox_x1: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bbox_y1: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bbox_x2: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bbox_y2: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Relative depth from MiDaS (optional, populated when depth model is attached)
    relative_depth: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Model metadata
    model_version: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    analyzed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )

    report: Mapped["Report"] = relationship("Report", back_populates="detections")

    def __repr__(self) -> str:
        return (
            f"<Detection id={self.id!r} class={self.predicted_class!r} "
            f"conf={self.confidence:.2f}>"
        )

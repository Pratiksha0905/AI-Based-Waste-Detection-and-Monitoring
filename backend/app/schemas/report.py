"""
EcoWatch AI — Pydantic schemas for waste reports.

Processing status values: pending | processing | completed | failed
Review status values:     pending_review | reviewed | resolved | rejected
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


# ── Detection sub-schema ──────────────────────────────────────────────────────

class BoundingBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class DetectionOut(BaseModel):
    id: str
    predicted_class: str
    confidence: float
    bbox: Optional[BoundingBox] = None
    relative_depth: Optional[float] = None
    model_version: Optional[str] = None
    analyzed_at: datetime

    model_config = {"from_attributes": True}


# ── Report submission ──────────────────────────────────────────────────────────

class ReportCreate(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="WGS-84 latitude")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="WGS-84 longitude")
    description: Optional[str] = Field(None, max_length=1000, strip_whitespace=True)


# ── Report response ───────────────────────────────────────────────────────────

ProcessingStatus = Literal["pending", "processing", "completed", "failed"]
ReviewStatus = Literal["pending_review", "reviewed", "resolved", "rejected"]


class ReportOut(BaseModel):
    id: str
    user_id: str
    image_key: str
    latitude: float
    longitude: float
    description: Optional[str]
    submitted_at: datetime
    updated_at: datetime
    processing_status: ProcessingStatus
    review_status: ReviewStatus
    retry_count: int
    processing_error: Optional[str] = None
    detections: List[DetectionOut] = []

    model_config = {"from_attributes": True}


class ReportSummary(BaseModel):
    """Lightweight version returned in list endpoints."""
    id: str
    user_id: str
    latitude: float
    longitude: float
    description: Optional[str]
    submitted_at: datetime
    processing_status: ProcessingStatus
    review_status: ReviewStatus
    detection_count: int = 0

    model_config = {"from_attributes": True}


# ── Status update (admin only) ────────────────────────────────────────────────

class ReviewStatusUpdate(BaseModel):
    review_status: ReviewStatus


# ── Pagination ────────────────────────────────────────────────────────────────

class PaginatedReports(BaseModel):
    items: List[ReportSummary]
    total: int
    page: int
    page_size: int
    total_pages: int

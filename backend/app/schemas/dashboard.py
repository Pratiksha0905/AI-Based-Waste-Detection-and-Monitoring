"""
EcoWatch AI — Pydantic schemas for admin dashboard statistics.

All values are computed from real database records.
AI-dependent metrics are explicitly marked as unavailable when the model is absent.
"""

from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel


class StatusCount(BaseModel):
    status: str
    count: int


class CategoryCount(BaseModel):
    category: str
    count: int


class DateCount(BaseModel):
    date: str   # YYYY-MM-DD
    count: int


class SeverityCount(BaseModel):
    severity: str
    count: int


class DashboardStats(BaseModel):
    # ── Report counts ─────────────────────────────────────────────────────────
    total_reports: int
    reports_today: int
    reports_last_7_days: int
    reports_last_30_days: int

    # ── Status breakdown ──────────────────────────────────────────────────────
    by_processing_status: List[StatusCount]
    by_review_status: List[StatusCount]

    # ── Users ─────────────────────────────────────────────────────────────────
    distinct_reporters: int

    # ── Hotspots ──────────────────────────────────────────────────────────────
    hotspot_count: int
    by_hotspot_severity: List[SeverityCount]

    # ── AI metrics — None when model has not processed any reports ─────────────
    model_available: bool
    total_detections: Optional[int]
    top_waste_categories: Optional[List[CategoryCount]]
    processing_success_rate: Optional[float]   # 0.0–1.0


class TrendPoint(BaseModel):
    date: str  # YYYY-MM-DD
    count: int


class TrendsResponse(BaseModel):
    observations_by_date: List[TrendPoint]
    days: int

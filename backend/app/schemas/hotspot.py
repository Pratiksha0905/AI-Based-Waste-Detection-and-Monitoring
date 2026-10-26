"""
EcoWatch AI — Pydantic schemas for hotspot map endpoint.

Severity levels match the frontend's existing Severity type:
  low | medium | high | critical
"""

from __future__ import annotations

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel


Severity = Literal["low", "medium", "high", "critical"]

# Maps severity → marker colour expected by the existing Leaflet frontend
SEVERITY_COLOR: Dict[str, str] = {
    "low": "#10b981",
    "medium": "#f59e0b",
    "high": "#f97316",
    "critical": "#ef4444",
}


class HotspotOut(BaseModel):
    id: str
    latitude: float
    longitude: float
    report_count: int
    severity: Severity
    color: str                        # hex colour for Leaflet marker
    dominant_category: Optional[str]  # most-detected waste class, if AI available
    last_report_at: Optional[str]     # ISO 8601

    model_config = {"from_attributes": False}


class HotspotListResponse(BaseModel):
    items: List[HotspotOut]
    total: int
    cluster_radius_m: float

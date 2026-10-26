"""
EcoWatch AI — Hotspot service.

Algorithm (documented):
  1. Load all non-rejected, non-failed reports from the DB.
  2. Cluster them using a greedy radius-based approach with Haversine distance.
     - Iterate over reports sorted by submission time (oldest first).
     - For each un-clustered report, start a new cluster centred at that report.
     - Add every subsequent un-clustered report within HOTSPOT_CLUSTER_RADIUS_M
       metres (Haversine) to the same cluster.
  3. Calculate the cluster centroid as the mean of member latitudes/longitudes.
  4. Assign severity based on report_count thresholds from settings.
  5. Determine dominant_category from the most-frequent detection class in the
     cluster (null when no AI analysis has been completed).

Note: This greedy algorithm is O(n²) and appropriate for datasets up to ~10k
reports. Replace with a spatial index (R-tree) if the dataset grows significantly.
"""

from __future__ import annotations

import logging
import math
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.models.report import Detection, Report
from app.schemas.hotspot import SEVERITY_COLOR, HotspotOut, HotspotListResponse

logger = logging.getLogger(__name__)
settings = get_settings()


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Return the Haversine distance in metres between two WGS-84 coordinates.
    Does not treat degrees as metres.
    """
    R = 6_371_000.0  # Earth's mean radius in metres
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2 - lat1)
    dλ = math.radians(lon2 - lon1)
    a = math.sin(dφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(dλ / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _severity(count: int) -> str:
    s = settings
    if count >= s.hotspot_critical_min:
        return "critical"
    if count >= s.hotspot_high_min:
        return "high"
    if count >= s.hotspot_medium_min:
        return "medium"
    return "low"


def _dominant_category(reports: List[Report]) -> Optional[str]:
    """Return the most-detected class across all completed reports in the cluster."""
    freq: Dict[str, int] = {}
    for r in reports:
        if r.processing_status == "completed":
            for d in r.detections:
                freq[d.predicted_class] = freq.get(d.predicted_class, 0) + 1
    if not freq:
        return None
    return max(freq, key=freq.__getitem__)


def _cluster_reports(reports: List[Report], radius_m: float) -> List[List[Report]]:
    """Greedy O(n²) spatial clustering by Haversine distance."""
    assigned = [False] * len(reports)
    clusters: List[List[Report]] = []

    for i, rep in enumerate(reports):
        if assigned[i]:
            continue
        cluster = [rep]
        assigned[i] = True
        for j in range(i + 1, len(reports)):
            if assigned[j]:
                continue
            dist = _haversine_m(
                rep.latitude, rep.longitude,
                reports[j].latitude, reports[j].longitude,
            )
            if dist <= radius_m:
                cluster.append(reports[j])
                assigned[j] = True
        clusters.append(cluster)

    return clusters


async def get_hotspots(db: AsyncSession) -> HotspotListResponse:
    """
    Compute hotspots from persisted reports.

    Only includes reports that are not 'rejected'.
    Returns an empty list when no reports exist.
    """
    result = await db.execute(
        select(Report)
        .options(selectinload(Report.detections))
        .where(Report.review_status != "rejected")
        .order_by(Report.submitted_at.asc())
    )
    all_reports: List[Report] = result.scalars().all()

    if not all_reports:
        return HotspotListResponse(
            items=[], total=0, cluster_radius_m=settings.hotspot_cluster_radius_m
        )

    clusters = _cluster_reports(all_reports, settings.hotspot_cluster_radius_m)

    hotspots: List[HotspotOut] = []
    for cluster in clusters:
        centroid_lat = sum(r.latitude for r in cluster) / len(cluster)
        centroid_lng = sum(r.longitude for r in cluster) / len(cluster)
        count = len(cluster)
        sev = _severity(count)
        last_dt = max(r.submitted_at for r in cluster)
        last_iso = last_dt.isoformat() if last_dt else None

        hotspots.append(
            HotspotOut(
                id=str(uuid.uuid4()),
                latitude=centroid_lat,
                longitude=centroid_lng,
                report_count=count,
                severity=sev,  # type: ignore[arg-type]
                color=SEVERITY_COLOR[sev],
                dominant_category=_dominant_category(cluster),
                last_report_at=last_iso,
            )
        )

    return HotspotListResponse(
        items=hotspots,
        total=len(hotspots),
        cluster_radius_m=settings.hotspot_cluster_radius_m,
    )

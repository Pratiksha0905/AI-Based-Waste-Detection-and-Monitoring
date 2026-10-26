"""
EcoWatch AI — Dashboard analytics service.

All metrics are derived from real database records using aggregation queries.
AI-dependent fields (detection counts, categories) are set to None when no
completed inference results exist.
"""

from __future__ import annotations

import logging
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional

from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.report import Detection, Report
from app.schemas.dashboard import (
    CategoryCount,
    DashboardStats,
    StatusCount,
    SeverityCount,
    TrendPoint,
    TrendsResponse,
)
from app.services.hotspot_service import get_hotspots
from app.services.model_service import model_service

logger = logging.getLogger(__name__)


def _today_utc() -> date:
    return datetime.now(tz=timezone.utc).date()


async def get_dashboard_stats(db: AsyncSession) -> DashboardStats:
    today = _today_utc()
    seven_ago = today - timedelta(days=7)
    thirty_ago = today - timedelta(days=30)

    # ── Total reports ──────────────────────────────────────────────────────────
    total = (await db.execute(select(func.count()).select_from(Report))).scalar_one()

    today_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)
    seven_start = datetime(seven_ago.year, seven_ago.month, seven_ago.day, tzinfo=timezone.utc)
    thirty_start = datetime(thirty_ago.year, thirty_ago.month, thirty_ago.day, tzinfo=timezone.utc)

    reports_today = (
        await db.execute(
            select(func.count()).select_from(Report).where(Report.submitted_at >= today_start)
        )
    ).scalar_one()

    reports_7d = (
        await db.execute(
            select(func.count()).select_from(Report).where(Report.submitted_at >= seven_start)
        )
    ).scalar_one()

    reports_30d = (
        await db.execute(
            select(func.count()).select_from(Report).where(Report.submitted_at >= thirty_start)
        )
    ).scalar_one()

    # ── Status breakdown ───────────────────────────────────────────────────────
    proc_rows = (
        await db.execute(
            select(Report.processing_status, func.count()).group_by(Report.processing_status)
        )
    ).all()
    by_proc = [StatusCount(status=r[0], count=r[1]) for r in proc_rows]

    review_rows = (
        await db.execute(
            select(Report.review_status, func.count()).group_by(Report.review_status)
        )
    ).all()
    by_review = [StatusCount(status=r[0], count=r[1]) for r in review_rows]

    # ── Distinct reporters ─────────────────────────────────────────────────────
    reporters = (
        await db.execute(select(func.count(distinct(Report.user_id))).select_from(Report))
    ).scalar_one()

    # ── Hotspots ───────────────────────────────────────────────────────────────
    hotspot_response = await get_hotspots(db)
    sev_counter: Counter = Counter(h.severity for h in hotspot_response.items)
    by_sev = [SeverityCount(severity=s, count=c) for s, c in sev_counter.items()]

    # ── AI metrics ─────────────────────────────────────────────────────────────
    total_detections: Optional[int] = None
    top_categories: Optional[List[CategoryCount]] = None
    success_rate: Optional[float] = None

    if model_service.is_available or (
        (await db.execute(
            select(func.count()).select_from(Detection)
        )).scalar_one() > 0
    ):
        det_count = (
            await db.execute(select(func.count()).select_from(Detection))
        ).scalar_one()
        total_detections = det_count

        cat_rows = (
            await db.execute(
                select(Detection.predicted_class, func.count())
                .group_by(Detection.predicted_class)
                .order_by(func.count().desc())
                .limit(10)
            )
        ).all()
        top_categories = [CategoryCount(category=r[0], count=r[1]) for r in cat_rows]

        completed = next(
            (s.count for s in by_proc if s.status == "completed"), 0
        )
        failed = next(
            (s.count for s in by_proc if s.status == "failed"), 0
        )
        if (completed + failed) > 0:
            success_rate = completed / (completed + failed)

    return DashboardStats(
        total_reports=total,
        reports_today=reports_today,
        reports_last_7_days=reports_7d,
        reports_last_30_days=reports_30d,
        by_processing_status=by_proc,
        by_review_status=by_review,
        distinct_reporters=reporters,
        hotspot_count=len(hotspot_response.items),
        by_hotspot_severity=by_sev,
        model_available=model_service.is_available,
        total_detections=total_detections,
        top_waste_categories=top_categories,
        processing_success_rate=success_rate,
    )


async def get_trends(db: AsyncSession, days: int = 14) -> TrendsResponse:
    """Return daily report submission counts for the last *days* days."""
    if days < 1 or days > 365:
        days = 14

    today = _today_utc()
    start = today - timedelta(days=days - 1)
    start_dt = datetime(start.year, start.month, start.day, tzinfo=timezone.utc)

    rows = (
        await db.execute(
            select(
                func.date(Report.submitted_at).label("day"),
                func.count().label("cnt"),
            )
            .where(Report.submitted_at >= start_dt)
            .group_by(func.date(Report.submitted_at))
            .order_by(func.date(Report.submitted_at))
        )
    ).all()

    # Build a full date range so the chart shows zero-count days
    day_map: Dict[str, int] = {str(r[0]): r[1] for r in rows}
    points: List[TrendPoint] = []
    for i in range(days):
        d = (start + timedelta(days=i)).isoformat()
        points.append(TrendPoint(date=d, count=day_map.get(d, 0)))

    return TrendsResponse(observations_by_date=points, days=days)

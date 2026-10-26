"""EcoWatch AI — Dashboard analytics routes (admin only)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_admin
from app.db.session import get_db
from app.schemas.dashboard import DashboardStats, TrendsResponse
from app.services.dashboard_service import get_dashboard_stats, get_trends

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats, dependencies=[Depends(require_admin)])
async def stats(db: AsyncSession = Depends(get_db)):
    """
    Admin only: aggregate statistics derived from real database records.
    AI-dependent fields are None when no inference results exist.
    """
    return await get_dashboard_stats(db)


@router.get("/trends", response_model=TrendsResponse, dependencies=[Depends(require_admin)])
async def trends(
    days: int = Query(14, ge=1, le=365, description="Number of past days to include"),
    db: AsyncSession = Depends(get_db),
):
    """Admin only: daily report submission counts for a configurable date range."""
    return await get_trends(db, days)

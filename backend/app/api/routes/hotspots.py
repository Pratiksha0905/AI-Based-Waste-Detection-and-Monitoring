"""EcoWatch AI — Hotspot routes (admin only)."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_admin
from app.db.session import get_db
from app.schemas.hotspot import HotspotListResponse
from app.services.hotspot_service import get_hotspots

router = APIRouter(prefix="/api/hotspots", tags=["hotspots"])


@router.get("", response_model=HotspotListResponse, dependencies=[Depends(require_admin)])
async def hotspots(db: AsyncSession = Depends(get_db)):
    """
    Admin only: return clustered waste hotspots computed from all non-rejected
    reports.  Returns an empty list when no reports exist.
    """
    return await get_hotspots(db)

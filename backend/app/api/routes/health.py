"""EcoWatch AI — Health check routes."""

from fastapi import APIRouter
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from app.db.session import get_db
from app.services.model_service import model_service

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("", summary="Application health")
async def health(db: AsyncSession = Depends(get_db)):
    """Returns application and database liveness status."""
    db_ok = False
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass
    return {"status": "ok" if db_ok else "degraded", "database": db_ok}


@router.get("/model", summary="Model availability")
async def model_health():
    """Returns current model loading status and availability."""
    return model_service.status

"""
EcoWatch AI — FastAPI application factory.

Startup lifecycle:
  1. Ensure upload directory exists.
  2. Run database migrations (create tables) for SQLite dev only.
     Production should use `alembic upgrade head` explicitly.
  3. Log model availability.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, dashboard, health, hotspots, reports
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers

logger = logging.getLogger(__name__)
settings = get_settings()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ───────────────────────────────────────────────────────────────
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    logger.info("Upload directory: %s", settings.upload_path.resolve())

    # Auto-create tables in SQLite dev mode (migrations handle production)
    if "sqlite" in settings.database_url:
        from app.db.base import Base
        from app.db.session import engine
        import app.models  # noqa: F401 — register all ORM models

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("SQLite tables created / verified.")

    # Log model status
    from app.services.model_service import model_service
    status = model_service.status
    if status["available"]:
        logger.info("AI model loaded: %s", status.get("model_path"))
    else:
        logger.info("AI model not available: %s", status.get("error"))

    yield
    # ── Shutdown ──────────────────────────────────────────────────────────────
    logger.info("EcoWatch AI shutting down.")


def create_app() -> FastAPI:
    app = FastAPI(
        title="EcoWatch AI API",
        description=(
            "Backend for the EcoWatch AI waste detection and monitoring system. "
            "Provides authentication, report submission, hotspot mapping, "
            "and admin analytics endpoints."
        ),
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Exception handlers ────────────────────────────────────────────────────
    register_exception_handlers(app)

    # ── Routers ───────────────────────────────────────────────────────────────
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(reports.router)
    app.include_router(hotspots.router)
    app.include_router(dashboard.router)

    return app


app = create_app()

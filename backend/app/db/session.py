"""
EcoWatch AI — SQLAlchemy async database session factory.

Uses aiosqlite for local development and tests, and asyncpg for PostgreSQL in
production.  The engine and SessionLocal are configured from settings.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    # echo=True to log all SQL during development (set via env if needed)
    echo=settings.environment == "development",
    # SQLite-specific: allow multi-threaded access within a single process
    connect_args={"check_same_thread": False}
    if "sqlite" in settings.database_url
    else {},
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def get_db() -> AsyncSession:  # type: ignore[return]
    """FastAPI dependency: yields an async database session and closes it after the request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise

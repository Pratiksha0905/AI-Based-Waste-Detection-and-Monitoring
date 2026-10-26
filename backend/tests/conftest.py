"""
EcoWatch AI — pytest configuration and fixtures.

Uses an in-memory SQLite database so tests never touch the production DB.
Temporary upload directories are cleaned up after each test session.
"""

from __future__ import annotations

import io
import tempfile
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.session import get_db
from app.main import create_app
import app.models  # noqa — register all ORM models

# ── In-memory test database ───────────────────────────────────────────────────

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

_test_engine = create_async_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
_TestSession = async_sessionmaker(_test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _create_tables():
    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    async with _TestSession() as session:
        yield session


# ── Temporary upload directory ────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _tmp_uploads(tmp_path, monkeypatch):
    """Point UPLOAD_DIR at a temporary directory for each test."""
    from app.core import config as cfg_module

    original = cfg_module.get_settings.cache_info()
    cfg_module.get_settings.cache_clear()

    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
    monkeypatch.setenv("DATABASE_URL", TEST_DB_URL)

    yield tmp_path

    cfg_module.get_settings.cache_clear()


# ── ASGI test client ──────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def client(db: AsyncSession):
    """HTTP test client with DB dependency overridden to the test session."""

    async def _override_db():
        yield db

    app = create_app()
    app.dependency_overrides[get_db] = _override_db

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


# ── Minimal synthetic image (valid JPEG, 1×1 px) ─────────────────────────────

@pytest.fixture
def minimal_jpeg() -> bytes:
    """
    A real 1×1 pixel JPEG image for upload tests.
    This is a valid image created at test time — NOT stored in production.
    """
    from PIL import Image

    buf = io.BytesIO()
    img = Image.new("RGB", (1, 1), color=(0, 128, 0))
    img.save(buf, format="JPEG")
    return buf.getvalue()


# ── Auth helpers ──────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def user_token(client: AsyncClient) -> str:
    await client.post(
        "/api/auth/register",
        json={"name": "Test User", "email": "user@test.com", "password": "password123"},
    )
    resp = await client.post(
        "/api/auth/login",
        json={"email": "user@test.com", "password": "password123"},
    )
    return resp.json()["access_token"]


@pytest_asyncio.fixture
async def admin_token(client: AsyncClient, db: AsyncSession) -> str:
    """Creates an admin directly via service (no public endpoint for admin registration)."""
    from app.services.auth_service import create_admin_user

    await create_admin_user(db, "Admin", "admin@test.com", "adminpass123")
    resp = await client.post(
        "/api/auth/login",
        json={"email": "admin@test.com", "password": "adminpass123"},
    )
    return resp.json()["access_token"]

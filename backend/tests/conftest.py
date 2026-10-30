"""
EcoWatch AI — pytest configuration and fixtures.

Uses an in-memory SQLite database so tests never touch the production DB.
Each test gets a fresh database session in the same event loop.
"""

from __future__ import annotations

import io
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.session import get_db
import app.models  # noqa — register all ORM models

# ── Suppress background inference in tests ────────────────────────────────────
# _run_inference_sync spins up a new event loop + new DB session that doesn't
# share the in-memory test database, so we patch it out entirely.

@pytest.fixture(autouse=True)
def _no_background_inference(monkeypatch):
    """Replace _run_inference_sync with a no-op so tests don't hit a separate DB."""
    monkeypatch.setattr(
        "app.services.report_service._run_inference_sync",
        lambda *args, **kwargs: None,
    )

# ─── one engine per test session (in-memory SQLite) ──────────────────────────

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(scope="session")
async def engine():
    eng = create_async_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def db(engine) -> AsyncSession:
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session


# ── ASGI test client ──────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def client(db: AsyncSession):
    """HTTP test client with DB dependency overridden to the test session."""

    async def _override_db():
        yield db

    from app.main import create_app

    application = create_app()
    application.dependency_overrides[get_db] = _override_db

    async with AsyncClient(
        transport=ASGITransport(app=application), base_url="http://test"
    ) as ac:
        yield ac


# ── Minimal synthetic JPEG (valid 1×1 px image) ───────────────────────────────

@pytest.fixture
def minimal_jpeg() -> bytes:
    from PIL import Image

    buf = io.BytesIO()
    img = Image.new("RGB", (4, 4), color=(0, 128, 0))
    img.save(buf, format="JPEG")
    return buf.getvalue()


# ── Auth helpers ──────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def user_token(client: AsyncClient) -> str:
    r = await client.post(
        "/api/auth/register",
        json={"name": "Test User", "email": "user@test.com", "password": "password123"},
    )
    assert r.status_code in (201, 409), f"Register failed: {r.text}"
    resp = await client.post(
        "/api/auth/login",
        json={"email": "user@test.com", "password": "password123"},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest_asyncio.fixture
async def admin_token(client: AsyncClient, db: AsyncSession) -> str:
    from app.services.auth_service import create_admin_user

    await create_admin_user(db, "Admin", "admin@test.com", "adminpass123")
    resp = await client.post(
        "/api/auth/login",
        json={"email": "admin@test.com", "password": "adminpass123"},
    )
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    return resp.json()["access_token"]

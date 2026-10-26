"""
EcoWatch AI — Auth service.

Handles:
  - User registration (public, role always 'user')
  - Login (email + password)
  - Admin bootstrap (CLI only, never a public endpoint)
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import ConflictError
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse

logger = logging.getLogger(__name__)
settings = get_settings()


async def register_user(db: AsyncSession, data: RegisterRequest) -> User:
    """
    Register a new regular user.

    Role is always 'user' regardless of any client input.
    Raises ConflictError if the email is already taken.
    """
    existing = (
        await db.execute(select(User).where(User.email == data.email.lower()))
    ).scalar_one_or_none()

    if existing is not None:
        raise ConflictError("An account with that email address already exists.")

    user = User(
        name=data.name.strip(),
        email=data.email.lower(),
        hashed_password=hash_password(data.password),
        role="user",  # server-assigned — never from client
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info("Registered new user: %s", user.email)
    return user


async def login(db: AsyncSession, data: LoginRequest) -> TokenResponse:
    """
    Authenticate a user and return a signed JWT access token.

    Uses a single generic error message for both bad email and bad password
    to prevent email enumeration.
    """
    from fastapi import HTTPException, status

    _bad = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user = (
        await db.execute(select(User).where(User.email == data.email.lower()))
    ).scalar_one_or_none()

    if user is None or not verify_password(data.password, user.hashed_password):
        raise _bad

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled. Contact an administrator.",
        )

    token = create_access_token(subject=str(user.id), role=user.role)
    expires_in = settings.access_token_expire_minutes * 60

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=expires_in,
    )


async def create_admin_user(
    db: AsyncSession, name: str, email: str, password: str
) -> User:
    """
    Create or promote an admin user.  Called only from the CLI bootstrap
    command — never from a public API endpoint.
    """
    existing = (
        await db.execute(select(User).where(User.email == email.lower()))
    ).scalar_one_or_none()

    if existing is not None:
        existing.role = "admin"
        await db.commit()
        await db.refresh(existing)
        logger.info("Promoted existing user to admin: %s", email)
        return existing

    admin = User(
        name=name.strip(),
        email=email.lower(),
        hashed_password=hash_password(password),
        role="admin",
    )
    db.add(admin)
    await db.commit()
    await db.refresh(admin)
    logger.info("Created admin user: %s", email)
    return admin

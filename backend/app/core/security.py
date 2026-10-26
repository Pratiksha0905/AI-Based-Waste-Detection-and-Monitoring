"""
EcoWatch AI — Security utilities.

Covers:
  - Password hashing (bcrypt via passlib)
  - JWT access-token creation and validation
  - Token-payload extraction helpers
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()

# ── Password hashing ──────────────────────────────────────────────────────────

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Return a bcrypt hash of *plain*.  Never store plain passwords."""
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True iff *plain* matches *hashed*."""
    return _pwd_context.verify(plain, hashed)


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_access_token(
    subject: str,
    *,
    role: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create and sign a JWT access token.

    :param subject: The user's unique identifier (e.g. str(user.id)).
    :param role: The user's role ('user' | 'admin').  Embedded in the token
                 payload but ALWAYS re-verified from the database on each
                 protected request — never trusted from the token alone.
    :param expires_delta: Custom TTL.  Defaults to ACCESS_TOKEN_EXPIRE_MINUTES.
    """
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.access_token_expire_minutes)

    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": subject,
        "role": role,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> dict:
    """
    Decode and verify a JWT access token.

    :raises JWTError: on invalid signature, expiry, or malformed token.
    :returns: The raw payload dict on success.
    """
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])

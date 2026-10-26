"""
EcoWatch AI — Security utilities.

Covers:
  - Password hashing (Argon2 via argon2-cffi)
  - JWT access-token creation and validation
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from jose import JWTError, jwt

from app.core.config import get_settings

settings = get_settings()

# ── Password hashing (Argon2) ─────────────────────────────────────────────────

_ph = PasswordHasher()


def hash_password(plain: str) -> str:
    """Return an Argon2 hash of *plain*.  Never store plain passwords."""
    return _ph.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True iff *plain* matches *hashed*."""
    try:
        return _ph.verify(hashed, plain)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_access_token(
    subject: str,
    *,
    role: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create and sign a JWT access token.

    :param subject: The user's unique identifier (str(user.id)).
    :param role: Embedded for convenience; never trusted for authorization.
    :param expires_delta: Custom TTL. Defaults to ACCESS_TOKEN_EXPIRE_MINUTES.
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
    """
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])

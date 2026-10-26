"""
EcoWatch AI — SQLAlchemy declarative base.

All ORM models must inherit from Base so that Alembic can discover them for
migrations and so that create_all() works in tests.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""

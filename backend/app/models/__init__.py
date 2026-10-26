# EcoWatch AI — models package
# Import all models here so Alembic autogenerate can discover them
from app.models.user import User  # noqa: F401
from app.models.report import Report, Detection  # noqa: F401

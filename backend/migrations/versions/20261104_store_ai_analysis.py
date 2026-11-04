"""Persist complete AI analysis JSON on each report."""

from alembic import op
import sqlalchemy as sa

revision = "20261104_store_ai_analysis"
down_revision = "20261030_database_image_storage"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("reports", sa.Column("ai_analysis", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("reports", "ai_analysis")

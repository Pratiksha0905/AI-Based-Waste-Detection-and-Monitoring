"""
EcoWatch AI — Central application configuration.

All settings are read from environment variables (or a .env file).
Missing model configuration does NOT prevent the backend from starting.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Database ──────────────────────────────────────────────────────────────
    database_url: str = "sqlite+aiosqlite:///./ecowatch.db"

    # ── Authentication ────────────────────────────────────────────────────────
    secret_key: str = "INSECURE_DEVELOPMENT_KEY_REPLACE_IN_PRODUCTION"
    access_token_expire_minutes: int = 60
    algorithm: str = "HS256"

    # ── CORS ──────────────────────────────────────────────────────────────────
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # ── Legacy image migration source ─────────────────────────────────────────
    # Used only to import old filesystem images; new images are database-backed.
    legacy_upload_dir: str = Field(
        default="uploads",
        validation_alias=AliasChoices("LEGACY_UPLOAD_DIR", "UPLOAD_DIR"),
    )
    max_upload_size_mb: int = 20

    @property
    def max_upload_size_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    @property
    def legacy_upload_path(self) -> Path:
        return Path(self.legacy_upload_dir)

    # ── AI model ──────────────────────────────────────────────────────────────
    model_path: str = ""
    model_confidence_threshold: float = 0.25

    @property
    def model_available(self) -> bool:
        """True only when MODEL_PATH is set and the file actually exists."""
        if not self.model_path:
            return False
        return Path(self.model_path).is_file()

    # ── Hotspot clustering ────────────────────────────────────────────────────
    hotspot_cluster_radius_m: float = 30.0
    hotspot_low_min: int = 1
    hotspot_medium_min: int = 3
    hotspot_high_min: int = 6
    hotspot_critical_min: int = 10

    # ── Miscellaneous ─────────────────────────────────────────────────────────
    environment: str = "development"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

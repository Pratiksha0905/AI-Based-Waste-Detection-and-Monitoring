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

    # Database
    database_url: str = "sqlite+aiosqlite:///./ecowatch.db"

    # Authentication
    secret_key: str = "INSECURE_DEVELOPMENT_KEY_REPLACE_IN_PRODUCTION"
    access_token_expire_minutes: int = 60
    algorithm: str = "HS256"

    # CORS
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # Legacy image migration
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

    # AI model
    model_path: str = ""
    model_confidence_threshold: float = 0.25

    # External AI pipeline
    ai_pipeline_root: str = ""
    enable_depth_analysis: bool = True
    model_image_size: int = 320
    generated_analysis_dir: str = "generated_analysis"

    @property
    def generated_analysis_path(self) -> Path:
        path = Path(self.generated_analysis_dir)
        return path if path.is_absolute() else Path(__file__).resolve().parents[2] / path

    @property
    def ai_pipeline_available(self) -> bool:
        if not self.ai_pipeline_root:
            return False

        pipeline_file = (
            Path(self.ai_pipeline_root)
            / "src"
            / "pipeline"
            / "waste_analysis_pipeline.py"
        )
        return pipeline_file.is_file()

    @property
    def model_available(self) -> bool:
        if not self.model_path:
            return False
        return Path(self.model_path).is_file()

    # Hotspot clustering
    hotspot_cluster_radius_m: float = 30.0
    hotspot_low_min: int = 1
    hotspot_medium_min: int = 3
    hotspot_high_min: int = 6
    hotspot_critical_min: int = 10

    # Miscellaneous
    environment: str = "development"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
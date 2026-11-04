
from __future__ import annotations

import io
import logging
import math
import sys
import tempfile

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, List, Optional

from app.core.config import get_settings
from app.core.exceptions import ModelUnavailableError

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class DetectionResult:
    predicted_class: str
    confidence: float
    bbox_x1: Optional[float] = None
    bbox_y1: Optional[float] = None
    bbox_x2: Optional[float] = None
    bbox_y2: Optional[float] = None
    relative_depth: Optional[float] = None


@dataclass
class InferenceResult:
    detections: List[DetectionResult] = field(default_factory=list)
    model_version: Optional[str] = None
    analysis: dict = field(default_factory=dict)


def make_json_safe(value: Any) -> Any:
    """Convert pipeline values into JSON-compatible Python values."""

    if isinstance(value, dict):
        return {
            str(key): make_json_safe(item)
            for key, item in value.items()
        }

    if isinstance(value, (list, tuple)):
        return [make_json_safe(item) for item in value]

    if isinstance(value, float) and not math.isfinite(value):
        return None

    if hasattr(value, "tolist"):
        return make_json_safe(value.tolist())

    if hasattr(value, "item"):
        return value.item()

    if isinstance(value, Path):
        return str(value)

    return value


class _ModelService:

    def __init__(self):
        self._pipeline = None
        self._loaded = False
        self._load_error = None

    def _try_load(self):

        if self._loaded:
            return

        try:
            if not settings.model_available:
                raise FileNotFoundError(
                    "MODEL_PATH is missing or the checkpoint does not exist."
                )

            if not settings.ai_pipeline_available:
                raise FileNotFoundError(
                    "AI_PIPELINE_ROOT is missing or the pipeline file "
                    "does not exist."
                )

            pipeline_root = str(
                Path(settings.ai_pipeline_root).resolve()
            )

            if pipeline_root not in sys.path:
                sys.path.insert(0, pipeline_root)

            from src.pipeline.waste_analysis_pipeline import (
                WasteAnalysisPipeline,
            )

            logger.info(
                "Loading waste analysis pipeline from %s",
                pipeline_root,
            )

            self._pipeline = WasteAnalysisPipeline(
                model_path=settings.model_path,
                include_depth=settings.enable_depth_analysis,
                confidence=settings.model_confidence_threshold,
                image_size=settings.model_image_size,
            )

            self._load_error = None

            logger.info("Waste analysis pipeline loaded successfully.")

        except Exception as exc:
            self._pipeline = None
            self._load_error = str(exc)

            logger.exception(
                "Failed to load waste analysis pipeline"
            )

        finally:
            self._loaded = True

    @property
    def is_available(self) -> bool:
        self._try_load()
        return self._pipeline is not None

    @property
    def status(self) -> dict:
        self._try_load()

        return {
            "available": self._pipeline is not None,
            "model_path": settings.model_path or None,
            "pipeline_root": settings.ai_pipeline_root or None,
            "depth_enabled": settings.enable_depth_analysis,
            "error": self._load_error,
        }

    def run_inference(self, image_bytes: bytes) -> InferenceResult:

        self._try_load()

        if self._pipeline is None:
            raise ModelUnavailableError(
                self._load_error
                or "Waste analysis pipeline is unavailable."
            )

        from PIL import Image

        temporary_path = None

        try:
            # Validate the uploaded image and preserve its format.
            with Image.open(io.BytesIO(image_bytes)) as image:
                image_format = (image.format or "JPEG").upper()

                extensions = {
                    "JPEG": ".jpg",
                    "PNG": ".png",
                    "WEBP": ".webp",
                    "BMP": ".bmp",
                    "TIFF": ".tiff",
                }

                suffix = extensions.get(image_format, ".jpg")
                image.verify()

            # The existing pipeline accepts a filesystem path.
            with tempfile.NamedTemporaryFile(
                suffix=suffix,
                delete=False,
            ) as temporary_file:
                temporary_file.write(image_bytes)
                temporary_path = temporary_file.name

            raw_analysis = self._pipeline.analyze(
                temporary_path,
                save_depth_map=False,
            )

            analysis = make_json_safe(raw_analysis)

            if not isinstance(analysis, dict):
                raise ValueError(
                    "Pipeline returned an invalid analysis result."
                )

            # Do not expose temporary server paths in API responses.
            analysis.pop("image_path", None)

            image_width = int(analysis["image_width"])
            image_height = int(analysis["image_height"])

            if image_width <= 0 or image_height <= 0:
                raise ValueError("Invalid image dimensions in pipeline output.")

            detections = []

            for item in analysis.get("detections", []):

                bbox = item.get("bbox_xyxy")

                if not bbox or len(bbox) != 4:
                    continue

                x1, y1, x2, y2 = map(float, bbox)

                detections.append(
                    DetectionResult(
                        predicted_class=str(item["class_name"]),
                        confidence=float(item["confidence"]),
                        bbox_x1=max(0.0, min(1.0, x1 / image_width)),
                        bbox_y1=max(0.0, min(1.0, y1 / image_height)),
                        bbox_x2=max(0.0, min(1.0, x2 / image_width)),
                        bbox_y2=max(0.0, min(1.0, y2 / image_height)),
                        relative_depth=(
                            float(item["relative_depth"])
                            if item.get("relative_depth") is not None
                            else None
                        ),
                    )
                )

            return InferenceResult(
                detections=detections,
                model_version=Path(settings.model_path).stem,
                analysis=analysis,
            )

        except ModelUnavailableError:
            raise

        except Exception as exc:
            logger.exception("Waste inference failed")
            raise RuntimeError(
                f"Waste analysis failed: {exc}"
            ) from exc

        finally:
            if temporary_path:
                try:
                    Path(temporary_path).unlink(missing_ok=True)
                except OSError:
                    logger.warning(
                        "Could not remove temporary image: %s",
                        temporary_path,
                    )


model_service = _ModelService()

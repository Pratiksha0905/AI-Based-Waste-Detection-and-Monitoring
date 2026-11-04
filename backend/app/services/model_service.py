
from __future__ import annotations

import io
import logging
import math
import sys
import tempfile
import uuid

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, List, Optional

from app.core.config import get_settings
from app.core.exceptions import ModelUnavailableError
from app.services.analysis_artifact_service import (
    create_analysis_artifacts,
    remove_analysis_generation,
)

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class DetectionResult:
    id: str
    predicted_class: str
    confidence: float
    detection_index: int
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
        return make_json_safe(value.item())

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

    def run_inference(
        self, image_bytes: bytes, report_id: Optional[str] = None
    ) -> InferenceResult:

        self._try_load()

        if self._pipeline is None:
            raise ModelUnavailableError(
                self._load_error
                or "Waste analysis pipeline is unavailable."
            )

        from PIL import Image

        temporary_path = None
        artifact_report_id = report_id or str(uuid.uuid4())
        generated_artifacts = None

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

            if not isinstance(raw_analysis, dict):
                raise ValueError(
                    "Pipeline returned an invalid analysis result."
                )

            depth_analysis = raw_analysis.get("depth_analysis")
            depth_map = None
            if isinstance(depth_analysis, dict):
                depth_map = depth_analysis.pop("depth_map", None)
            if depth_map is None:
                depth_map = raw_analysis.pop("depth_map", None)

            # Do not expose temporary server paths in API responses.
            raw_analysis.pop("image_path", None)

            image_width = int(raw_analysis["image_width"])
            image_height = int(raw_analysis["image_height"])

            if image_width <= 0 or image_height <= 0:
                raise ValueError("Invalid image dimensions in pipeline output.")

            detections = []
            raw_detections = []
            artifact_detections = []
            detection_ids_by_index: dict[int, str] = {}

            for detection_index, item in enumerate(
                raw_analysis.get("detections", [])
            ):

                bbox = item.get("bbox_xyxy")

                if not bbox or len(bbox) != 4:
                    continue

                x1, y1, x2, y2 = map(float, bbox)
                if not all(math.isfinite(value) for value in (x1, y1, x2, y2)):
                    continue
                x1 = max(0.0, min(float(image_width), x1))
                y1 = max(0.0, min(float(image_height), y1))
                x2 = max(0.0, min(float(image_width), x2))
                y2 = max(0.0, min(float(image_height), y2))
                if x2 <= x1 or y2 <= y1:
                    continue

                detection_id = str(uuid.uuid4())
                detection_index = len(detections)
                detection = dict(item)
                detection.update(
                    {
                        "detection_id": detection_id,
                        "detection_index": detection_index,
                        "bbox_xyxy": [x1, y1, x2, y2],
                    }
                )
                detection_ids_by_index[detection_index] = detection_id
                raw_detections.append(detection)
                artifact_detections.append(
                    {
                        "id": detection_id,
                        "detection_index": detection_index,
                        "class_name": str(item["class_name"]),
                        "confidence": float(item["confidence"]),
                        "bbox_xyxy": [x1, y1, x2, y2],
                    }
                )

                detections.append(
                    DetectionResult(
                        id=detection_id,
                        predicted_class=str(item["class_name"]),
                        confidence=float(item["confidence"]),
                        detection_index=detection_index,
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

            raw_analysis["detections"] = raw_detections
            analysis = make_json_safe(raw_analysis)

            if not isinstance(analysis, dict):
                raise ValueError(
                    "Pipeline returned an invalid analysis result."
                )

            artifacts, overall_depth, per_detection_depth = (
                create_analysis_artifacts(
                    temporary_path,
                    artifact_report_id,
                    artifact_detections,
                    depth_map,
                )
            )
            generated_artifacts = artifacts

            analysis_detections = analysis.get("detections", [])
            for item in analysis_detections:
                detection_id = item.get("detection_id")
                metrics = per_detection_depth.get(detection_id)
                if metrics is not None:
                    item.update(metrics)
                item["detection_id"] = detection_id

            for detection in detections:
                metrics = per_detection_depth.get(detection.id, {})
                depth_stats = metrics.get("depth_analysis", {})
                if depth_stats.get("available"):
                    detection.relative_depth = depth_stats["median"]

            volume_analysis = analysis.get("volume_analysis")
            if not isinstance(volume_analysis, dict):
                volume_analysis = {
                    "piles": [],
                    "pile_count": 0,
                    "limitations": [],
                }
                analysis["volume_analysis"] = volume_analysis

            pile_results = volume_analysis.get("piles", [])
            if not isinstance(pile_results, list):
                pile_results = []
                volume_analysis["piles"] = pile_results
            for pile in pile_results:
                index = pile.get("detection_index")
                if isinstance(index, int) and index in detection_ids_by_index:
                    pile["detection_id"] = detection_ids_by_index[index]
                pile["analysis_status"] = (
                    "available"
                    if pile.get("relative_volume_index") is not None
                    else "unavailable"
                )

            limitations = volume_analysis.get("limitations")
            if not isinstance(limitations, list):
                limitations = []
            volume_analysis.update(
                {
                    "pile_count": len(pile_results),
                    "status": (
                        "relative_heuristic_only"
                        if pile_results
                        else "not_applicable"
                    ),
                    "limitations": limitations,
                }
            )
            analysis["volume_status"] = volume_analysis["status"]
            analysis["artifacts"] = artifacts
            analysis["depth_analysis"] = {
                **(
                    analysis.get("depth_analysis")
                    if isinstance(analysis.get("depth_analysis"), dict)
                    else {}
                ),
                **overall_depth,
                "status": (
                    "available" if overall_depth["available"] else "unavailable"
                ),
                "depth_map_available": artifacts["depth_map"] is not None,
                "interpretation": overall_depth["interpretation"],
            }

            return InferenceResult(
                detections=detections,
                model_version=Path(settings.model_path).stem,
                analysis=analysis,
            )

        except ModelUnavailableError:
            raise

        except Exception as exc:
            if generated_artifacts is not None:
                remove_analysis_generation(
                    artifact_report_id, generated_artifacts.get("generation")
                )
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

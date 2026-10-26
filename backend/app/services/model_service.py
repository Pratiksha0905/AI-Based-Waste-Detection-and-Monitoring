"""
EcoWatch AI — YOLO model service.

Design:
  - Model is loaded lazily on first inference request.
  - If MODEL_PATH is unset or the file is absent, the backend starts normally
    and all inference calls raise ModelUnavailableError.
  - Never returns fabricated predictions.
  - Result schema is fixed so that swapping the checkpoint does not break
    the report API.

When the real checkpoint is available:
  1. Set MODEL_PATH=/path/to/best.pt in .env
  2. Uncomment the ultralytics import in requirements.txt and reinstall.
  3. The service will load the model on first use.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

from app.core.config import get_settings
from app.core.exceptions import ModelUnavailableError

logger = logging.getLogger(__name__)
settings = get_settings()


# ── Result schema ─────────────────────────────────────────────────────────────

@dataclass
class DetectionResult:
    predicted_class: str
    confidence: float
    bbox_x1: Optional[float] = None
    bbox_y1: Optional[float] = None
    bbox_x2: Optional[float] = None
    bbox_y2: Optional[float] = None


@dataclass
class InferenceResult:
    detections: List[DetectionResult] = field(default_factory=list)
    model_version: Optional[str] = None


# ── Model loader ──────────────────────────────────────────────────────────────

class _ModelService:
    """
    Singleton-like model wrapper.

    Usage:
        result = await model_service.run_inference(image_bytes)
    """

    def __init__(self) -> None:
        self._model = None          # the loaded ultralytics YOLO object
        self._loaded: bool = False
        self._load_error: Optional[str] = None

    def _try_load(self) -> None:
        """Load the checkpoint once.  Records errors without crashing the server."""
        if self._loaded:
            return

        if not settings.model_available:
            self._load_error = (
                "Model checkpoint is not configured. "
                "Set MODEL_PATH in .env when the checkpoint is available."
            )
            self._loaded = True
            return

        try:
            # Import is deferred so the server starts even without ultralytics installed
            from ultralytics import YOLO  # type: ignore[import]

            logger.info("Loading YOLO model from: %s", settings.model_path)
            self._model = YOLO(settings.model_path)
            logger.info("Model loaded successfully.")
            self._load_error = None
        except ImportError:
            self._load_error = (
                "ultralytics is not installed. "
                "Install it with: pip install ultralytics"
            )
            logger.warning(self._load_error)
        except Exception as exc:
            self._load_error = f"Model failed to load: {exc}"
            logger.error(self._load_error)
        finally:
            self._loaded = True

    @property
    def is_available(self) -> bool:
        self._try_load()
        return self._model is not None

    @property
    def status(self) -> dict:
        self._try_load()
        return {
            "available": self.is_available,
            "model_path": settings.model_path or None,
            "error": self._load_error,
        }

    def run_inference(self, image_bytes: bytes) -> InferenceResult:
        """
        Run YOLO inference on raw image bytes.

        :raises ModelUnavailableError: when the model is not loaded.
        :returns: InferenceResult with actual detections — never fabricated.
        """
        self._try_load()

        if self._model is None:
            raise ModelUnavailableError(
                self._load_error
                or "Model is not available. Inference cannot be performed."
            )

        import io
        from PIL import Image  # already in requirements

        img = Image.open(io.BytesIO(image_bytes))

        results = self._model.predict(
            source=img,
            conf=settings.model_confidence_threshold,
            verbose=False,
        )

        detections: List[DetectionResult] = []
        model_version: Optional[str] = None

        for r in results:
            # Extract model name/version from the ultralytics result object
            if model_version is None:
                try:
                    model_version = Path(settings.model_path).stem
                except Exception:
                    pass

            if r.boxes is None:
                continue

            names = r.names  # dict[int, str] — actual class names from the checkpoint

            for box in r.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                xyxyn = box.xyxyn[0].tolist()  # normalised [x1, y1, x2, y2]

                detections.append(
                    DetectionResult(
                        predicted_class=names.get(cls_id, f"class_{cls_id}"),
                        confidence=conf,
                        bbox_x1=xyxyn[0],
                        bbox_y1=xyxyn[1],
                        bbox_x2=xyxyn[2],
                        bbox_y2=xyxyn[3],
                    )
                )

        return InferenceResult(detections=detections, model_version=model_version)


# Singleton instance — loaded once per worker process
model_service = _ModelService()

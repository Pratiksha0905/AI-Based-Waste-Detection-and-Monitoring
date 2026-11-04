"""Generate and safely retrieve persistent images from model analysis."""

from __future__ import annotations

import logging
import math
import os
import shutil
import tempfile
import uuid
from pathlib import Path
from typing import Any

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _depth_statistics(depth: Any, image_width: int, image_height: int) -> tuple[dict, Any]:
    import cv2
    import numpy as np

    values = np.asarray(depth, dtype=np.float64)
    if values.ndim != 2 or values.size == 0:
        raise ValueError("The pipeline returned an invalid depth map.")
    if values.shape != (image_height, image_width):
        values = cv2.resize(
            values,
            (image_width, image_height),
            interpolation=cv2.INTER_LINEAR,
        )

    valid = np.isfinite(values)
    valid_values = values[valid]
    if not valid_values.size:
        return (
            {
                "available": False,
                "minimum": None,
                "maximum": None,
                "mean": None,
                "median": None,
                "standard_deviation": None,
                "range": None,
                "valid_pixel_count": 0,
                "interpretation": (
                    "MiDaS relative inverse depth; higher values indicate "
                    "nearer regions, not metric distance."
                ),
            },
            values,
        )

    depth_min = float(np.min(valid_values))
    depth_max = float(np.max(valid_values))
    return (
        {
            "available": True,
            "minimum": depth_min,
            "maximum": depth_max,
            "mean": float(np.mean(valid_values)),
            "median": float(np.median(valid_values)),
            "standard_deviation": float(np.std(valid_values)),
            "range": depth_max - depth_min,
            "valid_pixel_count": int(valid_values.size),
            "interpretation": (
                "MiDaS relative inverse depth; higher values indicate "
                "nearer regions, not metric distance."
            ),
        },
        values,
    )


def _region_depth_statistics(
    depth: Any,
    bbox: list[float],
    overall_median: float | None,
) -> dict:
    import numpy as np

    height, width = depth.shape
    x1, y1, x2, y2 = bbox
    left = max(0, min(width, math.floor(x1)))
    top = max(0, min(height, math.floor(y1)))
    right = max(0, min(width, math.ceil(x2)))
    bottom = max(0, min(height, math.ceil(y2)))
    if right <= left or bottom <= top:
        return {
            "available": False,
            "minimum": None,
            "maximum": None,
            "mean": None,
            "median": None,
            "standard_deviation": None,
            "range": None,
            "valid_pixel_count": 0,
            "near_far_interpretation": "Depth is unavailable for this detection.",
        }

    region = depth[top:bottom, left:right]
    valid_values = region[np.isfinite(region)]
    if not valid_values.size:
        return {
            "available": False,
            "minimum": None,
            "maximum": None,
            "mean": None,
            "median": None,
            "standard_deviation": None,
            "range": None,
            "valid_pixel_count": 0,
            "near_far_interpretation": "Depth is unavailable for this detection.",
        }

    median = float(np.median(valid_values))
    if overall_median is None or median == overall_median:
        interpretation = "At approximately the image-wide median relative depth."
    elif median > overall_median:
        interpretation = "Relatively nearer than the image-wide median."
    else:
        interpretation = "Relatively farther than the image-wide median."

    depth_min = float(np.min(valid_values))
    depth_max = float(np.max(valid_values))
    return {
        "available": True,
        "minimum": depth_min,
        "maximum": depth_max,
        "mean": float(np.mean(valid_values)),
        "median": median,
        "standard_deviation": float(np.std(valid_values)),
        "range": depth_max - depth_min,
        "valid_pixel_count": int(valid_values.size),
        "near_far_interpretation": interpretation,
    }


def _write_image(path: Path, image: Any, parameters: list[int] | None = None) -> None:
    import cv2

    path.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(path), image, parameters or []):
        raise OSError(f"Could not write generated analysis image: {path.name}")


def create_analysis_artifacts(
    image_path: str | Path,
    report_id: str,
    detections: list[dict[str, Any]],
    depth_map: Any = None,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, dict[str, Any]]]:
    """Write annotated/cropped/depth images and return manifest and metrics."""
    import cv2
    import numpy as np

    try:
        safe_report_id = str(uuid.UUID(report_id))
    except ValueError as exc:
        raise ValueError("Report ID must be a UUID before saving analysis images.") from exc

    image = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not read the uploaded image for analysis artifacts.")

    image_height, image_width = image.shape[:2]
    if image_width < 1 or image_height < 1:
        raise ValueError("Uploaded image has invalid dimensions.")

    overall_depth: dict[str, Any] = {
        "available": False,
        "minimum": None,
        "maximum": None,
        "mean": None,
        "median": None,
        "standard_deviation": None,
        "range": None,
        "valid_pixel_count": 0,
        "interpretation": (
            "MiDaS relative inverse depth; higher values indicate nearer "
            "regions, not metric distance."
        ),
    }
    depth = None
    if depth_map is not None:
        overall_depth, depth = _depth_statistics(
            depth_map, image_width, image_height
        )

    root = settings.generated_analysis_path.resolve()
    staging_root = root / ".staging"
    report_root = root / safe_report_id
    staging_root.mkdir(parents=True, exist_ok=True)
    report_root.mkdir(parents=True, exist_ok=True)

    generation = uuid.uuid4().hex
    staging_path = Path(
        tempfile.mkdtemp(prefix=f"{safe_report_id}-", dir=staging_root)
    )
    final_path = report_root / generation
    artifacts: dict[str, Any] = {
        "generation": generation,
        "annotated": f"{safe_report_id}/{generation}/annotated.jpg",
        "detection_crops": {},
        "depth_map": None,
    }
    per_detection: dict[str, dict[str, Any]] = {}

    try:
        annotated = image.copy()
        occupied_labels: list[tuple[int, int, int, int]] = []
        colors: dict[int, tuple[int, int, int]] = {}

        for index, item in enumerate(detections):
            detection_id = str(item["id"])
            bbox = item.get("bbox_xyxy")
            valid_bbox = (
                isinstance(bbox, (list, tuple))
                and len(bbox) == 4
                and all(math.isfinite(float(value)) for value in bbox)
            )
            detection_depth = (
                _region_depth_statistics(depth, bbox, overall_depth["median"])
                if depth is not None and valid_bbox
                else {
                    "available": False,
                    "minimum": None,
                    "maximum": None,
                    "mean": None,
                    "median": None,
                    "standard_deviation": None,
                    "range": None,
                    "valid_pixel_count": 0,
                    "near_far_interpretation": "Depth is unavailable for this detection.",
                }
            )
            metrics: dict[str, Any] = {"depth_analysis": detection_depth}

            if valid_bbox:
                x1, y1, x2, y2 = map(float, bbox)
                left = max(0, min(image_width - 1, math.floor(x1)))
                top = max(0, min(image_height - 1, math.floor(y1)))
                right = max(0, min(image_width, math.ceil(x2)))
                bottom = max(0, min(image_height, math.ceil(y2)))

                if right > left and bottom > top:
                    box_width = right - left
                    box_height = bottom - top
                    metrics["bbox_dimensions"] = {
                        "width_pixels": box_width,
                        "height_pixels": box_height,
                        "area_pixels": box_width * box_height,
                        "image_area_percentage": round(
                            box_width * box_height
                            / (image_width * image_height)
                            * 100,
                            4,
                        ),
                    }

                    crop = image[top:bottom, left:right]
                    crop_path = staging_path / "crops" / f"{detection_id}.jpg"
                    _write_image(crop_path, crop, [cv2.IMWRITE_JPEG_QUALITY, 95])
                    artifacts["detection_crops"][detection_id] = (
                        f"{safe_report_id}/{generation}/crops/{detection_id}.jpg"
                    )

                    color_index = index % 12
                    if color_index not in colors:
                        hue = color_index / 12
                        color = cv2.cvtColor(
                            np.uint8([[[int(hue * 179), 210, 245]]]),
                            cv2.COLOR_HSV2BGR,
                        )[0, 0]
                        colors[color_index] = tuple(map(int, color))
                    color = colors[color_index]
                    cv2.rectangle(
                        annotated,
                        (left, top),
                        (right - 1, bottom - 1),
                        color,
                        2,
                    )

                    label = (
                        f"{item['class_name']} "
                        f"{float(item['confidence']) * 100:.1f}%"
                    )
                    font = cv2.FONT_HERSHEY_SIMPLEX
                    scale = max(0.45, min(0.8, image_width / 1600))
                    text_size, baseline = cv2.getTextSize(label, font, scale, 1)
                    label_width = min(image_width, text_size[0] + 8)
                    label_height = text_size[1] + baseline + 8
                    label_x = min(left, max(0, image_width - label_width))
                    label_y = top - label_height
                    if label_y < 0:
                        label_y = min(image_height - label_height, top + 2)

                    for _ in range(len(occupied_labels) + 1):
                        label_box = (
                            label_x,
                            label_y,
                            label_x + label_width,
                            label_y + label_height,
                        )
                        if not any(
                            label_box[0] < prior[2]
                            and label_box[2] > prior[0]
                            and label_box[1] < prior[3]
                            and label_box[3] > prior[1]
                            for prior in occupied_labels
                        ):
                            break
                        label_y = max(0, label_y - label_height - 2)

                    occupied_labels.append(label_box)
                    cv2.rectangle(
                        annotated,
                        (label_box[0], label_box[1]),
                        (label_box[2], label_box[3]),
                        color,
                        thickness=-1,
                    )
                    cv2.putText(
                        annotated,
                        label,
                        (label_box[0] + 4, label_box[1] + text_size[1] + 3),
                        font,
                        scale,
                        (255, 255, 255),
                        1,
                        cv2.LINE_AA,
                    )

            per_detection[detection_id] = metrics

        _write_image(
            staging_path / "annotated.jpg",
            annotated,
            [cv2.IMWRITE_JPEG_QUALITY, 95],
        )

        if depth is not None and overall_depth["available"]:
            valid = np.isfinite(depth)
            normalized = np.zeros(depth.shape, dtype=np.uint8)
            depth_range = overall_depth["range"]
            if depth_range and depth_range > 0:
                normalized[valid] = np.clip(
                    (depth[valid] - overall_depth["minimum"])
                    / depth_range
                    * 255,
                    0,
                    255,
                ).astype(np.uint8)
            color_depth = cv2.applyColorMap(normalized, cv2.COLORMAP_TURBO)
            color_depth[~valid] = (0, 0, 0)
            _write_image(staging_path / "depth.png", color_depth)
            artifacts["depth_map"] = f"{safe_report_id}/{generation}/depth.png"

        os.replace(staging_path, final_path)
    except Exception:
        shutil.rmtree(staging_path, ignore_errors=True)
        raise

    return artifacts, overall_depth, per_detection


def resolve_analysis_image(relative_path: Any) -> Path | None:
    """Resolve a generated image reference without permitting path traversal."""
    if not isinstance(relative_path, str) or not relative_path:
        return None

    root = settings.generated_analysis_path.resolve()
    try:
        image_path = (root / relative_path).resolve(strict=True)
        image_path.relative_to(root)
    except (OSError, ValueError):
        return None
    return image_path if image_path.is_file() else None


def remove_analysis_generation(report_id: str, generation: Any) -> None:
    """Remove only the named generated directory for this report."""
    if not isinstance(generation, str) or len(generation) != 32:
        return
    try:
        uuid.UUID(hex=generation)
        safe_report_id = str(uuid.UUID(report_id))
    except ValueError:
        logger.warning("Skipped invalid analysis generation cleanup for report %s", report_id)
        return

    root = settings.generated_analysis_path.resolve()
    target = (root / safe_report_id / generation).resolve()
    expected_parent = (root / safe_report_id).resolve()
    if target.parent != expected_parent:
        logger.warning("Skipped analysis generation cleanup outside report storage.")
        return
    try:
        shutil.rmtree(target)
    except FileNotFoundError:
        return
    except OSError:
        logger.exception("Could not remove stale analysis images for report %s", report_id)

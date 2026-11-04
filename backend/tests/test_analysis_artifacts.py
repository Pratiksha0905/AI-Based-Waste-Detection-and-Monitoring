from __future__ import annotations

import uuid

import cv2
import numpy as np

from app.core.config import get_settings
from app.services.analysis_artifact_service import (
    create_analysis_artifacts,
    resolve_analysis_image,
)


def test_generated_images_and_depth_statistics(tmp_path, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "generated_analysis_dir", str(tmp_path / "outputs"))

    image_path = tmp_path / "source.png"
    image = np.full((8, 10, 3), 120, dtype=np.uint8)
    assert cv2.imwrite(str(image_path), image)

    first_id = str(uuid.uuid4())
    second_id = str(uuid.uuid4())
    depth = np.linspace(0, 1, 80, dtype=np.float32).reshape(8, 10)
    depth[0, 0] = np.nan
    detections = [
        {
            "id": first_id,
            "class_name": "pile",
            "confidence": 0.9,
            "bbox_xyxy": [0, 0, 4, 4],
        },
        {
            "id": second_id,
            "class_name": "plastic",
            "confidence": 0.8,
            "bbox_xyxy": [7, 5, 10, 8],
        },
    ]

    artifacts, overall, per_detection = create_analysis_artifacts(
        image_path, str(uuid.uuid4()), detections, depth
    )

    annotated_path = resolve_analysis_image(artifacts["annotated"])
    crop_path = resolve_analysis_image(artifacts["detection_crops"][first_id])
    depth_path = resolve_analysis_image(artifacts["depth_map"])
    assert annotated_path is not None
    assert crop_path is not None
    assert depth_path is not None
    annotated = cv2.imread(str(annotated_path))
    crop = cv2.imread(str(crop_path))
    colored_depth = cv2.imread(str(depth_path))
    assert annotated.shape == image.shape
    assert not np.array_equal(annotated, image)
    assert crop.shape[:2] == (4, 4)
    assert colored_depth.shape == image.shape

    assert overall["valid_pixel_count"] == 79
    assert overall["minimum"] == float(np.nanmin(depth))
    assert overall["maximum"] == 1.0
    assert per_detection[first_id]["depth_analysis"]["near_far_interpretation"].startswith(
        "Relatively farther"
    )
    assert per_detection[second_id]["depth_analysis"]["near_far_interpretation"].startswith(
        "Relatively nearer"
    )
    assert per_detection[second_id]["bbox_dimensions"]["image_area_percentage"] == 11.25
    assert resolve_analysis_image("../source.png") is None


def test_missing_depth_does_not_create_depth_image(tmp_path, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "generated_analysis_dir", str(tmp_path / "outputs"))

    image_path = tmp_path / "source.png"
    assert cv2.imwrite(str(image_path), np.zeros((5, 5, 3), dtype=np.uint8))

    artifacts, overall, per_detection = create_analysis_artifacts(
        image_path, str(uuid.uuid4()), [], None
    )

    assert artifacts["depth_map"] is None
    assert overall["available"] is False
    assert per_detection == {}

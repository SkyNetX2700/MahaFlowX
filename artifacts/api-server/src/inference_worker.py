"""One-shot YOLO inference worker.

The Node API starts this process for each request and passes a base64 image on
stdin. The model is loaded only from the server-side YOLO_MODEL_PATH. There is
intentionally no fallback detector or generated data.
"""

import base64
import json
import os
import sys
from io import BytesIO


def crowd_level(count: int, percentage: float | None) -> str:
    if percentage is not None:
        if percentage <= 40:
            return "Low"
        if percentage <= 70:
            return "Medium"
        return "High"
    if count <= 4:
        return "Low"
    if count <= 14:
        return "Medium"
    return "High"


def main() -> None:
    payload = json.loads(sys.stdin.read())
    model_path = os.environ.get("YOLO_MODEL_PATH", "")
    if not model_path or not os.path.exists(model_path):
        raise RuntimeError("YOLO_MODEL_PATH does not point to a server-side .pt model.")

    from PIL import Image
    from ultralytics import YOLO

    encoded = payload["image_base64"]
    if "," in encoded and encoded.startswith("data:"):
        encoded = encoded.split(",", 1)[1]
    image = Image.open(BytesIO(base64.b64decode(encoded))).convert("RGB")
    model = YOLO(model_path)
    confidence = float(payload.get("confidence", 0.25))
    results = model.predict(source=image, classes=[0], conf=confidence, verbose=False)

    boxes = []
    for result in results:
        if result.boxes is None:
            continue
        xyxy = result.boxes.xyxy.cpu().tolist()
        confidences = result.boxes.conf.cpu().tolist()
        for coordinates, box_confidence in zip(xyxy, confidences):
            boxes.append({
                "x1": round(float(coordinates[0]), 2),
                "y1": round(float(coordinates[1]), 2),
                "x2": round(float(coordinates[2]), 2),
                "y2": round(float(coordinates[3]), 2),
                "confidence": round(float(box_confidence), 4),
            })

    count = len(boxes)
    capacity = float(payload.get("capacity", 0) or 0)
    percentage = min(100, round((count / capacity) * 100, 1)) if capacity > 0 else None
    print(json.dumps({
        "ok": True,
        "count": count,
        "boxes": boxes,
        "crowd_level": crowd_level(count, percentage),
        "crowd_percentage": percentage,
        "thresholds": {"low": "0–40%", "medium": "41–70%", "high": "71–100%"},
        "model": os.environ.get("YOLO_MODEL_NAME", "YOLO26n"),
    }))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"ok": False, "error": str(error)}))
        sys.exit(1)
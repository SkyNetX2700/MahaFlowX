---
name: YOLO inference runtime
description: Server-side model and Python runtime constraints for MahaFlow crowd detection.
---

The crowd detector must fail explicitly when the server-side YOLO `.pt` model or Python inference dependency is unavailable; it must never return simulated people counts.

**Why:** The project promises that crowd values come from real CCTV frames and a real YOLO26n model, and the current repository does not include a model artifact.

**How to apply:** Keep model files out of the frontend and version-control defaults, configure `YOLO_MODEL_PATH` on the API server, and treat the health endpoint's degraded state as an actionable setup warning.
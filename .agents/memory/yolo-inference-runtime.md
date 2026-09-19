---
name: YOLO inference runtime
description: Server-side model and Python runtime constraints for MahaFlow crowd detection.
---

The crowd detector must fail explicitly when the server-side YOLO `.pt` model or Python inference dependency is unavailable; it must never return simulated people counts. In this workspace, the package resolver can install FastAPI/OpenCV but cannot resolve Ultralytics for Linux, so live inference belongs in the separately deployed FastAPI runtime defined by `requirements-fastapi.txt`.

**Why:** The project promises that crowd values come from real CCTV frames and a real YOLO26n model, and the current repository does not include a model artifact.

**How to apply:** Keep model files out of the frontend and version-control defaults, configure `YOLO_MODEL_PATH` on the API server, and treat the health endpoint's degraded state as an actionable setup warning. Keep the web app connected through `VITE_CCTV_BACKEND_URL` or the API proxy only after that service reports the model as configured.
import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.post("/cctv", async (request, response) => {
  const backendUrl = process.env["YOLO_FASTAPI_URL"]?.replace(/\/$/, "");
  if (!backendUrl) {
    response.status(503).json({
      detail: "The FastAPI CCTV backend is not connected. Set VITE_CCTV_BACKEND_URL in the frontend or YOLO_FASTAPI_URL on the API server.",
      backend_configured: false,
    });
    return;
  }
  try {
    const upstream = await fetch(`${backendUrl}/cctv`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(typeof request.headers.authorization === "string" ? { authorization: request.headers.authorization } : {}),
      },
      body: JSON.stringify(request.body),
    });
    const text = await upstream.text();
    response.status(upstream.status).type("application/json").send(text);
  } catch (error) {
    request.log.error({ err: error }, "FastAPI CCTV proxy failed");
    response.status(502).json({ detail: "The FastAPI CCTV backend could not be reached.", backend_configured: true });
  }
});

export default router;
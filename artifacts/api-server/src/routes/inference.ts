import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { Router, type IRouter } from "express";

type DetectionRequest = {
  image_base64?: unknown;
  capacity?: unknown;
  confidence?: unknown;
};

type WorkerResponse = {
  ok?: boolean;
  error?: string;
  count?: number;
  boxes?: Array<{ x1: number; y1: number; x2: number; y2: number; confidence: number }>;
  crowd_level?: "Low" | "Medium" | "High";
  crowd_percentage?: number | null;
  thresholds?: { low: string; medium: string; high: string };
  model?: string;
};

const router: IRouter = Router();
const defaultModelPath = path.resolve(process.cwd(), "artifacts/api-server/models/YOLO26n.pt");
const defaultWorkerPath = path.resolve(process.cwd(), "artifacts/api-server/src/inference_worker.py");
const projectPythonPath = path.resolve(process.cwd(), ".pythonlibs/bin/python");

const modelPath = () => process.env["YOLO_MODEL_PATH"] || defaultModelPath;
const workerPath = () => process.env["YOLO_WORKER_SCRIPT"] || defaultWorkerPath;
const pythonCommand = () => process.env["YOLO_PYTHON"] || (existsSync(projectPythonPath) ? projectPythonPath : "python3");

const runWorker = (payload: { image_base64: string; capacity?: number; confidence?: number }) => new Promise<WorkerResponse>((resolve, reject) => {
  const child = spawn(pythonCommand(), [workerPath()], {
    env: { ...process.env, YOLO_MODEL_PATH: modelPath() },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", chunk => { stdout += String(chunk); });
  child.stderr.on("data", chunk => { stderr += String(chunk); });
  child.on("error", error => reject(error));
  child.on("close", code => {
    if (code !== 0) {
      reject(new Error(stderr.trim() || `YOLO worker exited with code ${code ?? "unknown"}`));
      return;
    }
    try {
      const result = JSON.parse(stdout) as WorkerResponse;
      if (result.ok === false) reject(new Error(result.error || "YOLO inference failed."));
      else resolve(result);
    } catch {
      reject(new Error(stderr.trim() || "YOLO worker returned an invalid response."));
    }
  });
  child.stdin.write(JSON.stringify(payload));
  child.stdin.end();
});

router.get("/health", (_req, res) => {
  const configured = existsSync(modelPath());
  res.status(configured ? 200 : 503).json({
    status: configured ? "ok" : "degraded",
    inference: "yolo",
    model_configured: configured,
    model_name: process.env["YOLO_MODEL_NAME"] || "YOLO26n",
  });
});

router.post("/detect", async (req, res) => {
  const body = req.body as DetectionRequest;
  const imageBase64 = typeof body?.image_base64 === "string" ? body.image_base64 : "";
  if (!imageBase64) {
    res.status(400).json({ detail: "image_base64 is required. Send a real CCTV frame or image." });
    return;
  }
  if (!existsSync(modelPath())) {
    res.status(503).json({
      detail: "YOLO model is not configured on the server. Add a .pt file and set YOLO_MODEL_PATH.",
      model_configured: false,
    });
    return;
  }
  const capacity = Number(body.capacity);
  const confidence = Number(body.confidence);
  try {
    const result = await runWorker({
      image_base64: imageBase64,
      ...(Number.isFinite(capacity) && capacity > 0 ? { capacity } : {}),
      ...(Number.isFinite(confidence) && confidence > 0 && confidence < 1 ? { confidence } : {}),
    });
    res.json(result);
  } catch (error) {
    req.log.error({ err: error }, "YOLO inference failed");
    res.status(502).json({ detail: error instanceof Error ? error.message : "YOLO inference failed." });
  }
});

export default router;
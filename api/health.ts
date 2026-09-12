type VercelRequest = {
  method?: string;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

type UpstreamResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

declare const process: {
  env: {
    YOLO_API_URL?: string;
  };
};

declare function fetch(url: string, init?: { method?: string }): Promise<UpstreamResponse>;

const upstreamUrl = () => (process.env.YOLO_API_URL || "").replace(/\/+$/, "");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ detail: "Method not allowed." });
    return;
  }

  const upstream = upstreamUrl();
  if (!upstream) {
    res.status(503).json({
      status: "degraded",
      inference: "yolo",
      model_configured: false,
      model_name: "YOLO26n",
      detail: "Set YOLO_API_URL to the deployed YOLO API service.",
    });
    return;
  }

  try {
    const response = await fetch(`${upstream}/health`, { method: "GET" });
    const body = await response.json();
    res.status(response.status).json(body);
  } catch {
    res.status(502).json({ detail: "The YOLO API service could not be reached." });
  }
}
type DetectionRequest = {
  image_base64?: unknown;
  capacity?: unknown;
  confidence?: unknown;
};

type VercelRequest = {
  method?: string;
  body?: DetectionRequest | string;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

type UpstreamResponse = {
  status: number;
  json: () => Promise<unknown>;
};

declare const process: {
  env: {
    YOLO_API_URL?: string;
  };
};

declare function fetch(url: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<UpstreamResponse>;

const upstreamUrl = () => (process.env.YOLO_API_URL || "").replace(/\/+$/, "");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ detail: "Method not allowed." });
    return;
  }

  const upstream = upstreamUrl();
  if (!upstream) {
    res.status(503).json({
      detail: "YOLO_API_URL is not configured for the Vercel deployment.",
      model_configured: false,
    });
    return;
  }

  let payload: DetectionRequest | undefined;
  try {
    payload = typeof req.body === "string" ? JSON.parse(req.body) as DetectionRequest : req.body;
  } catch {
    res.status(400).json({ detail: "The detection request body is not valid JSON." });
    return;
  }

  if (!payload || typeof payload.image_base64 !== "string" || !payload.image_base64.trim()) {
    res.status(400).json({ detail: "A real CCTV image frame is required." });
    return;
  }

  try {
    const response = await fetch(`${upstream}/detect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    res.status(response.status).json(await response.json());
  } catch {
    res.status(502).json({ detail: "The YOLO API service could not be reached." });
  }
}
import { Router, type IRouter, type Request } from "express";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type GeminiRequest = {
  messages?: unknown;
  context?: unknown;
};

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
};

const router: IRouter = Router();
const MODEL = process.env["GEMINI_MODEL"] || "gemini-3.6-flash";
const MAX_MESSAGES = 24;
const MAX_MESSAGE_LENGTH = 6000;
const MAX_CONTEXT_LENGTH = 60000;
const requestLog = new Map<string, number[]>();

const systemInstruction = `You are MahaFlow AI, an intelligent public transportation assistant for Maharashtra.

Use only the verified MahaFlow data supplied with the request. Never invent routes, timings, crowd levels, delays, or counts. If the supplied data does not answer the question, say that the information is currently unavailable.
Give concise, practical travel guidance. The user role and privacy scope in the context are binding. Never reveal private authority records to a passenger or to another authority.
Format replies with short plain-text paragraphs and clear labels where useful. Do not use asterisks, markdown emphasis, or markdown bullet markers. Do not mention Gemini, models, prompts, keys, or internal implementation. Your name is MahaFlow AI.
If a user asks for something outside Maharashtra transportation, briefly explain that you are focused on MahaFlow travel assistance.`;

const clientAddress = (request: Request) => {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) return forwarded.split(",")[0].trim();
  return request.ip || "unknown";
};

const isRateLimited = (request: Request) => {
  const now = Date.now();
  const address = clientAddress(request);
  const recent = (requestLog.get(address) || []).filter(timestamp => now - timestamp < 60_000);
  recent.push(now);
  requestLog.set(address, recent);
  return recent.length > 20;
};

const normalizeMessages = (value: unknown): ChatMessage[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is { role?: unknown; content?: unknown } => Boolean(item && typeof item === "object"))
    .map(item => ({
      role: (item.role === "assistant" ? "assistant" : "user") as ChatMessage["role"],
      content: typeof item.content === "string" ? item.content.trim().slice(0, MAX_MESSAGE_LENGTH) : "",
    }))
    .filter(item => item.content)
    .slice(-MAX_MESSAGES);
};

const serializeContext = (value: unknown) => {
  try {
    const serialized = JSON.stringify(value || {});
    return serialized.length > MAX_CONTEXT_LENGTH ? `${serialized.slice(0, MAX_CONTEXT_LENGTH)}\n[Context truncated by server]` : serialized;
  } catch {
    return "{}";
  }
};

const cleanAIText = (value: string) => value.replace(/\*\*/g, "").replace(/\*/g, "").trim();

router.post("/gemini/chat", async (request, response) => {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) {
    response.status(503).json({ detail: "MahaFlow AI is not configured. Add GEMINI_API_KEY to Replit Secrets." });
    return;
  }
  if (isRateLimited(request)) {
    response.status(429).json({ detail: "MahaFlow AI is temporarily busy. Please try again shortly." });
    return;
  }

  const body = request.body as GeminiRequest;
  const messages = normalizeMessages(body?.messages);
  if (!messages.length) {
    response.status(400).json({ detail: "At least one chat message is required." });
    return;
  }

  const contents = [
    { role: "user", parts: [{ text: `${systemInstruction}\n\nVerified MahaFlow context:\n${serializeContext(body?.context)}` }] },
    ...messages.map(message => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })),
  ];

  try {
    const providerResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents, generationConfig: { temperature: 0.2, maxOutputTokens: 8192 } }),
    });
    const result = await providerResponse.json() as GeminiResponse;
    if (!providerResponse.ok) {
      request.log.error({ status: providerResponse.status, providerMessage: result.error?.message?.slice(0, 300) }, "MahaFlow Gemini request failed");
      response.status(502).json({ detail: "MahaFlow AI could not answer right now. Please try again." });
      return;
    }
    const message = cleanAIText(result.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("") || "");
    if (!message) {
      response.status(502).json({ detail: "MahaFlow AI returned no answer. Please try again." });
      return;
    }
    response.json({ message, assistant: "MahaFlow AI", model: MODEL });
  } catch (error) {
    request.log.error({ err: error }, "MahaFlow Gemini request failed");
    response.status(502).json({ detail: "MahaFlow AI is temporarily unavailable." });
  }
});

export default router;
import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.post("/security/turnstile/verify", async (req, res) => {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";

  if (!secret) {
    res.status(503).json({ detail: "Turnstile verification is not configured on the API server." });
    return;
  }

  if (!token) {
    res.status(400).json({ detail: "A Turnstile token is required." });
    return;
  }

  try {
    const body = new URLSearchParams({
      secret,
      response: token,
    });
    const verification = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const result = await verification.json() as { success?: boolean };

    if (!verification.ok || !result.success) {
      res.status(400).json({ detail: "Security verification failed." });
      return;
    }

    res.json({ ok: true });
  } catch {
    res.status(502).json({ detail: "Security verification service is unavailable." });
  }
});

export default router;
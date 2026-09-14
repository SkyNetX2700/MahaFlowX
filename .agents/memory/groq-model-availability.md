---
name: Groq model availability
description: Groq model IDs can be account-dependent or retired even when they remain in older examples.
---

Treat Groq model IDs as live provider configuration, not permanent constants. Verify the current supported production list when a model returns a provider 404, and keep the default overridable through a secret or environment variable.

**Why:** The commonly documented llama-3.3-70b-versatile ID returned a provider 404 for this account, while openai/gpt-oss-120b worked.

**How to apply:** Keep GROQ_MODEL optional but supported, and verify the default with a real request after adding or rotating GROQ_API_KEY.
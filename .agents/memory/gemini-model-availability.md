---
name: Gemini model availability
description: Direct Gemini API model compatibility for this project
---

The direct Google Gemini API rejected `gemini-2.5-flash` for a newly configured API key and recommended `gemini-3.6-flash`; the MahaFlow backend defaults to the newer model while still allowing `GEMINI_MODEL` to override it.

**Why:** Model availability can differ from current SDK examples and stale integration documentation; a successful key can still return a provider 404 for a retired model.

**How to apply:** When adding or troubleshooting Gemini calls, inspect the sanitized provider error before changing authentication, and prefer a currently advertised model rather than exposing the provider error to users.
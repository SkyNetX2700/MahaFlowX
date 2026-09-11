---
name: Vercel serverless TypeScript
description: TypeScript constraints for standalone Vercel functions in this workspace.
---

Standalone functions under `api/` are compiled separately from the frontend and may not inherit Node or DOM library typings from the artifact. Keep their runtime declarations self-contained when adding platform globals such as `process` or `fetch`.

**Why:** The Vercel build can pass the Vite frontend build and still fail while compiling an API function if the root TypeScript configuration only includes ES libraries.

**How to apply:** Prefer small local declarations or a dedicated function tsconfig over relying on frontend typings; validate the individual function with an ES-only TypeScript check before publishing.
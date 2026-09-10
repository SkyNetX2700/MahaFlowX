---
name: Imported repository handoff
description: Where source files from a conversation import are preserved after moving into a project
---

After a repository import is moved into a persistent project, the source snapshot is preserved under `.local/conversation-workspace/files` rather than automatically replacing the project scaffold root.

**Why:** The handoff keeps imported files isolated from the generated project structure and avoids accidental overwrites.

**How to apply:** Before making development changes after an import, inspect this directory and intentionally copy or adapt the repository files into the target artifact structure.
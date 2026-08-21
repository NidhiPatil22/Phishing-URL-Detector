---
name: API contract compatibility
description: OpenAPI generation constraints for this workspace's current Zod version.
---

The generated Zod client currently targets Zod 3 APIs, so avoid OpenAPI formats or integer mappings that generate newer-only helpers such as `z.email()` or `z.int()`.

**Why:** Codegen succeeds before the chained library typecheck, which makes incompatible generated helpers easy to miss.

**How to apply:** Keep generated schemas compatible with the installed Zod version, then run the full codegen command before consuming new hooks.
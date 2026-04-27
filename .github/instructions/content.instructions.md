---
description: "Use when creating or editing knowledge-base Markdown under content/. Covers content-only verification, wikilinks, metadata, indexes, and llms.txt."
applyTo: "content/**/*.md"
---

# Content Authoring Guardrails

- Treat `AGENTS.md` as the source of truth before creating or significantly editing notes.
- For content-only changes under `content/`, the required verification is `npm run lint:wikilinks`.
- Do not run `npm run check`, `npm test`, or Quartz builds for content-only edits unless the user asks, a workflow/config file changed, or the edit touches code outside `content/`.
- Keep changes scoped to `content/` plus required discovery surfaces: nearest `index.md`, area `index.md`, `content/index.md` for new areas, and `quartz/static/llms.txt`.
- Preserve the frontmatter contract: `title`, `aliases`, `tags`, `area`, `status`, `related`, `source` when applicable, and `unrelated` only for considered discoverability opt-outs.
- Maintain bidirectional `related:` links and first-mention body wikilinks. Do not add orphan notes.
- When adding or removing indexed notes, update the relevant MOC and `quartz/static/llms.txt`.
- If editing `AGENTS.md`, mirror it to `.github/copilot-instructions.md` and run `npm run lint:wikilinks`.

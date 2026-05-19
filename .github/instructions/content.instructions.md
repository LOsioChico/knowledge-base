---
description: "Use when creating or editing knowledge-base Markdown under content/. Covers content-only verification, wikilinks, metadata, and indexes."
applyTo: "content/**/*.md"
---

# Content Authoring Guardrails

- Treat `AGENTS.md` as the source of truth before creating or significantly editing notes.
- For `content/` edits, run `bun run lint:wikilinks` (full vault) or `bun run vault:check --base HEAD~1` (diff-scoped + triage audit when `CURSOR_API_KEY` is set).
- For `sites/docs/` (Starlight MDX), load `kb-starlight-author` and run `bun run lint:docs` and `bun run docs:build`. `vault:check` runs `lint:docs` only when `sites/docs/` appears in `git diff` (tracked files).
- Before push, match CI: `bun run lint:ci` (install deps under `scripts/audit-notes` and `sites/docs` first). See `docs/PIPELINE.md`.
- Do not run Quartz builds for content-only edits unless the user asks or you changed deploy/migration tooling.
- Keep changes scoped to `content/` plus required discovery surfaces: nearest `index.md`, area `index.md`, and `content/index.md` for new areas.
- Preserve the frontmatter contract: `title`, `aliases`, `tags`, `area`, `status`, `related`, `source` when applicable, and `unrelated` only for considered discoverability opt-outs.
- Maintain bidirectional `related:` links and first-mention body wikilinks. Do not add orphan notes.
- Keep verification/provenance notes out of reader-facing prose. Use `source:` and natural inline links; avoid phrases like "verified in", "checked against", "list verified against", raw repo paths, or approximate line-number notes unless the path is itself the subject.
- For NestJS HTTP content, keep examples Express-first. Mention Fastify only where the adapter changes the implementation, usually as a gotcha or explicit adapter note.
- When adding or removing indexed notes, update the relevant MOC.
- Mark open review items inline with a collapsed `> [!todo]-` callout (see `AGENTS.md` → "Open review items in notes"). One actionable sentence per callout, greppable via `grep -rn "\[!todo\]" content/`.
- If editing `AGENTS.md`, mirror it to `.github/copilot-instructions.md` and run `bun run lint:wikilinks`.

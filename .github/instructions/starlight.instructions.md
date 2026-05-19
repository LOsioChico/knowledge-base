---
description: "Use when creating or editing Starlight MDX under sites/docs/."
applyTo: "sites/docs/**/*.mdx"
---

# Starlight MDX

- Load **kb-author** → Workflow 3 + audits **S1–S6** (`.github/skills/kb-author/SKILL.md`, `audits/S*.md`).
- Read `docs/PUBLISHING.md` before authoring a page.
- Re-author for readers; vault paste fails audit S1.
- Internal links: `[[slug|label]]` in prose; `[label](/knowledge-base/slug/)` in table cells.
- No `https://losiochico.github.io/knowledge-base/...` in MDX (`lint:mdx-link-hygiene --strict`).
- Topics without MDX yet: say "planned" in prose — no dead site URLs.
- After edits: `bun run lint:docs` and `bun run docs:build`.
- New pages: add matching `content/<slug>.md`, update sidebar and area MOC; `bun run lint:publish-parity`.

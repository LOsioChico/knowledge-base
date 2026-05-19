---
description: "Use when editing vault markdown under content/."
applyTo: "content/**/*.md"
---

# Vault markdown (`content/`)

- Load **kb-author** (`.github/skills/kb-author/SKILL.md`) — audits A–P, discovery ritual, sourcing.
- Vault notes are **not** published as HTML. Starlight MDX under `sites/docs/` is the live site.
- Published copy lives in `sites/docs/**/*.mdx`; keep vault facts aligned when MDX changes.
- After vault edits: `bun run lint:wikilinks`; `bun run vault:check --base HEAD~1` when triage is needed.
- Preview vault in Obsidian; preview the site with `bun run docs:dev`.

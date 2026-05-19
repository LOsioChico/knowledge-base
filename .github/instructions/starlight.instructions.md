---
description: "Use when creating or editing Starlight MDX under sites/docs/. Twoslash, wikilinks, migration tracker."
applyTo: "sites/docs/**/*.mdx"
---

# Starlight MDX Guardrails

- Load **kb-starlight-author** (`.github/skills/kb-starlight-author/SKILL.md`) and `docs/STARLIGHT-MIGRATION.md` before authoring.
- Read the vault source note under `content/` when migrating or syncing facts.
- After edits: `bun run lint:docs` and `bun run docs:build` from repo root (install `sites/docs` deps first).
- Before push (with other areas): `bun run lint:ci` matches CI. See `docs/PIPELINE.md`.
- Internal links in prose: `[[effect-ts/quickstart|Quickstart]]`. Cards/JSX: `<a href="/knowledge-base/effect-ts/quickstart/">` (include `/knowledge-base` base).
- Do not use full Quartz URLs for slugs listed as `migrated` in `sites/docs/migration.json`.
- Do not add per-page Twoslash tutorials (`// ^?`, "hover the type"); state types in prose. See `docs/STARLIGHT-FEATURES.md`.
- Update `sites/docs/migration.json` when a note graduates from pending to migrated.
- Vault `content/` remains the Obsidian + audit source until explicitly demoted; edit both when facts change.

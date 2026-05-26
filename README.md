# Knowledge base

Personal knowledge base, deployed to https://losiochico.github.io/knowledge-base (Starlight on GitHub Pages).

> **Step 1: Welcome & Layout**: Introduction to the personal knowledge base repositories structure, folders layout, and local dev server setup. Prerequisite: none; next step: [Step 2: Publishing on Starlight](docs/PUBLISHING.md).

## Layout

- `sites/docs/` — **Published site** (Starlight MDX, Twoslash, sidebar). This is what readers see.
- `scripts/` — Wikilink linter, MDX linters, audit tooling.
- `AGENTS.md` — Operating contract for AI editors.

- `docs/PUBLISHING.md` — How to author MDX. [`docs/PIPELINE.md`](docs/PIPELINE.md) maps CI.

## Preview locally

```bash
cd sites/docs && bun install
bun run docs:dev
```

From repo root: `bun run docs:dev`.

## Lint and audit

```bash
bun install   # root
cd scripts/audit-notes && bun install
cd sites/docs && bun install
bun run lint:ci          # wikilinks + Pass 0 + Starlight + tests
bun run lint:wikilinks   # sites/docs/src/content/docs/ MDX
bun run lint:docs        # Starlight only
bun run docs:build
```

Post-edit on MDX notes (needs `CURSOR_API_KEY` in `.env` for LLM triage):

```bash
bun run vault:check --base HEAD~1
```

Conventions: [`AGENTS.md`](AGENTS.md), [`.github/skills/kb-author/SKILL.md`](.github/skills/kb-author/SKILL.md) (audits A–P, MDX audits S1–S6).

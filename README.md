# Knowledge base

Personal knowledge base, deployed to https://losiochico.github.io/knowledge-base.

## Layout

- `content/` — Obsidian vault (markdown, wikilinks, audit).
- `sites/docs/` — Starlight + MDX publish app (migrated areas; see `sites/docs/README.md`).
- `scripts/` — wikilink linter, content audit, deploy merge helper.
- `AGENTS.md` — operating contract for AI editors.

`docs/` — Starlight migration playbooks and [`docs/PIPELINE.md`](docs/PIPELINE.md) (CI / lint map). CI builds Quartz + Starlight and merges for GitHub Pages (`.github/workflows/deploy.yml`).

## Preview Starlight (migrated pages)

```bash
bun run docs:dev
```

## Preview Quartz (full vault)

Clone the quartz fork somewhere outside this repo, then point it at this `content/`:

```bash
git clone https://github.com/LOsioChico/quartz-fork.git ~/quartz-fork
cd ~/quartz-fork && npm ci
npx quartz build --serve -d <path-to-knowledge-base>/content
```

## Lint and audit

```bash
bun install   # root
cd scripts/audit-notes && bun install
cd sites/docs && bun install
bun run lint:ci          # matches CI (vault + Pass 0 + Starlight)
bun run lint:wikilinks   # vault only
bun run lint:docs        # Starlight only
bun run docs:build       # Twoslash production build
```

Default post-edit quality gate (diff-scoped wikilinks, Pass 0, triage audit,
discoverability hints). Requires `CURSOR_API_KEY` in a repo-root `.env` for the
LLM portion:

```bash
bun run vault:check --base HEAD~1
```

Conventions, sourcing rules, and the full audit triage loop live in
[`AGENTS.md`](AGENTS.md) and [`.github/skills/kb-audit-triage/SKILL.md`](.github/skills/kb-audit-triage/SKILL.md).
Audit pipeline details: [`scripts/audit-notes/README.md`](scripts/audit-notes/README.md).

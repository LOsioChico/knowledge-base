# Knowledge base

Personal knowledge base, deployed to https://losiochico.github.io/knowledge-base.

## Layout

- `content/` — source markdown notes.
- `scripts/` — repository tooling (wikilink linter, content audit).
- `AGENTS.md` — operating contract for AI editors. Read it before touching any note.

The Quartz site generator lives in a separate private repo, `LOsioChico/quartz-fork` (a fork of [jackyzha0/quartz](https://github.com/jackyzha0/quartz)). CI clones it at build time; see `.github/workflows/deploy.yml`. To swap site generators, change that workflow.

## Preview locally

Clone the quartz fork somewhere outside this repo, then point it at this `content/`:

```bash
git clone https://github.com/LOsioChico/quartz-fork.git ~/quartz-fork
cd ~/quartz-fork && npm ci
npx quartz build --serve -d <path-to-knowledge-base>/content
```

## Lint and audit

```bash
bun install   # one-time: wikilink linter + audit-notes deps
bun run lint:wikilinks
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

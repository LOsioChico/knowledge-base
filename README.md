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

## Lint

```bash
bun install        # one-time install of lint tooling
bun run lint:wikilinks
```

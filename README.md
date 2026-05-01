# Knowledge base

Personal knowledge base, deployed to https://losiochico.github.io/knowledge-base.

## Layout

- `content/` — source markdown notes.
- `quartz/` — Quartz v4 vendored as the static site generator (config, framework source, `package.json`).
- `scripts/` — repository tooling (wikilink linter).
- `AGENTS.md` — operating contract for AI editors. Read it before touching any note.

## Build locally

```bash
cd quartz
npm ci
npx quartz build --serve -d ../content
```

## Lint

```bash
cd quartz
npm run lint:wikilinks
```

Quartz upstream: https://github.com/jackyzha0/quartz (MIT).

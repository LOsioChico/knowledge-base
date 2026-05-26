# Starlight docs site

Published knowledge base at https://losiochico.github.io/knowledge-base.

## Commands

```bash
bun install
bun run dev      # local preview
bun run build    # static export to dist/
bun run check    # astro check
```

From repo root: `bun run docs:dev`, `bun run docs:build`, `bun run lint:docs`.

## Authoring

- Playbook: [`docs/PUBLISHING.md`](../../docs/PUBLISHING.md)
- Skill: [`.github/skills/kb-author/SKILL.md`](../../.github/skills/kb-author/SKILL.md) (audits S1–S6)
- Parity check: `bun run lint:publish-parity` (MDX page count health check, repo root)

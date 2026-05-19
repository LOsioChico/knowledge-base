# Scripts

Repo-root tooling for the knowledge base. **Inventory:** [`docs/TOOLING.md`](../docs/TOOLING.md).

| Command | What it runs |
| --- | --- |
| `bun run lint:wikilinks` | Vault wikilink linter (`lint-wikilinks.mjs`) |
| `bun run lint:publish-parity` | Vault ↔ MDX 1:1 (`check-publish-parity.mjs`) |
| `bun run lint:mdx-recipe-context` | Recipe MDX teaching prose before bash (advisory; `--strict` fails orphan/thin only) |
| `bun run lint:docs` | Starlight check + MDX wikilinks + table + link hygiene |
| `bun run lint:ci` | Full CI lint chain (see TOOLING.md) |
| `bun run vault:check` | Publish parity + diff-scoped vault/MDX Pass 0 + optional vault/`mdx-triage` + `lint:docs` |
| `bun run test` / `test:ci` | Root unit tests + `scripts/audit-notes` tests |
| `scripts/check-source-urls.sh` | Manual GitHub blob URL HEAD check |
| `scripts/audit-notes/` | Vault audit (`audit-notes.ts`) + MDX audit (`mdx-audit-notes.ts`) |

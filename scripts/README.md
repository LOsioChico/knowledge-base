# Scripts

Repo-root tooling for the knowledge base. **Inventory:** [`docs/TOOLING.md`](../docs/TOOLING.md).

| Command                           | What it runs                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| `bun run lint:wikilinks`          | Vault wikilink linter (`lint-wikilinks.mjs`)                                              |
| `bun run lint:publish-parity`     | Legacy vault slugs covered by MDX; MDX-only pages allowed (`check-publish-parity.mjs`)    |
| `bun run lint:mdx-recipe-context` | Recipe MDX teaching prose before bash (advisory; `--strict` fails orphan/thin only)       |
| `bun run algomaster:intake`       | Extract authorized AlgoMaster/local exports into Markdown files under `tmp/`              |
| `bun run lint:docs`               | Starlight check + MDX wikilinks + table + link hygiene                                    |
| `bun run lint:ec-titles`          | Code blocks with `// filename` comments that should be `title=` annotations               |
| `bun run lint:mermaid-wikilinks`  | Wikilinks inside Mermaid blocks that render as literal bracket text                        |
| `bun run lint:effect-twoslash`    | Effect-importing code blocks must have twoslash annotation                                 |
| `bun run lint:ci`                 | Full CI lint chain (see TOOLING.md)                                                       |
| `bun run vault:check`             | Publish parity + diff-scoped vault/MDX Pass 0 + optional vault/`mdx-triage` + `lint:docs` |
| `bun run test` / `test:ci`        | Root unit tests + `scripts/audit-notes` tests                                             |
| `scripts/check-source-urls.sh`    | Manual GitHub blob URL HEAD check                                                         |
| `scripts/audit-notes/`            | MDX audit (`mdx-audit-notes.ts`)                                                          |

# What Starlight + MDX adds (vs Quartz vault markdown)

Quartz is a **static site generator for Obsidian vaults**: wikilinks, graph, backlinks, folder MOCs, minimal authoring friction.

Starlight is a **documentation framework on Astro**: opinionated layout, sidebar, search, i18n hooks, and **MDX** (Markdown + React components). This repo uses it for **enriched publish** layers, not as a replacement for Obsidian editing.

## Already in use

| Capability | Package / feature | Role |
| --- | --- | --- |
| Type hovers in code | `expressive-code-twoslash` | `ts twoslash` fences; hovers are implicit (no per-page Twoslash tutorials) |
| Code themes | Starlight `expressiveCode` | GitHub light/dark |
| Layout + nav | `@astrojs/starlight` | Sidebar, TOC, mobile nav, 404 |
| Procedural docs | MDX + Starlight components | `<Steps>`, `<Tabs>`, `<Aside>`, `<CardGrid>` |
| Site search | Pagefind (Starlight default) | Full-text over built HTML |
| Wikilinks in MDX body | `remark-wiki-link` + `src/plugins/remark-wikilinks.mjs` | `[[effect-ts/quickstart\|Quickstart]]` → internal URLs |
| Wikilink CI | `bun run lint:mdx-wikilinks` | Unresolved `[[ ]]` fail lint |
| Link styling (visual) | `rehype-kb-link-classes` + `links.css` | **Internal:** accent solid underline. **External:** muted dashed underline + ↗, new tab |
| Link hygiene lint | `bun run lint:mdx-link-hygiene` | Warns when a Quartz URL targets a **migrated** Starlight slug |
| Package manager | Bun (`sites/docs/bun.lock`) | Matches rest of repo tooling |

## Twoslash authoring

- **Default:** ` ```ts twoslash ` on teaching fences. Readers hover identifiers like on effect.website; do not add sections explaining hovers, `// ^?`, or `// @errors:` on every page.
- **Types in prose:** write the type or channel change in a sentence (`after provide, R is never`) or a short `// E: Foo | Bar` comment in the fence.
- **`// ^?`:** rare; misalignment fails the build. Prefer prose + hovers.
- **`// @errors:`:** canonical demo on `effect-ts/typed-errors.mdx` (wrong `E` assignment). Also use on layer pages for missing-`R` compile errors. Not on quickstarts or indexes.

## MDX-specific (not available in plain `.md`)

- **Embed React** in prose: custom components, small interactive widgets (no WebContainers in scope yet).
- **Composition**: import Starlight components only in MDX; vault `.md` stays Quartz/Obsidian-safe.
- **Per-page frontmatter** (`title`, `description`) for SEO and social cards without vault schema.

## Starlight ecosystem (optional next)

| Plugin / theme | Adds | When to adopt |
| --- | --- | --- |
| [`starlight-links-validator`](https://starlight.astro.build/resources/plugins/#starlight-links-validator) | Broken **markdown** link check at build | After more cross-area links |
| [`starlight-blog`](https://starlight.astro.build/resources/plugins/) | Dated posts / changelog | If you want release notes as a blog |
| [`starlight-theme-obsidian`](https://github.com/Fevol/starlight-theme-obsidian) | Obsidian Publish–like chrome | Visual parity only; not wikilinks |
| `@astrojs/starlight` **sidebar autogenerate** | Less hand-maintained sidebar | When an area is fully migrated |
| **Custom remark** (e.g. glossary, callout transform) | Vault callout → `<Aside>` on import | If you automate vault → MDX |

## Link classes (authoring)

Three kinds of links; pick by **where the page lives**, not by how pretty the URL is.

| Class | Write | Looks like (in prose) |
| --- | --- | --- |
| **Starlight internal** | `[[effect-ts/quickstart\|Quickstart]]` in markdown prose | **Accent solid underline** — stays on this site |
| **Vault / Quartz (unmigrated)** | `https://losiochico.github.io/knowledge-base/nestjs/` | Same as internal (still this KB deploy) |
| **External (sources)** | `https://effect.website/...`, `https://github.com/...` | **Gray dashed underline + ↗** — opens new tab |

Preview any migrated page: internal wikilinks vs `effect.website` / GitHub links should be obvious without hovering.

**Prose:** wikilinks for any slug listed as `migrated` in `sites/docs/migration.json`.

**Cards / JSX:** `<a href="/knowledge-base/effect-ts/foo/">` — wikilinks do not run inside Starlight components. Never bare `/effect-ts/foo/` in `href` (missing `base`).

**Lint:** `lint:mdx-link-hygiene` fails if MDX uses a full Quartz URL for a migrated slug; use `[[slug|label]]` instead. `bun run lint:docs` runs it with `--strict`; CI matches.

**Build:** `rehype-kb-link-classes` adds `kb-link-internal` or `kb-link-external` on every prose `<a>`; `links.css` styles them (see `sites/docs/src/styles/links.css`).

## Wikilinks: what we have vs Quartz

| Feature | Vault + Quartz | Starlight MDX (this repo) |
| --- | --- | --- |
| `[[path\|alias]]` syntax | Yes | Yes (remark plugin in markdown/MDX prose) |
| Resolve at build | Quartz | Yes + `lint:mdx-wikilinks` |
| Backlinks panel | Yes | **Not yet** (needs build-time index + component) |
| Graph view | Yes | **Not yet** (separate visualization or defer) |
| First-mention / `related:` / discoverability | `lint:wikilinks` on `content/` | Still vault-only until MDX is canonical |
| Cross-area link to unmigrated note | Wikilink | Full Quartz URL or sidebar link |

No backticks inside `[[ ]]`. Plain `/effect-ts/foo/` in markdown prose is prefixed by `remark-internal-base-links`.

### Backlinks (future)

Quartz computes inbound links automatically. For Starlight, a practical path:

1. At build time, scan all MDX for `[[...]]` and markdown links → `Map<slug, inbound[]>`.
2. Expose via `getStaticPaths` data or a small `<Backlinks slug={...} />` component.
3. Optionally merge vault `content/` links for dual-publish transition.

Not implemented yet; track in migration work when a note graduates from stub.

## What stays on the vault linter

`bun run lint:wikilinks` still governs `content/`:

- `related:` symmetry, first-mention, discoverability TF-IDF, tagline, agents-mirror, etc.

MDX uses a **narrower** wikilink lint (targets must exist under `sites/docs/src/content/docs/`). When an area is fully migrated, you can extend rules or share resolver code from `doc-slugs.mjs`.

## Bun commands

```bash
bun run docs:dev
bun run lint:ci        # CI lint job (vault + Pass 0 + lint:docs)
bun run lint:docs      # astro check + lint:mdx-wikilinks + lint:mdx-link-hygiene --strict
bun run docs:build
```

CI / deploy map: [`docs/PIPELINE.md`](PIPELINE.md).

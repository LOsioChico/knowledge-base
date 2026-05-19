# Starlight + MDX capabilities

What the **published site** (`sites/docs/`) supports. Vault markdown under `content/` stays Obsidian-safe (wikilinks, callouts, `related:`); it is **not** deployed as HTML. Authoring: [`PUBLISHING.md`](PUBLISHING.md).

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
| Link hygiene lint | `bun run lint:mdx-link-hygiene` | Fails on full-site URLs in MDX when a wikilink should be used |
| Package manager | Bun (`sites/docs/bun.lock`) | Matches rest of repo tooling |

## Twoslash authoring

- **Default:** ` ```ts twoslash ` on teaching fences. Readers hover identifiers like on effect.website; do not add sections explaining hovers, `// ^?`, or `// @errors:` on every page.
- **Types in prose:** write the type or channel change in a sentence (`after provide, R is never`) or a short `// E: Foo | Bar` comment in the fence.
- **`// ^?`:** rare; misalignment fails the build. Prefer prose + hovers.
- **`// @errors:`:** canonical demo on `effect-ts/typed-errors.mdx` (wrong `E` assignment). Also use on layer pages for missing-`R` compile errors. Not on quickstarts or indexes.

## MDX-specific (not available in plain vault `.md`)

- **Embed React** in prose: custom components, small interactive widgets (no WebContainers in scope yet).
- **Composition**: import Starlight components only in MDX; vault `.md` keeps Obsidian callouts and blockquote taglines.
- **Per-page frontmatter** (`title`, `description`) for SEO and social cards without vault schema.

## Starlight ecosystem (optional next)

| Plugin / theme | Adds | When to adopt |
| --- | --- | --- |
| [`starlight-links-validator`](https://starlight.astro.build/resources/plugins/#starlight-links-validator) | Broken **markdown** link check at build | After more cross-area links |
| [`starlight-blog`](https://starlight.astro.build/resources/plugins/) | Dated posts / changelog | If you want release notes as a blog |
| [`starlight-theme-obsidian`](https://github.com/Fevol/starlight-theme-obsidian) | Obsidian Publish–like chrome | Visual parity only; not wikilinks |
| `@astrojs/starlight` **sidebar autogenerate** | Less hand-maintained sidebar | If you want to drop hand-maintained sidebars |
| **Custom remark** (e.g. glossary, callout transform) | Vault callout → `<Aside>` on import | If you automate vault → MDX |

## Link classes (authoring)

Three kinds of links; pick by **whether the topic has MDX on the site**.

| Class | Write | Looks like (in prose) |
| --- | --- | --- |
| **Starlight internal** | `[[effect-ts/quickstart\|Quickstart]]` in markdown prose | **Accent solid underline** — stays on this site |
| **Unpublished topic** | Plain text: "planned" in prose (no wikilink) | No link to a page that does not exist yet |
| **External (sources)** | `https://effect.website/...`, `https://github.com/...` | **Gray dashed underline + ↗** — opens new tab |

Preview any published page: internal wikilinks vs `effect.website` / GitHub links should be obvious without hovering.

**Prose and lists:** wikilinks for any slug that has an `.mdx` under `sites/docs/src/content/docs/`.

**Tables:** do **not** use `[[slug|label]]` inside `| table | rows |` — the alias pipe splits the cell and renders broken `[[slug` text. Use `[label](/knowledge-base/slug/)` instead. `bun run lint:mdx-table-wikilinks` blocks regressions.

**Cards / JSX:** `<a href="/knowledge-base/effect-ts/foo/">` — wikilinks do not run inside Starlight components. Never bare `/effect-ts/foo/` in `href` (missing `base`).

**Lint:** `lint:mdx-link-hygiene --strict` fails on `https://losiochico.github.io/knowledge-base/...` in MDX; use `[[slug|label]]` for live pages. `bun run lint:docs` runs it; CI matches.

**Build:** `rehype-kb-link-classes` adds `kb-link-internal` or `kb-link-external` on every prose `<a>`; `links.css` styles them (see `sites/docs/src/styles/links.css`).

## Wikilinks: vault vs Starlight

| Feature | Vault (`content/`) | Starlight MDX (this repo) |
| --- | --- | --- |
| `[[path\|alias]]` syntax | Yes | Yes (remark plugin in markdown/MDX prose) |
| Resolve at build | N/A (not deployed) | Yes + `lint:mdx-wikilinks` |
| Backlinks panel | Obsidian / local only | **Not yet** (needs build-time index + component) |
| Graph view | Obsidian / local only | **Not yet** (separate visualization or defer) |
| First-mention / `related:` / discoverability | `lint:wikilinks` on `content/` | Vault-only until MDX is canonical for a topic |
| Cross-area link to note without MDX yet | Wikilink in vault | "Planned" in MDX prose; no dead site URLs |

### Backlinks (future)

A practical path for Starlight:

1. At build time, scan all MDX for `[[...]]` and markdown links → `Map<slug, inbound[]>`.
2. Expose via `getStaticPaths` data or a small `<Backlinks slug={...} />` component.
3. Optionally merge vault `content/` links while both surfaces exist.

Not implemented yet.

## What stays on the vault linter

`bun run lint:wikilinks` still governs `content/`:

- Symmetric `related:`, first-mention wikilinks, discoverability (TF-IDF), tagline blockquotes, agents-mirror.
- Does **not** validate MDX under `sites/docs/` — use `bun run lint:docs` instead.

## CI map

See [`PIPELINE.md`](PIPELINE.md). Summary: `lint:ci` on PR + main; `docs:build` on PR + main; GitHub Pages serves `sites/docs/dist/` only.

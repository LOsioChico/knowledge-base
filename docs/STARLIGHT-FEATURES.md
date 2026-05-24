# Starlight + MDX capabilities

> **Step 3: Starlight MDX Features & Capabilities**: Rich component usage (Aside, Steps, Tabs), Mermaid diagrams, and Twoslash compiler integrations for interactive code previews. Prerequisite: [Step 2: Publishing & MDX Authoring](PUBLISHING.md); next step: [Step 4: Script Automation & Tooling](TOOLING.md).

What the **published site** (`sites/docs/`) supports. Vault markdown under `content/` stays Obsidian-safe (wikilinks, callouts, `related:`); it is **not** deployed as HTML. Authoring: [`PUBLISHING.md`](PUBLISHING.md).

## Already in use

| Capability | Package / feature | Role |
| --- | --- | --- |
| Type hovers in code | `expressive-code-twoslash` | `ts twoslash` fences only (Effect-TS); not all TypeScript blocks |
| Mermaid diagrams | `astro-mermaid` + `mermaid` | ` ```mermaid ` fences; integration before Starlight |
| Code themes | Starlight `expressiveCode` | GitHub light/dark |
| Layout + nav | `@astrojs/starlight` | Sidebar, TOC, mobile nav, 404 |
| Favicon | `public/favicon.svg` + `favicon` in `astro.config.mjs` | Open-book mark (indigo); served under site `base` |
| Procedural docs | MDX + Starlight components | `<Steps>`, `<Tabs>`, `<Aside>`, `<CardGrid>` |
| Site search | Pagefind (Starlight default) | Full-text over built HTML |
| Wikilinks in MDX body | `remark-wiki-link` + `src/plugins/remark-wikilinks.mjs` | `[[effect-ts/quickstart\|Quickstart]]` → internal URLs |
| Wikilink CI | `bun run lint:mdx-wikilinks` | Unresolved `[[ ]]` fail lint |
| Link styling (visual) | `rehype-kb-link-classes` + `links.css` | **Internal:** accent solid underline. **External:** muted dashed underline + ↗, new tab |
| Link hygiene lint | `bun run lint:mdx-link-hygiene` | Fails on full-site URLs in MDX when a wikilink should be used |
| Package manager | Bun (`sites/docs/bun.lock`) | Matches rest of repo tooling |
| Knowledge graph | `starlight-site-graph` | Interactive graph visualization of page connections in sidebar |
| Image zoom | `starlight-image-zoom` | Click-to-zoom on documentation images |
| Link validation | `starlight-links-validator` | Build-time broken link + hash anchor check |
| Heading badges | `starlight-heading-badges` | Visual badges on headings via `:badge[text]{variant}` directive syntax |
| Reading progress | Custom `Header.astro` override | Horizontal scroll-progress bar at top of viewport |
| Structured data | Custom `Head.astro` override | JSON-LD `TechArticle` schema injected per page for SEO |
| Prefetch | `prefetch: true` in Astro config | Link prefetching (required by `starlight-site-graph`) |
| Line numbers | `@expressive-code/plugin-line-numbers` | Opt-in per block via `showLineNumbers` |
| Collapsible sections | `@expressive-code/plugin-collapsible-sections` | Collapse boilerplate with `collapse={lines}` |

## Expressive Code block features

All code blocks support these annotations on the opening fence line. Combine freely.

### File title (most common)

Shows a filename tab above the code block. Add to every block representing a real file:

` ```typescript title="cats.controller.ts" `

### Diff markers (ins/del)

Green-highlighted insertions and red deletions. Use when a recipe step builds on previous code:

` ```typescript title="app.module.ts" ins={3-4} del={2} `

Or use inline diff syntax (prefix lines with `+`/`-`):

` ```typescript title="app.module.ts" `  
```
- import { OldModule } from './old.module';
+ import { NewModule } from './new.module';
```

### Line highlighting

Yellow-highlighted lines to draw attention:

` ```typescript {5,8-10} `

### Line numbers

Opt-in per block (globally disabled by `defaultProps: { showLineNumbers: false }`):

` ```typescript showLineNumbers `

### Collapsible sections

Collapse long import blocks or repeated boilerplate:

` ```typescript collapse={1-6, "Imports"} `

### Terminal frames

Bash/sh/zsh blocks auto-render as terminal windows (no `title=` needed):

` ```bash `

## Twoslash authoring

- **Opt-in per fence:** only ` ```ts twoslash ` (or `typescript twoslash`) gets type hovers. Plain ` ```typescript ` / ` ```ts ` is syntax highlighting only.
- **Effect-TS area:** teaching fences use `twoslash` (self-contained snippets + `effect` in `package.json`).
- **NestJS / AWS:** fences stay plain `typescript` / `bash` — snippets are often partial (decorators without full module, shell recipes). Turning on `twoslash` there would fail `docs:build` unless every fence is made a compilable mini-program and Nest/AWS types are added to the docs package.
- **Types in prose:** write the type or channel change in a sentence (`after provide, R is never`) or a short `// E: Foo | Bar` comment in the fence.
- **`// ^?`:** rare; misalignment fails the build. Prefer prose + hovers.
- **`// @errors:`:** canonical demo on `effect-ts/typed-errors.mdx` (wrong `E` assignment). Also use on layer pages for missing-`R` compile errors. Not on quickstarts or indexes.

## Mermaid diagrams

- **Requires** `astro-mermaid` in root `integrations` **before** `starlight()` (see `sites/docs/astro.config.mjs`).
- Author with a fenced ` ```mermaid ` block (flowchart, sequence, etc.). Used on NestJS lifecycle pages and a few AWS notes.
- **Not** the same as Starlight `<Steps>` — mermaid is markdown-only.

## MDX-specific (not available in plain vault `.md`)

- **Embed React** in prose: custom components, small interactive widgets (no WebContainers in scope yet).
- **Composition**: import Starlight components only in MDX; vault `.md` keeps Obsidian callouts and blockquote taglines.
- **Per-page frontmatter** (`title`, `description`) for SEO and social cards without vault schema.

## Custom component overrides

| Override | File | Purpose |
| --- | --- | --- |
| `Head` | `src/components/Head.astro` | Extends default `<Head>` with JSON-LD structured data from frontmatter |
| `Header` | `src/components/Header.astro` | Extends default `<Header>` with a reading progress bar |

Both components render the Starlight default first, then append their enhancement. Guard: `Head.astro` skips JSON-LD on pages without `entry.data` (e.g. 404).

## Starlight ecosystem (optional next)

| Plugin / theme | Adds | When to adopt |
| --- | --- | --- |
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
| Backlinks panel | Obsidian / local only | **Yes** — `remark-backlinks` appends `## Backlinks` on each page |
| Graph view | Obsidian / local only | **Not yet** (separate visualization or defer) |
| First-mention / `related:` / discoverability | `lint:wikilinks` on `content/` | Vault-only until MDX is canonical for a topic |
| Cross-area link to note without MDX yet | Wikilink in vault | "Planned" in MDX prose; no dead site URLs |

### Backlinks

At build time, `src/plugins/build-backlinks.mjs` scans all MDX for `[[wikilinks]]` and
`/knowledge-base/<slug>/` markdown links, then `remark-backlinks.mjs` appends a
`## Backlinks` section (inbound pages only). Vault `content/` links are not merged yet.

## What stays on the vault linter

`bun run lint:wikilinks` still governs `content/`:

- Symmetric `related:`, first-mention wikilinks, discoverability (TF-IDF), tagline blockquotes, agents-mirror.
- Does **not** validate MDX under `sites/docs/` — use `bun run lint:docs` instead.

## CI map

See [`PIPELINE.md`](PIPELINE.md). Summary: `lint:ci` on PR + main; `docs:build` on PR + main; GitHub Pages serves `sites/docs/dist/` only.

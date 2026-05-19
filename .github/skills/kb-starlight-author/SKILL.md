---
name: kb-starlight-author
description: Author or migrate knowledge-base pages to Starlight MDX with Twoslash and enrichment components. Use when editing sites/docs/, migrating a vault note to MDX, or adding ts twoslash fences.
---

# kb-starlight-author

Playbook for **published** docs under `sites/docs/`. Vault rules (`kb-author`, wikilinks, audit) still apply to `content/`; this skill covers the Starlight layer.

## Before you write

1. Read `docs/STARLIGHT-MIGRATION.md` and `sites/docs/migration.json` for the note's status.
2. Read the vault source: `content/<area>/<note>.md` end-to-end.
3. Verify technical claims against primary sources (same non-negotiable as AGENTS.md sourcing); cite official URLs in prose.
4. Skim a migrated sibling (e.g. `effect-ts/quickstart.mdx`) for tone and component usage.

## MDX frontmatter

```yaml
---
title: Sentence case title
description: One line for SEO / social cards
---
```

No vault `tags` / `related:` in MDX frontmatter (those stay on vault notes).

## Tagline

First body line: single `>` blockquote, one sentence. Same intent as vault taglines.

## Code fences

- Use **`ts twoslash`** when type information teaches (signatures, error unions, `R` narrowing). Readers discover hovers on their own — same as [effect.website](https://effect.website).
- Each fence must be a **self-contained compilable file** (imports + declarations). Cumulative tutorials: grow one logical file across steps or repeat imports per fence.
- **State types in prose or comments**, not "hover X" instructions. Example: "`main` is `Effect<unknown, never, never>` after `catchTag`", or `// E: NetworkError | ParseError` inside the fence.
- **`// ^?` (pinned popup):** avoid. Twoslash already shows hovers; pinning is fragile (misalignment breaks the build) and does not belong on every page. Use only when a type is genuinely unreadable without a frozen popup and you have verified the fence builds.
- **`// @errors: <code>`:** only on pages whose topic is type-level failure (e.g. typed-errors, missing-`R` demos). Do not add meta-sections that teach Twoslash syntax on quickstarts or indexes.
- **Never** put `@errors` or Starlight-only syntax in vault `content/` if Quartz still builds that path unchanged.

## Enrichment (use when it helps, not as decoration)

Import from `@astrojs/starlight/components`:

| Component | Use when |
| --- | --- |
| `<Aside type="note\|caution\|danger">` | A footgun or side fact would interrupt the main flow |
| `<Steps>` | A numbered procedure the reader follows in order (quickstart, recipe) |
| `<Tabs>` / `<TabItem>` | Real alternatives (sync vs async API, Effect vs Nest, pipe vs gen) |
| `<CardGrid>` / `<Card>` | **Area index only** (`effect-ts/index.mdx` MOC). On other pages prefer tables or wikilink lists — the sidebar already lists siblings. |

**Skip** a component when plain headings and prose scan faster (reference tables, short concept sections). One enrichment that clarifies structure beats three that repeat the vault layout.

Forbidden in vault callout vocabulary: do not introduce `[!tip]`, `[!danger]`, etc. in MDX; use Aside types above.

## Links

Three classes (see `docs/STARLIGHT-FEATURES.md` → **Link classes**):

| Class | Syntax |
| --- | --- |
| Starlight internal | `[[effect-ts/quickstart\|Quickstart]]` in markdown prose |
| Vault / Quartz (unmigrated) | `https://losiochico.github.io/knowledge-base/<area>/…` |
| External primary source | `https://effect.website/…`, `https://github.com/…/blob/…` |

- **Cards / JSX:** `<a href="/knowledge-base/effect-ts/quickstart/">` only — not `[[ ]]`, not bare `/effect-ts/…`.
- **Migrated slug:** never link it with a full Quartz URL; `bun run lint:mdx-link-hygiene` warns (use `--strict` in CI when you want hard failures).
- **Reader UX:** in prose, KB links = accent solid underline (`kb-link-internal`); external sources = gray dashed underline + ↗ + new tab (`kb-link-external`). See `sites/docs/src/styles/links.css`.
- **Forbidden:** backticks inside `[[ ]]` (same as vault linter).

## Pending notes

Until fully migrated, use `src/components/MigrationPending.astro` with vault path + Quartz URL. Delete the stub body when the real page ships.

## After editing

```bash
bun run lint:docs      # or bun run lint:ci before push (full CI lint job)
bun run docs:build
```

Pipeline map: `docs/PIPELINE.md`.

Update `sites/docs/migration.json`. Touch vault `related:` / MOC only when the vault note itself changes.

## Quality checklist (per migrated note)

- [ ] Tagline blockquote
- [ ] `ts twoslash` on fences where types teach; no page-level "how to use Twoslash" sections
- [ ] At least one structural enrichment **only if it fits** (Steps, Tabs, CardGrid, Aside)
- [ ] Claims stated in prose or code comments, not "hover the identifier"
- [ ] Internal links use `[[slug|label]]` for migrated siblings
- [ ] `migration.json` status updated

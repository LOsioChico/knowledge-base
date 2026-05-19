# Starlight + MDX migration

Official path from Quartz (`content/**/*.md`) to Astro Starlight (`sites/docs/src/content/docs/**/*.mdx`) with `expressive-code-twoslash`.

## Principles

1. **One note at a time** — no bulk copy. Re-read the vault note, verify claims against primary sources, then author MDX for the published site.
2. **Dual source during migration** — vault markdown stays the Obsidian + audit source; MDX is the enriched publish target. Starlight wins on URL conflicts at deploy time.
3. **Enrich, don't paste** — use `ts twoslash`, `<Steps>`, `<Tabs>`, `<CardGrid>`, and `<Aside>` when they clarify structure; keep vault fences Quartz-safe (no Twoslash-only syntax in vault until Quartz is retired for that area). See **Twoslash authoring** in [`STARLIGHT-FEATURES.md`](STARLIGHT-FEATURES.md): hovers are implicit; avoid per-page `^?` / "hover the type" meta-docs.
4. **Track state** — update `sites/docs/migration.json` when a note moves from `pending` → `migrated`.

## Layout

| Path | Role |
| --- | --- |
| `content/<area>/*.md` | Vault: wikilinks, frontmatter, `bun run lint:wikilinks`, LLM audit |
| `sites/docs/src/content/docs/<area>/*.mdx` | Published: Twoslash, Starlight components |
| `sites/docs/migration.json` | Machine-readable status per note |
| `spikes/starlight-twoslash/` | Historical spike; **canonical app is `sites/docs/`** |

## Per-note workflow

1. Set note to `in_progress` in `migration.json` (optional).
2. Load **kb-starlight-author** skill (`.github/skills/kb-starlight-author/SKILL.md`).
3. Read vault note + area MOC; run primary-source verification for any changed claims.
4. Author `sites/docs/src/content/docs/<area>/<slug>.mdx`:
   - Starlight frontmatter: `title`, `description`.
   - Opening blockquote (tagline).
   - Self-contained `ts twoslash` fences (full compilable files per step).
   - Internal links: `/effect-ts/foo/` (Starlight adds `base`).
5. Remove or replace the `MigrationPending` stub content.
6. Set `status: "migrated"` in `migration.json`.
7. Optionally add a collapsed `[!todo]-` in the vault note: "Canonical publish: sites/docs/…" (until vault is demoted).
8. `bun run lint:docs` and `bun run docs:build`; run `bun run lint:wikilinks` on any touched vault files.
9. Commit when asked.

## CI / deploy

Full map: [`docs/PIPELINE.md`](PIPELINE.md). Summary:

| Event | Jobs |
| --- | --- |
| PR | `lint` (`bun run lint:ci`) + `docs-build` (`bun run docs:build`) |
| push `main` | `lint` → `build` (Quartz + Starlight + merge) → `deploy` |

Merge: `node scripts/merge-pages.mjs quartz/public sites/docs/dist merged-public` (Starlight overlays Quartz on path conflicts).

## Area order (suggested)

| Order | Area | Rationale |
| --- | --- | --- |
| 1 | `effect-ts` | Pilot; spike proven; small area |
| 2 | TBD | NestJS is large; pick a submodule or "fundamentals" slice first |
| 3 | TBD | AWS slim indexes may stay thin MDX |

## Effect-TS status

See `sites/docs/migration.json`. As of migration infra:

- **Migrated:** all notes under `effect-ts/` (see `sites/docs/migration.json`)
- **Next area:** pick a slice of NestJS or AWS when expanding beyond Effect-TS

## Local commands

```bash
bun run docs:dev          # Starlight dev server
bun run lint:ci           # same as CI lint job (install audit-notes + sites/docs deps first)
bun run lint:docs         # Starlight only
bun run docs:build        # production build (Twoslash)
```

Package manager for `sites/docs/` is **Bun** (`bun.lock`). Feature matrix: [`docs/STARLIGHT-FEATURES.md`](STARLIGHT-FEATURES.md).

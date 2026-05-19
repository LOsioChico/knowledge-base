# Skills and scripts (current project model)

**Published site:** Starlight MDX under `sites/docs/src/content/docs/` → GitHub Pages.  
**Legacy vault:** `content/**/*.md` (pre-migration; **do not edit**). Parity + optional vault audit only. **Not** deployed as HTML.  
**Parity:** every vault note except `inbox.md` has a matching `.mdx` (`bun run lint:publish-parity`, in `lint:ci`).

Pipeline map: [`PIPELINE.md`](PIPELINE.md). Authoring: [`PUBLISHING.md`](PUBLISHING.md).

---

## Skills inventory

| Skill | Kind | Scope | When to load |
| --- | --- | --- | --- |
| [`kb-author`](../.github/skills/kb-author/SKILL.md) | Workflow | Vault **A–P** + MDX **S1–S6** | Any note or MDX edit |
| [`kb-research-author`](../.github/skills/kb-research-author/SKILL.md) | Workflow | New topics from external sources → vault (+ MDX publish step) | Research-from-scratch |
| [`kb-audit-triage`](../.github/skills/kb-audit-triage/SKILL.md) | Workflow | Post-write loop on **vault** `content/` | After vault edits; triage JSON |
| [`kb-auditor`](../.github/skills/kb-auditor/SKILL.md) | LLM judge (Pass 1) | **Vault `.md` only** | `audit-notes` profiles `ci` / `triage` / `full` |
| [`kb-mdx-auditor`](../.github/skills/kb-mdx-auditor/SKILL.md) | LLM judge | **Starlight `.mdx` only** | `mdx-audit-notes` profiles `mdx-triage` / `mdx-full` |
| [`kb-show-dont-tell-judge`](../.github/skills/kb-show-dont-tell-judge/SKILL.md) | LLM judge (Pass 1a) | Vault recipes | `full` profile |
| [`kb-source-verifier`](../.github/skills/kb-source-verifier/SKILL.md) | LLM judge (Pass 1b) | Vault `source:` claims | `triage` / `full` |
| [`kb-jargon-judge`](../.github/skills/kb-jargon-judge/SKILL.md) | LLM judge (Pass 1e) | Vault prose | `full` profile |
| [`kb-verifier`](../.github/skills/kb-verifier/SKILL.md) | LLM judge (Pass 2) | Re-check Pass 1 | `full` profile |
| [`kb-fix-proposer`](../.github/skills/kb-fix-proposer/SKILL.md) | LLM judge (Pass 3) | Suggested fixes | `full` profile |

**Removed / do not use:** `kb-starlight-author` (merged into `kb-author` S1–S6). No `migration.json`, no Quartz build, no `merge-pages`.

### Audit procedures (`kb-author/audits/`)

| ID | Vault (`.md`) | MDX (`.mdx`) |
| --- | --- | --- |
| A–P | Yes — wikilinks, callouts, sourcing, etc. | No — use S1–S6 instead |
| S1–S6 | No | Yes — publish bar, enrichment, MDX syntax, CI |

LLM judges reuse vault audit **procedures** via symlink (`kb-auditor/audits` → `kb-author/audits`). Vault judges target `content/**/*.md`; **`kb-mdx-auditor`** targets `sites/docs/**/*.mdx` via `mdx-audit-notes.ts`.

### Gaps (intentional for now)

| Gap | Mitigation today |
| --- | --- |
| MDX em-dash cleanup | `bun run autofix:mdx` then `bun run audit:mdx-ci` (Pass 0 uses same rules as vault) |
| Recipe command dumps (no "why" before bash) | `lint:mdx-recipe-context` (CI advisory) + `recipe-command-context` in `audit:mdx-triage` |
| Backlinks ignore vault-only links | Obsidian graph on `content/` |
| New vault note without MDX | `lint:publish-parity` fails CI |

---

## Root scripts (`scripts/`)

| Script | Command | Scope | Role |
| --- | --- | --- | --- |
| `lint-wikilinks.mjs` | `bun run lint:wikilinks` | `content/**/*.md` | Symmetry, first-mention, discoverability, tagline, agents-mirror |
| `lint-wikilinks-core.mjs` | (library) | — | Shared lint engine |
| `check-publish-parity.mjs` | `bun run lint:publish-parity` | vault ↔ MDX paths | 1:1 slug parity (excludes `inbox.md`) |
| `lint-aws-profile-consistency.mjs` | `bun run lint:aws-profile-consistency` | `aws/**` cross-account recipes | Tables must not use bare `A`/`B` when `account-a`/`account-b` profiles are declared |
| `lint-mdx-recipe-context.mjs` | `bun run lint:mdx-recipe-context` (advisory in CI; `--strict` fails on orphan/thin bash only) | Recipe-shaped MDX (`quickstart`, `recipes/`, cross-account, numbered steps) | Orphan bash after headings; thin prose before shell fences |
| `lint-mdx-wikilinks.mjs` | part of `lint:docs` | `sites/docs/**/*.mdx` | Resolve `[[slug\|label]]` |
| `lint-mdx-table-wikilinks.mjs` | part of `lint:docs` | MDX tables | No `[[\|]]` inside table rows |
| `lint-mdx-link-hygiene.mjs` | part of `lint:docs` | MDX | No full-site URLs for on-site slugs |
| `vault-check.mjs` | `bun run vault:check` | Publish parity + diff-scoped vault + diff-scoped MDX Pass 0 + optional vault/`mdx-triage` + `lint:docs` when `sites/docs/` changed | Post-edit gate; not a full `lint:ci` replacement (skips Prettier, full-vault Pass 0) |
| `vault-check-lib.mjs` | (library) | — | Diff resolution, report builder |
| `check-source-urls.sh` | manual | GitHub blob URLs in vault | HEAD raw URLs (not in CI) |

**Removed:** `merge-pages.mjs`, `check-migration-coverage.mjs`, `migration.json`.

### CI chain (`bun run lint:ci`)

```
lint:wikilinks → lint:publish-parity → lint:aws-profile-consistency → lint:mdx-recipe-context → audit-notes lint:content → lint:mdx-content → lint:format → lint:docs
```

`bun run test:ci` → root `scripts/*.test.mjs` + `scripts/audit-notes` tests.

---

## Audit notes (`scripts/audit-notes/`)

See [`scripts/audit-notes/README.md`](../scripts/audit-notes/README.md).

| Entry | Role |
| --- | --- |
| `audit-notes.ts` | Vault orchestrator; profiles `ci` \| `triage` \| `full` |
| `mdx-audit-notes.ts` | MDX orchestrator; profiles `mdx-ci` \| `mdx-triage` \| `mdx-full` |
| `pass0-all.ts` / `deterministic.ts` | Vault Pass 0 |
| `pass0-mdx-all.ts` / `mdx-deterministic.ts` | MDX Pass 0 (in `lint:ci` via `lint:mdx-content`) |
| `source-verify.ts` + judges | Pass 1b source grounding |
| `anchor-verify.ts`, `fact-ground.ts` | Pass 1c/1d deterministic FP filters |
| `dismissed.json` | Persisted triage suppressions |
| `autofix.ts` | Em-dash/`--` → `:` in prose; sync vault `source:` from inline citations. `bun run autofix:mdx` for Starlight `.mdx` |
| `skip-zones.ts` | Skip MOC pending lists, etc. |

**Vault targets:** `content/**/*.md`. **MDX targets:** `sites/docs/src/content/docs/**/*.mdx`.

---

## Starlight app (`sites/docs/`)

| Command | Role |
| --- | --- |
| `bun run docs:dev` | Local preview |
| `bun run docs:build` | Production static export + Pagefind |
| `astro.config.mjs` | Sidebar, base `/knowledge-base` |
| `src/plugins/remark-wikilinks.mjs` | Build-time wikilink resolution |
| `src/plugins/remark-backlinks.mjs` | Inbound link section per page |

---

## Decision log (revalidation)

| Old assumption | Current status |
| --- | --- |
| Quartz or dual HTML deploy | **Rejected** — Starlight only |
| `migration.json` tracks coverage | **Removed** — `lint:publish-parity` |
| Separate `kb-starlight-author` skill | **Removed** — S1–S6 under `kb-author` |
| LLM audit covers MDX | **Partial** — `audit:mdx-ci` in CI; `audit:mdx-triage` optional locally |
| `vault:check` = vault only | **Rejected** — always runs publish parity and runs `lint:docs` when `sites/docs/` is in diff |
| Research workflow ends at vault commit | **Updated** — add MDX publish phase when note is reader-facing |

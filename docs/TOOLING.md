# Skills and scripts (current project model)

> **Step 4: Script Automation & Tooling**: Local pre-commit guardian (`pre-commit-autofix.ts`), Cursor Living MOC reviewer (`cursor-reviewer.ts`), wikilink linters, and external development helper tools (CodeGraph, OpenSpec, Engram). Prerequisite: [Step 3: Starlight MDX Features & Capabilities](STARLIGHT-FEATURES.md); next step: [Step 5: CI/CD Quality Gates & Deployments](PIPELINE.md).

**Published site:** Starlight MDX under `sites/docs/src/content/docs/` → GitHub Pages.  
**Parity:** All notes are MDX-only under `sites/docs/`; MDX pages are canonical.

Pipeline map: [`PIPELINE.md`](PIPELINE.md). Authoring: [`PUBLISHING.md`](PUBLISHING.md).

---

## Skills inventory

| Skill                                                                           | Kind                | Scope                                                                              | When to load                                         |
| ------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [`kb-author`](../.github/skills/kb-author/SKILL.md)                             | Workflow            | MDX **S1–S6** audits                                                               | Any note or MDX edit                                 |
| [`kb-research-author`](../.github/skills/kb-research-author/SKILL.md)           | Workflow            | New topics from external sources → canonical MDX                                   | Research-from-scratch                                |
| [`kb-algomaster-intake`](../.github/skills/kb-algomaster-intake/SKILL.md)       | Workflow            | Authorized AlgoMaster pages → local Markdown extracts under `tmp/`                 | System-design topic intake                           |
| [`kb-audit-triage`](../.github/skills/kb-audit-triage/SKILL.md)                 | Workflow            | Post-write loop on **Starlight MDX**                                               | After MDX edits; triage JSON                         |
| [`kb-mdx-auditor`](../.github/skills/kb-mdx-auditor/SKILL.md)                   | LLM judge           | **Starlight `.mdx` only**                                                          | `mdx-audit-notes` profiles `mdx-triage` / `mdx-full` |
| [`kb-show-dont-tell-judge`](../.github/skills/kb-show-dont-tell-judge/SKILL.md) | LLM judge (Pass 1a) | MDX recipes                                                                        | `mdx-full` profile                                   |
| [`kb-fix-proposer`](../.github/skills/kb-fix-proposer/SKILL.md)                 | LLM judge (Pass 3)  | Suggested fixes                                                                    | `mdx-full` profile                                   |

**Removed / do not use:** `kb-starlight-author` (merged into `kb-author` S1–S6).

### Audit procedures (`kb-author/audits/`)

| ID    | MDX (`.mdx`)                                  |
| ----- | --------------------------------------------- |
| S1–S6 | Yes — publish bar, enrichment, MDX syntax, CI |

All LLM judges target `sites/docs/src/content/docs/**/*.mdx` via `mdx-audit-notes.ts`.

### Gaps (intentional for now)

| Gap                                         | Mitigation today                                                                         |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| MDX em-dash cleanup                         | `bun run autofix:mdx` then `bun run audit:mdx-ci` (Pass 0 rules)                         |
| Recipe command dumps (no "why" before bash) | `lint:mdx-recipe-context` (CI advisory) + `recipe-command-context` in `audit:mdx-triage` |
| | Backlinks ignore vault-only links           | (No longer applicable: vault removed)                                                    |
| MDX page count drift                        | `lint:publish-parity` fails CI (MDX page count health check)                             |

---

## Root scripts (`scripts/`)

| Script                             | Command                                                                                       | Scope                                                                                                                              | Role                                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `cursor-reviewer.ts`               | `bun run scripts/cursor-reviewer.ts <file> [-w]`                                              | target workspace file                                                                                                              | Indexes evergreen notes/gotchas and matches them to active source file tokens in real-time        |
| `pre-commit-autofix.ts`            | `bun run scripts/pre-commit-autofix.ts [--all] [--dry-run]`                                    | staged `.mdx` files (or all files)                                                                                                 | Pre-commit guardian: auto-resolves imports, first-mention wikilinks, and symmetric related links |
| `lint-wikilinks.mjs`               | `bun run lint:wikilinks`                                                                      | `sites/docs/src/content/docs/**/*.mdx` (fallback)                                                                                  | Symmetry, first-mention, discoverability, tagline, agents-mirror                                  |
| `lint-wikilinks-core.mjs`          | (library)                                                                                     | —                                                                                                                                  | Shared lint engine                                                                                |
| `check-publish-parity.mjs`         | `bun run lint:publish-parity`                                                                 | MDX paths                                                                                                                          | MDX page count health check                                                                       |
| `lint-aws-profile-consistency.mjs` | `bun run lint:aws-profile-consistency`                                                        | `aws/**` cross-account recipes                                                                                                     | Tables must not use bare `A`/`B` when `account-a`/`account-b` profiles are declared               |
| `lint-mdx-recipe-context.mjs`      | `bun run lint:mdx-recipe-context` (advisory in CI; `--strict` fails on orphan/thin bash only) | Recipe-shaped MDX (`quickstart`, `recipes/`, cross-account, numbered steps)                                                        | Orphan bash after headings; thin prose before shell fences                                        |
| `algomaster-intake.mjs`            | `bun run algomaster:intake -- --url <url>` or `--course <lesson-url>`                         | Authorized AlgoMaster/public HTML or local exports                                                                                 | Local Markdown lesson extract under `tmp/`; `--course` fans out via sidebar into per-section dirs |
| `lint-mdx-wikilinks.mjs`           | part of `lint:docs`                                                                           | `sites/docs/**/*.mdx`                                                                                                              | Resolve `[[slug\|label]]`                                                                         |
| `lint-mdx-table-wikilinks.mjs`     | part of `lint:docs`                                                                           | MDX tables                                                                                                                         | No `[[\|]]` inside table rows                                                                     |
| `lint-mdx-link-hygiene.mjs`        | part of `lint:docs`                                                                           | MDX                                                                                                                                | No full-site URLs for on-site slugs                                                               |
| `lint-ec-titles.mjs`               | `bun run lint:ec-titles`                                                                      | `sites/docs/src/content/docs/**/*.mdx`                                                                                             | Code blocks with `// filename` comments that should be `title=`                                   |
| `lint-mermaid-wikilinks.mjs`       | `bun run lint:mermaid-wikilinks`                                                              | `sites/docs/src/content/docs/**/*.mdx`                                                                                             | Wikilinks inside Mermaid blocks that render as literal bracket text                               |
| `lint-effect-twoslash.mjs`         | `bun run lint:effect-twoslash`                                                                | `sites/docs/src/content/docs/**/*.mdx`                                                                                             | Effect-importing `ts`/`typescript` blocks must have `twoslash`                                    |
| `lint-mdx-prerequisite-sequence.mjs` | (part of `lint:ci:tooling`)                                                                 | `sites/docs/src/content/docs/**/*.mdx`                                                                                             | Prerequisite badge ordering matches declared sequence                                             |
| `vault-check.mjs`                  | `bun run vault:check`                                                                         | Publish parity + diff-scoped MDX Pass 0 + optional `mdx-triage` + `lint:docs` when `sites/docs/` changed                           | Post-edit gate; not a full `lint:ci` replacement (skips Prettier, full-vault Pass 0)              |
| `vault-check-lib.mjs`              | (library)                                                                                     | —                                                                                                                                  | Diff resolution, report builder                                                                   |
| `check-source-urls.sh`             | manual                                                                                        | GitHub blob URLs in MDX pages                                                                                                      | HEAD raw URLs (not in CI)                                                                         |

**Removed:** `merge-pages.mjs`, `check-migration-coverage.mjs`, `migration.json`.

### CI chain (`bun run lint:ci`)

```
lint:ci = lint:ci:tooling && lint:docs

lint:ci:tooling = lint:wikilinks → lint:publish-parity → lint:aws-profile-consistency → lint:ec-titles → lint:mermaid-wikilinks → lint:effect-twoslash → lint:mdx-recipe-context → lint:mdx-content → lint:mdx-prerequisite-sequence

(lint:wikilinks scans `sites/docs/src/content/docs/**/*.mdx`; lint:publish-parity is an MDX page count health check)
```

`bun run test:ci` → root `scripts/*.test.mjs` + `scripts/audit-notes` tests.

---

## Git hooks (local setup)

To automate quality control and ensure 100% green compliance on every commit, a pre-commit hook is active under `.git/hooks/pre-commit`.

### How to set up locally:
1. Ensure the hook file `.git/hooks/pre-commit` exists with the following content:
   ```bash
   #!/bin/sh
   # Execute the autofixer
   bun run scripts/pre-commit-autofix.ts
   
   EXIT_CODE=$?
   if [ $EXIT_CODE -ne 0 ]; then
     echo "Git guardian hook encountered errors. Commit aborted."
     exit 1
   fi
   exit 0
   ```
2. Make the hook executable:
   ```bash
   chmod +x .git/hooks/pre-commit
   ```

Every time you stage note files and run `git commit`, the hook will automatically format first-mention wikilinks, inject missing NestJS/RxJS code imports, and update symmetric backlinks in related notes, auto-staging the modifications.

---

## Audit notes (`scripts/audit-notes/`)

See [`scripts/audit-notes/README.md`](../scripts/audit-notes/README.md).

| Entry                                       | Role                                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `mdx-audit-notes.ts`                        | MDX orchestrator; profiles `mdx-ci` \| `mdx-triage` \| `mdx-full`                                                   |
| `pass0-mdx-all.ts` / `mdx-deterministic.ts` | MDX Pass 0 (in `lint:ci` via `lint:mdx-content`)                                                                    |
| `source-verify.ts` + judges                 | Pass 1b source grounding                                                                                            |
| `anchor-verify.ts`, `fact-ground.ts`        | Pass 1c/1d deterministic FP filters                                                                                 |
| `dismissed.json`                            | Persisted triage suppressions                                                                                       |
| `autofix.ts`                                | Em-dash/`--` → `:` in prose; sync `source:` from inline citations. `bun run autofix:mdx` for Starlight `.mdx`       |
| `skip-zones.ts`                             | Skip MOC pending lists, etc.                                                                                        |

**Removed:** `audit-notes.ts` (vault orchestrator), `pass0-all.ts` / `deterministic.ts` (vault Pass 0).

**MDX targets:** `sites/docs/src/content/docs/**/*.mdx`.

---

## Starlight app (`sites/docs/`)

| Command                            | Role                                |
| ---------------------------------- | ----------------------------------- |
| `bun run docs:dev`                 | Local preview                       |
| `bun run docs:build`               | Production static export + Pagefind |
| `astro.config.mjs`                 | Sidebar, base `/knowledge-base`     |
| `src/plugins/remark-wikilinks.mjs` | Build-time wikilink resolution      |
| `src/plugins/remark-backlinks.mjs` | Inbound link section per page       |

---

## Agent tooling (local)

| Tool          | Config                                                                                                                          | Init / refresh                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **CodeGraph** | `.codegraph/config.json` (indexes `scripts/**`, `audit-notes/**`, `sites/docs/src/plugins/**`; excludes MDX prose) | `npx @colbymchenry/codegraph init -i` then `npx @colbymchenry/codegraph index` after config changes |
| **OpenSpec**  | `openspec/config.yaml` (SDD context, lint/test commands, vault read-only policy)                                                | Edit YAML; no build step                                                                            |
| **Engram**    | `.cursor/rules/engram.mdc` (project id `knowledge-base`)                                                                        | MCP `mem_*` tools                                                                                   |

MCP `codegraph` in Cursor should invoke the same `@colbymchenry/codegraph` binary as `npx` (see `~/.cursor/mcp.json`).

---

## Decision log (revalidation)

| Old assumption                         | Current status                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `migration.json` tracks coverage       | **Removed** — `lint:publish-parity` (now MDX page count health check)                        |
| Separate `kb-starlight-author` skill   | **Removed** — S1–S6 under `kb-author`                                                        |
| LLM audit covers MDX                   | **Partial** — `audit:mdx-ci` in CI; `audit:mdx-triage` optional locally                      |
| `vault:check` = vault only             | **Rejected** — always runs publish parity and runs `lint:docs` when `sites/docs/` is in diff |
| Research workflow ends at vault commit | **Updated** — add MDX publish phase when note is reader-facing                               |

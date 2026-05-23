# audit-notes

LLM-driven audit pipeline that verifies knowledge-base notes against the rules
in [`AGENTS.md`](../../AGENTS.md). **Pass 0** (`lint:content`, `lint:format`) runs in CI via
`bun run lint:ci`; LLM passes run locally on demand. Results are surfaced in chat for human
triage and either applied as fixes or recorded in `dismissed.json` for future suppression.

LLM passes use **Composer 2.5 Fast** (`composer-2.5` with `fast: true` in
[`mdx-audit-notes.ts`](./mdx-audit-notes.ts)).

## Setup

```bash
cd scripts/audit-notes
bun install
```

`CURSOR_API_KEY` is required only for **`triage`** and **`full`** profiles (source
verification and other LLM passes). Load it from a repo-root `.env`:

```bash
set -a; source ../../.env; set +a   # from scripts/audit-notes/
```

`ci` never calls the LLM and does not need a key.

## Run

### Profiles (`mdx-ci` | `mdx-triage` | `mdx-full`, default `mdx-triage`)

Starlight pages under `sites/docs/src/content/docs/**/*.mdx`. Orchestrator: [`mdx-audit-notes.ts`](./mdx-audit-notes.ts). Skill: [`kb-mdx-auditor`](../../.github/skills/kb-mdx-auditor/SKILL.md).

| Profile | Passes | In `lint:ci`? | `CURSOR_API_KEY` |
| --- | --- | --- | --- |
| `mdx-ci` (via `lint:mdx-content` / `audit:mdx-ci`) | Pass 0 including em-dash / `--` | **Yes** | not required |
| `mdx-triage` | Structural + LLM `kb-mdx-auditor` (Default) | No | required |
| `mdx-full` | + show-dont-tell + verifier on objective rules | No | required |

Convenience scripts (from `scripts/audit-notes/`):

```bash
bun run audit:mdx-ci                    # deterministic pass-0 checks (CI)
bun run audit:mdx-triage -- --base HEAD~1   # default after MDX edits
bun run audit:mdx-full -- --base HEAD~1     # full audit suite (objective & subjective)
```

### Scope

```bash
# one or more notes (positional args, relative or absolute paths)
bun start --profile=mdx-triage sites/docs/src/content/docs/effect-ts/platform.mdx

# diff-aware: committed + staged + unstaged since a ref
bun start --json --base HEAD~1 --profile=mdx-triage

# explicit paths when the area has no recent diff (smoke-test)
bun start --json --profile=mdx-triage sites/docs/src/content/docs/effect-ts/ecosystem-map.mdx
```

Empty diff exits cleanly (`{ "files": [] }`).

### Repo-root quality gate

From the repository root, **`bun run vault:check`** runs wikilinks (diff-scoped), **`lint:publish-parity`**, Pass 0 on changed files, triage audit, discoverability hints, split suggestions, and **`lint:docs`** when `sites/docs/` changed. See [`AGENTS.md`](../../AGENTS.md), [`docs/TOOLING.md`](../../docs/TOOLING.md), [`docs/PIPELINE.md`](../../docs/PIPELINE.md), and [`.github/skills/kb-audit-triage/SKILL.md`](../../.github/skills/kb-audit-triage/SKILL.md).

```bash
bun run vault:check --base HEAD~1
```

## Other scripts

```bash
bun run lint:mdx-content # Pass 0 only (em-dash, double-hyphen); no LLM
bun run autofix:mdx      # em-dash / `--` in MDX prose → `:`
bun run typecheck        # tsc --noEmit
bun test                 # unit tests + corpus regression (see below)
```

## Pipeline

Passes are **profile-scoped**: `mdx-ci` runs only Pass 0; `mdx-triage` adds source
verification and deterministic FP filters; `mdx-full` adds structural/jargon LLM
passes and fix-proposer.

| Pass | Profile(s) | Cost | What it does |
| --- | --- | --- | --- |
| **0** | mdx-ci, mdx-triage, mdx-full | deterministic | em-dash, double-hyphen, frontmatter schema (`pass0-mdx-all.ts`, `mdx-deterministic.ts`) |
| **0b** | mdx-triage, mdx-full | deterministic | express-first and related Pass-0 extensions |
| **1** | mdx-full | LLM (`kb-auditor`) | code-imports, table-link, express-first, callout vocabulary |
| **1a** | mdx-full | LLM (`kb-show-dont-tell-judge`) | recipes that claim observable behavior without showing it |
| **1b** | mdx-triage, mdx-full | LLM (`kb-source-verifier`, N=3) | claims contradicted by or unsupported by cited sources; majority voting |
| **1c** | mdx-triage, mdx-full | deterministic | anchor-verifier: drops wrong-anchor findings when the symbol is still in the original range |
| **1d** | mdx-triage, mdx-full | deterministic | fact-grounding: drops "Not supported by" when all extracted terms appear in cached sources |
| **1e** | mdx-full | LLM (`kb-jargon-judge`) | undefined acronyms / named features without gloss or wikilink |
| **2** | mdx-full | LLM (`kb-verifier`) | adversarial re-check of Pass 1 findings |
| **3** | mdx-full | LLM (`kb-fix-proposer`) | `suggestedFix` for surviving high-tier findings |

Then `dismissed.json` is applied: findings whose `(path, rule, sha1(line))`
signature was previously triaged are suppressed and logged.

### Skip zones

[`skip-zones.ts`](./skip-zones.ts) marks non-claim regions (MOC `## Pending`
lists, `## See also`, planned wikilinks, etc.) so candidate finders and Pass 1e
do not flag enumeration bullets as jargon. Unit tests: [`skip-zones.test.ts`](./skip-zones.test.ts).

### Corpus regression

[`fixtures/corpus-manifest.json`](./fixtures/corpus-manifest.json) lists vault
paths and lines that must stay silent for specific rules (known FPs, dismissed
patterns). [`corpus-silent.test.ts`](./corpus-silent.test.ts) asserts the
show-dont-tell finder and Pass 0 stay quiet at those coordinates. Run with
`bun test` after changing skip-zones or dismissal patterns.

## Output

Default format prints a tiered report grouped by file:

- **High-tier**: blocking. Includes Pass 0 + verified Pass 1 + source-verification.
- **Advisory**: non-blocking. Includes Pass 1e jargon findings and `Plausible but unsourced`.

With `--json`, the same data is written to stdout as a `TieredReport` (see
[`types.ts`](./types.ts)). High-tier findings may include a
`suggestedFix: {kind, before, after, primarySource, rationale}` from Pass 3.

## Dismissing findings

When a finding has been triaged and rejected (false positive, callout-scope
exclusion, already-cited claim the auditor missed), append an entry to
[`dismissed.json`](./dismissed.json):

```json
{
  "path": "sites/docs/src/content/docs/aws/s3/index.mdx",
  "sig": "<sha1(path + \\0 + rule + \\0 + trimmed line text)>",
  "rule": "source-verification",
  "reason": "verified at parse-date.pipe.ts#L10-L31: ergonomics claim is accurate",
  "date": "2026-05-16",
  "originalLine": "trimmed line text at the time of dismissal"
}
```

Signatures are content-addressed, so dismissals **survive line-number drift but
re-fire when the prose is rewritten**, which is the right time to re-evaluate.

## Source cache

LLM source-verification fetches every cited URL once and caches the extracted
text under `.cache/sources/` for 30 days. Cache key is `sha256(url).slice(0,
24)` (shared between `source-verify.ts` and `fact-ground.ts`). Stale entries
are refetched lazily; nothing prunes the cache automatically. Run
`bun run cache:clean` to remove entries older than 60 days.

## See also

- [`AGENTS.md`](../../AGENTS.md): the rules this pipeline enforces.
- [`.github/skills/kb-audit-triage/SKILL.md`](../../.github/skills/kb-audit-triage/SKILL.md): triage workflow.
- [`check-source-urls.sh`](../check-source-urls.sh): verify GitHub blob URLs in frontmatter resolve.

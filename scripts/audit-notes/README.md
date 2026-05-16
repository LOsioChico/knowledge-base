# audit-notes

LLM-driven audit pipeline that verifies knowledge-base notes against the rules
in [`AGENTS.md`](../../AGENTS.md). Runs locally on demand (no CI integration);
results are surfaced in chat for human triage and either applied as fixes or
recorded in `dismissed.json` for future suppression.

Built on the [Cursor TypeScript SDK](https://cursor.com/blog/typescript-sdk).

## Setup

```bash
cd scripts/audit-notes
yarn install                # or npm install
export CURSOR_API_KEY=...   # from https://cursor.com/dashboard/integrations
```

`CURSOR_API_KEY` is required: every run performs LLM-based source verification
and the script exits non-zero if the key is missing or invalid.

## Run

```bash
# audit one or more notes (positional args)
yarn start ../../content/nestjs/fundamentals/guards.md

# diff-aware: audit only files changed since a git ref (committed + staged + unstaged)
yarn start --base HEAD~1
yarn start --base origin/main

# emit JSON to stdout (for piping into triage tooling)
yarn start --json ../../content/aws/s3/index.md > /tmp/audit.json

# skip Pass 2 verifier (faster local iteration; not recommended for triage)
yarn start --skip-verify ../../content/nestjs/fundamentals/pipes.md
# (`--no-verify` is accepted as a deprecated alias and prints a warning)
```

## Other scripts

```bash
yarn lint:content           # Pass 0 only (deterministic em-dash / double-hyphen checks); no LLM
yarn lint:format            # prettier --check on content/
yarn format                 # prettier --write on content/
yarn autofix                # sync frontmatter `source:` from inline citations; strip orphans
yarn typecheck              # tsc --noEmit
```

## Pipeline

The audit runs seven passes, layered so that cheap deterministic checks gate
expensive LLM work and deterministic ground-truth checks filter LLM false
positives before they reach the human.

| Pass    | Cost                                | What it does                                                                                                                                  |
| ------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **0**   | deterministic                       | em-dash, double-hyphen, frontmatter schema (`pass0-all.ts`, `deterministic.ts`)                                                               |
| **1**   | LLM (`kb-auditor`)                  | code-imports, table-link, express-first, callout vocabulary                                                                                   |
| **1a**  | LLM (`kb-show-dont-tell`)           | recipes that claim observable behavior without showing it                                                                                     |
| **1b**  | LLM (`kb-source-verify`, N=3)       | claims contradicted by or unsupported by cited `source:` URLs; self-consistency voting drops findings without majority                        |
| **1c**  | deterministic                       | anchor-verifier: drops `source-verification` findings whose anchor claim is wrong but the cited symbol IS within the original range           |
| **1d**  | deterministic                       | fact-grounding: drops "Not supported by" findings whose high-information terms ALL appear in the cached source extracts                       |
| **1e**  | LLM (`kb-jargon-judge`)             | undefined acronyms / named features used without inline gloss or wikilink                                                                     |
| **2**   | LLM (`kb-verifier`, adversarial)    | drops Pass 1 findings the verifier cannot independently reproduce                                                                             |
| **3**   | LLM (`kb-fix-proposer`)             | proposes a `suggestedFix` for each surviving high-tier finding                                                                                |

Then `dismissed.json` is applied: findings whose `(path, rule, sha1(line))`
signature has been previously triaged are suppressed and logged.

## Output

Default format prints a tiered report grouped by file:

- **High-tier**: blocking. Includes Pass 0 + verified Pass 1 + source-verification.
- **Advisory**: non-blocking. Includes Pass 1e jargon findings and similar subjective passes.

With `--json`, the same data is written to stdout as a `TieredReport` (see
[`types.ts`](./types.ts) for the schema). High-tier findings may include a
`suggestedFix: {kind, before, after, primarySource, rationale}` from Pass 3.

## Dismissing findings

When a finding has been triaged and rejected (false positive, callout-scope
exclusion, already-cited claim the auditor missed), append an entry to
[`dismissed.json`](./dismissed.json):

```json
{
  "path": "content/aws/s3/index.md",
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
`yarn cache:clean` to remove entries older than 60 days.

## See also

- [`AGENTS.md`](../../AGENTS.md): the rules this pipeline enforces.
- [`.github/skills/kb-audit-triage/SKILL.md`](../../.github/skills/kb-audit-triage/SKILL.md): triage workflow.
- [`check-source-urls.sh`](../check-source-urls.sh): verify GitHub blob URLs in frontmatter resolve.

# Audit Pipeline Reference

> Extracted from AGENTS.md. This file contains the full audit workflow, profiles, and triage procedures. For the universal invariants, see [AGENTS.md](../AGENTS.md).

## When you finish

- To preview the **published site**: `bun run docs:dev` (or `cd sites/docs && bun run dev`). Production build: `bun run docs:build`. CI: `bun run lint:ci` (full wikilinks + publish parity + Pass 0 + format + `lint:docs`). Pipeline map: `docs/PIPELINE.md`.
- **MDX links:** `[[slug|label]]` in prose and lists; **never** `[[slug|label]]` inside markdown table rows (the `|` breaks columns). In tables use `[label](/knowledge-base/slug/)`. See `docs/STARLIGHT-FEATURES.md`. Enforced by `bun run lint:mdx-table-wikilinks`.
- **Default post-edit quality gate** (from repo root; full wikilinks, diff-scoped Pass 0 on changed files, triage audit, discoverability and split suggestions). `vault:check` runs `lint:docs` when `sites/docs/` is in the diff; otherwise run `bun run lint:docs` after MDX edits. The LLM portion needs `CURSOR_API_KEY` in a repo-root `.env` (gitignored):

  ```bash
  bun run vault:check --base HEAD~1
  ```

  Linter-only (no LLM audit), matches CI lint job: `bun run lint:ci` (full wikilinks + publish parity + Pass 0 + format + `lint:docs`). Install deps under `scripts/audit-notes` and `sites/docs` first. If formatting fails, run `bun run format` in `scripts/audit-notes/`. Prettier ignores the top-level docs (`AGENTS.md`, `CLAUDE.md`, `README.md`); see `.prettierignore`. `vault:check` is not a full `lint:ci` replacement: it scopes wikilink and Pass 0 output to changed files and does not run Prettier. Forbidden: committing after running only a subset (e.g. wikilinks without `lint:docs` after MDX edits). If a commit slips through with a lint failure, the next commit fixes it; do not chain more content edits on top of a red CI.

## Corpus regression testing

(after changing `skip-zones.ts`, `dismissed.json` patterns, or `fixtures/corpus-manifest.json`): `cd scripts/audit-notes && bun test`. Skip-zone rules live in [`skip-zones.ts`](../scripts/audit-notes/skip-zones.ts); the manifest lists paths/lines that must stay silent for specific rules ([`corpus-silent.test.ts`](../scripts/audit-notes/corpus-silent.test.ts)).

## Frontmatter `source:` auto-maintenance

**Frontmatter `source:` is auto-maintained** by the linter rule `source-list-completeness` (BLOCKING) plus `bun run autofix` (in `scripts/audit-notes/`). The contract is bidirectional: every URL in `source:` must appear somewhere in the body, and every inline primary-source URL must appear in `source:` (the existing `inline-source-citations` rule). Workflow: cite primary sources **inline** in prose with the precise anchor (`#L<m>-L<n>` or `#section`); run `bun run autofix` (no args walks `sites/docs/src/content/docs/`) and it strips any `source:` URL not referenced in the body. Forbidden: editing `source:` by hand to satisfy an audit finding. Adding a URL to `source:` that does not appear inline is a phantom citation: the linter catches it at commit time, the autofixer strips it, and the underlying claim still has no reader-visible source. The single source of truth for which URLs back a note is the inline citations.

## Source URL verification script

After editing any `source:` frontmatter or adding inline citations to GitHub blob URLs, run `scripts/check-source-urls.sh` from the repo root. It HEADs every `https://github.com/<owner>/<repo>/blob/<ref>/<path>` URL through `raw.githubusercontent.com` and fails on any 404. Local-only (network-dependent, hits GitHub's 60 req/hr unauth limit so unsuited for CI). Forbidden: skipping this after touching frontmatter URLs — typos like `parse-file-pipe-builder.ts` (real path: `parse-file-pipe.builder.ts`) sail past every other lint and only surface as silent gaps in the LLM audit's source verification.

## Diff-aware audit workflow

Commit only when explicitly asked. Do NOT push: pushing is the user's call.

After committing any change under `sites/docs/src/content/docs/`, run the audit on touched files and surface findings in chat for triage. **Default post-edit workflow** (diff-aware, no full-scan cost):

```bash
set -a; source .env; set +a   # loads CURSOR_API_KEY (gitignored)
cd scripts/audit-notes
bun start --json --base HEAD~1 --profile=triage > /tmp/audit.json 2> /tmp/audit.err
```

Diff-aware: `--base <ref>` audits MDX pages under `sites/docs/src/content/docs/` changed since `<ref>` (committed + staged + unstaged). Examples: `--base HEAD~1` (last commit), `--base origin/main` (branch delta). Empty diff exits clean.

Full re-audit: `set -a; source .env; set +a; find sites/docs/src/content/docs -name "*.mdx" | xargs npx tsx scripts/audit-notes/mdx-audit-notes.ts --profile=mdx-triage`

## Audit profiles

(`--profile=ci|triage|full`, default `full` for backward compat):

| Profile | Passes | `CURSOR_API_KEY` |
| --- | --- | --- |
| `ci` | Pass 0 only (same scope as `lint:content` / `pass0-all.ts`) | not required |
| `triage` | Pass 0 + 0b + 1b + 1c + 1d + source grounding + dismissed filter | required |
| `full` | All passes (1, 1a, 1e, 2, 3) | required |

## Convenience scripts

(from `scripts/audit-notes/`): `bun run audit:mdx-ci`, `bun run audit:mdx-triage`. Explicit paths still work: `npx tsx scripts/audit-notes/mdx-audit-notes.ts --profile=mdx-triage sites/docs/src/content/docs/<path>.mdx`.

## Pass 1c: anchor verifier

`mdx-triage` and `mdx-full` exit non-zero if `CURSOR_API_KEY` is missing or invalid. `mdx-ci` never calls the LLM. A deterministic **Pass 1c (anchor verifier)** runs after source verification: for any `source-verification` finding whose complaint is "wrong GitHub line anchor" (`L<m>-L<n>` claim), it fetches the cited file and checks whether the symbol named in the note's link text is actually defined within the original anchor's range. If yes, the finding is dropped automatically as a false positive (logged as `[pass-1c] anchor-verifier dropped N false-positive(s)`). This catches the most common LLM hallucination empirically (~50% FP rate on anchor claims) before it reaches human triage.

## Pass 1d: fact-grounding

A second deterministic **Pass 1d (fact-grounding)** runs after Pass 1c: for any finding emitted as `Not supported by cited sources: ...`, it extracts high-information terms from the claim (backtick-fenced spans, identifiers, version numbers) and substring-greps them across the on-disk cache of source extracts. If ALL terms appear in at least one cached source body, the LLM missed the supporting text and the finding is dropped (logged as `[pass-1d] fact-grounding dropped N false-positive(s)`). Conservative: never touches `Contradicts` findings, never touches `Plausible but unsourced` findings (those are advisory by design — see below), keeps when fewer than 2 terms can be extracted.

Source-verification findings now ship in three flavors: `Contradicts cited sources: ...` (high-tier blocker), `Not supported by cited sources: ...` (high-tier blocker), and `Plausible but unsourced: ... Suggested source: <URL>` (advisory — the action is "add the URL to `source:`", not "rewrite the prose"). Then read `/tmp/audit.json` and triage: deterministic Pass-0 findings (em-dash, double-hyphen) get fixed in the next commit; high-tier LLM findings (including `source-verification`) get reviewed and fixed if valid; advisory findings are dismissable. High-tier findings carry a `suggestedFix: {kind, before, after, primarySource, rationale}` field when Pass 3 (fix-proposer) was able to produce one. The proposer is instructed to obey "Cite, don't hedge" and to decline rather than soften, so when `suggestedFix` is present it's a starting point for the three-gate review; absent fix means the proposer declined and the human writes the fix from scratch. Either way the fix is still a suggestion, still subject to the three-gate test.

## Audit findings are suggestions, not mandates

**Verify EVERY one, treat false positives as the default risk**: every LLM-generated finding (Pass 1, Pass 2, and `suggestedFix` from Pass 3) is a hypothesis about a possible defect, NOT a proven bug. Empirically the false-positive rate on specific-anchor and "claim not supported" findings is high enough that **mechanical application is the single biggest source of regressions in this repo's audit loop**. One concrete batch: 5 of 9 high-tier findings I applied were false positives (`formatPid` real range L417-L419 not L407-L409; `loadSwcCliBinary` real range L198-L200 not L215; `"webpack": true` IS set by `sub-app.factory.ts#L358`; `ParseDatePipe`/`ParseIntPipe` ergonomics IS in `parse-date.pipe.ts#L10-L31`). The cost of a false positive is a deleted specific that took real research to produce; the cost of a missed true positive is one more audit cycle. **Bias HARD toward keeping the original.**

### Required verification workflow

On every finding before applying:

1. Fetch the cited file/range with `curl -s <raw-url> | grep -n '<symbol>'` and `sed -n '<a>,<b>p'` — if the original anchor was correct, RESTORE and ignore the finding; if wrong, replace with the verified correct anchor (NEVER drop to a bare URL).
2. For "claim not supported" findings, check whether the claim is true but the supporting URL isn't cited inline yet — if so, ADD the inline citation `([source](URL))` to the prose and keep the claim (`bun run autofix` will sync `source:`); never edit `source:` by hand.
3. Confirm the fix preserves or adds information (cite-don't-hedge).
4. Confirm the change is worth the diff.

**Dismiss findings that fail any gate without guilt** and without a code-side suppression: the audit will re-flag if the underlying concern recurs, which is the right time to revisit. Forbidden: applying a finding mechanically because it's in the JSON. Forbidden: softening a true claim to a vague one because the auditor (incorrectly) said it wasn't sourced. Required: when applying, log the verification in the commit message or chat ("audit flagged X; verified file Y at L<n>-L<m>; original was correct/wrong; applied as Z") so the next pass over the same file knows it's been triaged.

### Verify findings before classifying as dismissable

**Verify EVERY finding against primary sources before classifying it as dismissable** (same rigor as before applying). Eyeballing a message and concluding "auditor probably hallucinated" or "the cited file probably proves this" is the false-positive analogue of mechanical application: it buries real bugs (one concrete batch: I triaged 14 advisories from "looks plausible" without fetching, and 3 of them — `global-providers.md` testing-override, `exception-filters.md` rethrow-chain, `request-lifecycle.md` rethrow-chain — were actual prose bugs that primary-source verification caught; another 4 needed source-list additions, not dismissals).

Required workflow on every finding before deciding the verdict (same shape as the apply-side workflow, executed earlier in the loop):

1. Fetch the suggested source URL and the URLs already in the note's `source:` list with `curl -sL <raw-url> | grep -niE '<term1>|<term2>'`.
2. Classify into one of four buckets:
   - **TRUE-and-cited** (claim is supported by a URL already in `source:`; auditor extract failed, dismiss with the verifying URL named in the dismissal `reason`)
   - **TRUE-but-uncited-inline** (claim is supported by a URL but never cited inline next to the claim; ADD the inline citation `([source](URL))` to the prose, do NOT dismiss — the audit's job is to make this gap visible; `bun run autofix` keeps `source:` in sync, never edit it by hand)
   - **WRONG-claim** (primary source contradicts the prose; FIX the prose with a citation to the contradicting source)
   - **UNVERIFIABLE** (no usable primary source within the session; leave the advisory in place as a `// TODO: verify` and dismiss with `reason: "no primary source available; revisit"`)
3. Only after one of those four buckets is chosen, take the action.

Forbidden: dismissing in chat triage on the basis of "follows from cited files" without actually grepping the cited files. Forbidden: dismissing on the basis of "auditor extract probably failed" without re-fetching the URL the auditor flagged. Required: every dismissal `reason` field names the file/anchor that was actually checked (e.g. "verified at `provider-scopes.md#L152`: '~5% latency-wise' is the exact wording"), not just "false positive" or "already cited".

## Persisted dismissals

When an advisory or high-tier finding has been triaged and rejected (rule misapplication, already-cited claim the auditor missed, literal-not-hedge phrasing, callout-scope exclusion, etc.) and the underlying line is unlikely to change soon, record it in `scripts/audit-notes/dismissed.json` so future audit runs auto-suppress it. Each entry is `{path, sig, rule, reason, date, originalLine}` where `sig = sha1(path + "\0" + rule + "\0" + trimmed line text)`. The signature is content-addressed: it survives line-number drift but **re-fires when the prose is rewritten**, which is the right time to re-evaluate.

The audit pipeline filters before emitting the final tiered report and logs every suppression as `[dismissed] suppressed N previously-triaged finding(s)` with the original rationale, so the audit trail stays visible. Generate a new entry by running a small node one-liner that reads the line at `path:line`, hashes it, and appends to the JSON (see commit history for the seed batch).

Forbidden: dismissing a finding by silently ignoring it in chat triage when the same finding will obviously re-appear on the next full run — that wastes future-you's triage cycles. Forbidden: dismissing high-tier `Contradicts` findings without a written verification chain in the `reason` field (these are the highest-signal class; if you're dismissing one, the reason needs to explain why the auditor was wrong, not just "false positive"). The dismissal file is checked in so triage state is shared across machines and rebuilds.

---

- If the user asks to push, GitHub Pages rebuilds in 1-2 minutes.
- If you established a new convention, update this file in the same commit.

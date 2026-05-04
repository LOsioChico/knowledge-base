---
name: kb-audit-triage
description: >
  Step-by-step workflow for running the LLM audit pipeline on knowledge-base notes,
  triaging each finding against primary sources, and either applying it as a fix or
  persisting it to `dismissed.json`. Use this skill when the user says "run the audit",
  "audit my last commit", "triage audit findings", "apply audit", "dismiss audit
  finding", or invokes `/kb-audit-triage`. Companion to `kb-author`: kb-author owns
  *writing* notes; this skill owns the *post-write verification loop* powered by
  `scripts/audit-notes/`.
---

# kb-audit-triage

Workflow companion to `scripts/audit-notes/` and the "When you finish" section of
`AGENTS.md`. AGENTS.md owns the invariants (every finding is a hypothesis; cite-don't-hedge;
verify-before-dismissing); this skill owns the **end-to-end loop**: run → classify each
finding → act → persist.

**Always read `AGENTS.md` first.** On conflict it wins.

## When to load

- User asks to: run the audit on touched files, triage audit JSON, apply or dismiss findings,
  add to `dismissed.json`, evaluate audit output.
- After any commit under `content/` (the audit is chat-driven now; CI no longer runs it).
- Whenever Pass-1/Pass-2 LLM output appears in `/tmp/audit.json` and needs human classification.

## The non-negotiables (from AGENTS.md, repeated because they get skipped)

1. **Every finding is a hypothesis, never a verdict.** Empirical FP rate on specific-anchor and
   "claim not supported" findings is ~50% in this repo. Default to KEEPING the original.
2. **Verify against primary sources before BOTH applying AND dismissing.** Eyeball triage
   produces FPs in both directions. The dismissal `reason:` field must name the file/anchor
   that was actually checked, not "false positive" or "follows from cited files".
3. **Every audit-driven edit must ADD information (URL, line anchor, concrete API name) or
   stay the same length.** Edits that subtract information are regressions even when the
   auditor goes green. Hedging ("may apply", "in some cases", "broadly") is forbidden.
4. **Never `git push`.** Commit freely; push is the user's call.

## Step 1 — Run the audit

From repo root. **Default scope is the whole vault** (every `.md` under `content/`); narrow
only when the user asks for "my last commit" or names specific files.

```bash
set -a; source .env; set +a   # loads CURSOR_API_KEY (gitignored)
cd scripts/audit-notes
# Default: full-vault audit. Excludes content/inbox.md — it's a planning queue
# (status: seed, external URLs as bullets, no claims-to-verify); the source /
# show-don't-tell / behavior-in-snippet passes don't apply to it.
yarn start --json $(find ../../content -name '*.md' -not -path '*/inbox.md' | sort) > /tmp/audit.json 2> /tmp/audit.err
```

Variants (use only when the user scopes the request):

- `--base HEAD~1` — only files changed in last commit. Use when the user says "audit my
  last commit" or similar.
- `--base origin/main` — everything since the branch diverged.
- `--base <ref>` — committed + staged + unstaged changes since `<ref>`.
- Explicit paths: `yarn start --json ../../content/<path>.md [more.md ...]` (full re-audit
  of a specific note).
- Bare `yarn start --json` (no args, no `--base`) falls back to a small hardcoded
  `DEFAULT_TARGETS` list inside `audit-notes.ts` — NOT the whole vault. Avoid; pass the
  `find` glob above instead.
- Empty diff exits cleanly (`{ "files": [] }`).

Read `/tmp/audit.json`. Skim `/tmp/audit.err` for `[pass-1c] anchor-verifier dropped N`,
`[pass-1d] fact-grounding dropped N`, and `[dismissed] suppressed N` lines — those are the
deterministic safety nets removing known FPs before you see them.

## Step 2 — Classify each finding into one of four buckets

For EVERY high-tier finding AND every advisory you intend to act on or dismiss, run the
verification workflow before deciding the verdict. Eyeballing is the FP source.

### The verification workflow

```bash
# Fetch the cited file (the URL in the note's source: list, OR the URL the auditor suggested)
curl -sL "<raw-url>" | grep -niE '<term1>|<term2>|<term3>'

# If the finding is about a line range, confirm the symbol is in the original anchor
curl -sL "<raw-url>" | sed -n '<a>,<b>p'
```

For GitHub blob URLs, swap `github.com/<owner>/<repo>/blob/<ref>/` for
`raw.githubusercontent.com/<owner>/<repo>/<ref>/`.

### The four buckets

| Bucket | Condition | Action |
| --- | --- | --- |
| **TRUE-and-cited** | Claim is supported by a URL already in `source:`. Auditor's extract failed. | Dismiss. `reason:` names the verifying file/anchor (e.g. "verified at `provider-scopes.md#L152`: '~5% latency-wise' is verbatim"). |
| **TRUE-but-uncited** | Claim is supported by a URL not yet in `source:`. | **ADD the URL to `source:`**. Do NOT dismiss — the audit's job was to surface this gap. Then optionally dismiss the now-cited finding. |
| **WRONG-claim** | Primary source contradicts the prose. | **Fix the prose** with a citation to the contradicting source. Add the source URL to `source:` if missing. |
| **UNVERIFIABLE** | No usable primary source within the session. | Leave a `// TODO: verify` advisory in place; dismiss with `reason: "no primary source available; revisit"`. |

### Forbidden classifications

- Dismissing on basis of "follows from cited files" without grepping the cited files.
- Dismissing on basis of "auditor extract probably failed" without re-fetching the URL.
- Softening a verified-true claim to a vague one to satisfy the auditor (e.g. replacing
  `gzip/deflate/brotli` with `gzip` to dodge a citation request). Cite, don't hedge.
- Dropping a specific line anchor to a bare URL because an auditor said "real range is
  L<m>-L<n>" without `curl | grep`-ing first. Anchor-rot findings are ~50% FP.

## Step 3 — Apply true positives

For WRONG-claim and TRUE-but-uncited findings:

1. Use `multi_replace_string_in_file` for clusters in the same file.
2. Add new source URLs to frontmatter `source:` lists.
3. **Bundle related fixes into one commit** when the same wrong claim appears in N notes
   (e.g. "rethrow chain" in both `exception-filters.md` and `request-lifecycle.md`).
4. Commit messages: `fix(<area>): <correction>` for prose, `docs: cite primary sources for
   <topic>` for source-only adds.

If the finding has a `suggestedFix: {kind, before, after, primarySource, rationale}` field
(Pass 3 fix-proposer), it's a **starting point**, not a mandate. The proposer is hard-prompted
to obey "Cite, don't hedge" and to decline rather than soften, so when present it's usually
worth reading. Still apply the three-gate test:

1. Real (verified against primary source by you, not just the proposer).
2. Preserves or adds info (cite-don't-hedge).
3. Worth the diff (a paragraph already cited adjacently doesn't need duplicate citations).

When `suggestedFix` is absent the proposer declined; write the fix from scratch.

## Step 4 — Persist dismissals

For TRUE-and-cited and UNVERIFIABLE findings (and any high-tier you've verified as FP), append
to `scripts/audit-notes/dismissed.json` so future runs auto-suppress.

The signature is content-addressed: `sha1(path + "\0" + rule + "\0" + trimmed line text)`.
This survives line-number drift but **re-fires when the prose is rewritten** — which is the
right time to re-evaluate.

### One-liner pattern

Write a small node script (e.g. `/tmp/add-dismiss.cjs`) that takes `{path, line, reason}`
tuples, reads the live line content from disk, hashes it, and appends:

```js
const fs = require('fs');
const crypto = require('crypto');
const dismissedPath = '<repo>/scripts/audit-notes/dismissed.json';
const root = '<repo>/';

function sig(p, rule, line) {
  return crypto.createHash('sha1').update(p + '\0' + rule + '\0' + line.trim()).digest('hex');
}
function getLine(p, n) {
  return fs.readFileSync(root + p, 'utf8').split('\n')[n - 1];
}

const items = [
  { path: 'content/<area>/<note>.md', line: <N>,
    reason: "Verified at <file/anchor>: <exact quote>. <which source URL backs it>." },
  // ...
];

const data = JSON.parse(fs.readFileSync(dismissedPath, 'utf8'));
for (const it of items) {
  const line = getLine(it.path, it.line);
  if (!line) { console.error('NO LINE', it); process.exit(1); }
  const s = sig(it.path, 'source-verification', line);
  if (data.entries.some(e => e.sig === s)) { console.log('skip dup', it.path, it.line); continue; }
  data.entries.push({ path: it.path, sig: s, rule: 'source-verification',
    reason: it.reason, date: '<YYYY-MM-DD>', originalLine: line.trim() });
  console.log('added', it.path, it.line);
}
fs.writeFileSync(dismissedPath, JSON.stringify(data, null, 2) + '\n');
```

Run with `node /tmp/add-dismiss.cjs`. Delete the script after.

### Dismissal `reason:` quality bar

- ✅ "Verified at `throttler.guard.ts#L37-L40`: constructor takes ThrottlerModuleOptions, ThrottlerStorage, Reflector. Note already cites the file inline."
- ✅ "Verified at docs.nestjs.com/middleware#functional-middleware: 'Consider using the simpler functional middleware alternative…' is verbatim."
- ❌ "False positive."
- ❌ "Already cited."
- ❌ "Auditor probably hallucinated."

## Step 5 — Lint chain (BEFORE every commit)

```bash
(cd quartz && npm run lint:wikilinks) && (cd scripts/audit-notes && yarn lint:content && yarn lint:format)
```

All three must pass. Forbidden: `| tail -N` between any of these — pipe exit status becomes
the tail's (always 0) and silently masks failures. Forbidden: chaining `&& git commit` after
a tailed lint. Read all the output.

If formatting fails: `(cd scripts/audit-notes && yarn format)` auto-fixes.

If you touched any frontmatter `source:` URL or added an inline GitHub blob link, also run:

```bash
bash scripts/check-source-urls.sh
```

This HEADs every `https://github.com/<o>/<r>/blob/<ref>/<path>` URL through `raw.github`
and fails on any 404. Local-only (network + 60 req/hr unauth limit). Skipping it lets typos
like `parse-file-pipe-builder.ts` (real: `parse-file-pipe.builder.ts`) ship as silent
source-list gaps.

## Step 6 — Commit

Group fixes by intent. A typical post-audit batch produces 3–5 commits:

1. **Prose fix per cluster of related WRONG-claims** (one commit per topic, even if it spans
   multiple notes — co-locating the corrected claim with its corrected siblings keeps the
   commit greppable).
2. **Source additions** for TRUE-but-uncited findings (`docs: cite primary sources for …`).
3. **Dismissals batch** at the end (`chore(audit): persist verified-cited dismissals from
   <triage-context>`).

Conventional commits, no scope, no body unless absolutely necessary, no co-author trailers.

## Step 7 — Do NOT push

Push is the user's call, even when the work is shipped-ready. AGENTS.md is explicit: pushing
without explicit ask is a violation.

## Common pitfalls

- **Eyeballing the JSON and dismissing in chat without `curl`-verifying.** This is the FP
  analogue of mechanical application — buries real bugs. One concrete batch: 3 of 14
  "looks plausible" advisories I dismissed without fetching turned out to be real prose bugs
  (rethrow-chain, testing-override, microservice-coverage).
- **Mechanically applying a finding because it's in the JSON.** 5 of 9 high-tier findings I
  applied in one batch were FPs (`formatPid` real range L417-L419 not L407-L409;
  `loadSwcCliBinary` real range L198-L200 not L215; etc.). Verify first, restore if the
  original was right.
- **Softening a true claim to satisfy a "claim not supported" finding.** The fix is to ADD
  the missing URL to `source:`, NOT to weaken the prose into something unfalsifiable.
- **Skipping `check-source-urls.sh` after touching a `source:` list.** Typos in path segments
  pass every other lint and only surface as silent gaps in the next audit's source extracts.
- **Piping the lint chain through `tail` then chaining `&& git commit`.** Tail's exit is
  always 0; lint failures slip into the commit. Read full lint output.
- **Forgetting to mirror `AGENTS.md` → `.github/copilot-instructions.md`** when a triage
  loop produced an AGENTS.md edit. Lint-enforced; CI fails on drift.
- **Not bundling identical fixes across notes.** When the same wrong claim is in N notes,
  one commit fixing all N is greppable; N commits aren't.

## Boundaries

- This skill does NOT write notes from scratch — that's `kb-author`.
- This skill does NOT modify the audit pipeline itself (`scripts/audit-notes/*.ts`) — that's
  a separate engineering task.
- AGENTS.md invariants (frontmatter schema, vocabulary, linker rules, sourcing rule,
  cite-don't-hedge, verify-before-dismissing) win on any conflict.

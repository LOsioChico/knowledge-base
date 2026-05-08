---
name: kb-research-author
description: End-to-end workflow for researching a topic from external courses/docs, verifying every claim against primary sources, and authoring well-categorized, audit-clean notes in this vault.
---

# kb-research-author

Use this when the user asks to write notes about a topic you don't already have firsthand reps in (a new AWS service, a new framework feature, a new pattern). It chains: discovery → source selection → claim extraction → primary-source verification → categorization → drafting → audit → triage → commit.

AGENTS.md governs the invariants (frontmatter schema, tag vocabulary, linker rules, sourcing rule). This skill governs the **process** of getting from "I want to write about X" to a clean commit. Read AGENTS.md first; this file does not duplicate its rules.

## Phase 1 — Scope and discovery (before any source reading)

1. **Disambiguate the ask.** "Write S3 notes" can mean one concept note, a recipe set, or a parent + children. Surface the options in one sentence and pick a default (per AGENTS.md "Surface choices, don't pick silently").
2. **Run the AGENTS.md pre-flight discovery ritual** for the target area (`bat AGENTS.md`, `bat content/<area>/index.md`, `fd . content/<area> -e md`, `rg -n -i '<keyword>'`, read every candidate). Skipping this leads to duplicate notes.
3. **Decide the note shape per file** before sourcing: which is `type/concept`, which is `type/recipe`, which is `type/reference`. The categorization decision changes which audits run later (e.g. the jargon judge skips `type/reference`).

## Phase 2 — Source selection

Order of preference, strict:

1. **Official documentation** for the technology (AWS user guides, NestJS docs, the package's README on GitHub).
2. **Official source code** at a pinned ref (file URL with line anchor).
3. **Official RFCs/specs** when behavior is protocol-level.
4. **Educative / paid courses** ONLY as a *signal of what's worth covering* (which subtopics matter, which gotchas recur). Never as a citation. Use `mcp__educative__search_courses` then `get_course` + `get_lesson` to inventory the topic surface, then go to the official docs to verify each claim.
5. Blogs, Stack Overflow, other LLMs: forbidden as sources (per AGENTS.md sourcing rule).

When using a course as a topic-surface inventory:

```
mcp__educative__search_courses(query: "...")
mcp__educative__get_course(slug: "...")           # gets author_id, collection_id, page_ids
mcp__educative__get_lesson(author_id, collection_id, page_id)
```

Extract a **claim list** from the course (each claim is one falsifiable statement: "Glacier Deep Archive minimum duration is 180 days", "S3 bucket names cannot end with `-an` outside the account regional namespace"). Do NOT write prose yet.

## Phase 3 — Primary-source verification

For every claim from Phase 2:

1. WebFetch the relevant official doc page or `curl -s` the raw GitHub source.
2. Quote the supporting text mentally; if the doc contradicts the claim, the claim is wrong (drop or rewrite).
3. Note the exact URL with anchor (`#section-id` for docs, `#L<m>-L<n>` for source). This becomes the inline citation in the prose AND lands in `source:` via `yarn autofix`.
4. **Comparative claims are double work** (per AGENTS.md): "same as X" requires verifying X too. If you can't verify the comparator in this session, drop the comparison.
5. **Numeric specifics are high risk**: any "~20× cheaper", "~80% reduction", "12+ hours" — either find the exact number in primary docs or replace with a vague-but-honest phrasing ("over an order of magnitude", "measured in hours"). Never ship an unsourced specific.

If a claim survives verification, keep it with its citation. If it doesn't, drop it. Gaps > hallucinations.

## Phase 4 — Categorization and placement

- **Folder = area.** New area? Create `content/<area>/index.md` first.
- **Type tag** drives audit behavior:
  - `type/concept` — opinionated explainer with a TL;DR. Jargon judge applies.
  - `type/recipe` — step-by-step with runnable code. "Show, don't tell" applies (paired request/response). Jargon judge applies.
  - `type/reference` — pure lookup table or cheat sheet. Jargon judge is skipped.
  - `type/gotcha` — single-footgun deep dive.
  - `type/moc` — index pages only.
- **Title rules** (AGENTS.md "Note titles"): differentiating word first; folder context implicit; sentence case.
- **Plan the wikilink graph** before drafting: which existing notes will the new note link to, and which existing notes need their `related:` updated to point back? The wikilink linter enforces symmetry.

## Phase 5 — Drafting

Follow the recipe / concept template in AGENTS.md (tagline → setup → minimal example → table → defaults → gotchas → See also). Code rules:

- **TypeScript by default**, NestJS service (`@Injectable`) when illustrating a server-side use case. Python/Go/Java acceptable as one-liners after the canonical TS example, never as the only sample.
- **Fully runnable snippets**: every import present, every class wrapped in its container, every referenced field declared. AGENTS.md "Code examples (MANDATORY)" governs.
- **Inline citations next to surprising claims** with the precise anchor — not just in `source:`. The `inline-source-citations` linter enforces this and `yarn autofix` syncs `source:`.

## Phase 6 — Linter pass (BLOCKING, run before audit)

From repo root:

```bash
(cd quartz && npm run lint:wikilinks) && \
  (cd scripts/audit-notes && yarn lint:content && yarn lint:format)
```

Any failure here fails CI. `yarn format` (in `scripts/audit-notes/`) auto-fixes Prettier. Wikilink failures usually mean a missing `related:` back-link or an unlinked first mention of a known concept.

## Phase 7 — LLM audit and triage

```bash
set -a; source .env; set +a
cd scripts/audit-notes
yarn start --json ../../content/<area>/<file>.md [more.md ...] > /tmp/audit.json 2> /tmp/audit.err
```

For each finding, **verify before acting** (per AGENTS.md "Audit findings are suggestions"):

- High-tier `Contradicts` / `Not supported`: WebFetch the cited URL. Most are real; some pattern-match wrong. Fix prose only after confirming the contradiction.
- High-tier with `suggestedFix`: still a hypothesis. Apply only after the same verification.
- `Plausible but unsourced`: usually means "add the inline citation"; never "soften the claim". The AGENTS.md "Cite, don't hedge" rule is non-negotiable.
- `style-jargon` advisories: glob each flagged token, decide if (a) define inline, (b) wikilink, or (c) replace with plain-English behavior. Quick wins; high signal for first-time readers.
- Persisted dismissals: if a finding is genuinely a false positive that will recur, append to `scripts/audit-notes/dismissed.json` with a content-addressed signature (see AGENTS.md "Persisted dismissals").

Re-run linters after every fix batch.

## Phase 8 — Commit

Conventional commits, no scope, atomic. One logical change per commit. Examples:

- `feat: aws s3 storage classes concept note`
- `feat: aws s3 presigned-urls recipe`
- `fix: correct glacier min-billable-size in s3 storage classes`

Do NOT push. The user pushes.

## Anti-patterns to avoid

- **Writing prose before verification.** Always extract claims first, verify second, write third.
- **Citing a course as a source.** Courses surface topics; official docs are sources.
- **Mechanically applying audit findings.** Verify each one. The false-positive rate is high enough that mechanical apply is the single biggest source of regressions.
- **Softening a true claim to satisfy an auditor.** Add the inline citation instead. If you can't find a citation, the claim was wrong; drop it.
- **Duplicating a fact across notes.** A fact about X lives in X's note; other notes link to it.
- **Skipping the post-categorization audit-mode shift.** Recategorizing a note from `type/reference` to `type/concept` activates the jargon judge — re-run the audit before assuming the note is clean.

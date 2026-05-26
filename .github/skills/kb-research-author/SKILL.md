---
name: kb-research-author
description: End-to-end workflow for researching a topic from external courses/docs, verifying every claim against primary sources, and authoring audit-clean canonical Starlight MDX.
---

# kb-research-author

Use this when the user asks to write notes about a topic you don't already have firsthand reps in (a new AWS service, a new framework feature, a new pattern). It chains: discovery → source selection → claim extraction → primary-source verification → categorization → MDX drafting → audit → triage → handoff or commit when asked.

AGENTS.md governs the invariants (frontmatter schema, tag vocabulary, linker rules, sourcing rule). This skill governs the **process** of getting from "I want to write about X" to a clean commit. Read AGENTS.md first; this file does not duplicate its rules.

## Phase 1 — Scope and discovery (before any source reading)

1. **Disambiguate the ask.** "Write S3 notes" can mean one concept note, a recipe set, or a parent + children. Surface the options in one sentence and pick a default (per AGENTS.md "Surface choices, don't pick silently").
2. **Run published-site discovery first** for reader-facing work: inspect `sites/docs/src/content/docs/<area>/`, the area MOC, `sites/docs/astro.config.mjs`, and nearby MDX siblings.
3. **Decide the note shape per file** before sourcing: which is `type/concept`, which is `type/recipe`, which is `type/reference`. The categorization decision changes which audits run later (e.g. the jargon judge skips `type/reference`).

## Phase 2 — Source selection

Order of preference, strict:

1. **Official documentation** for the technology (AWS user guides, NestJS docs, the package's README on GitHub).
2. **Official source code** at a pinned ref (file URL with line anchor).
3. **Official RFCs/specs** when behavior is protocol-level.
4. **Secondary sources** (blogs, conference talks, Stack Overflow, Educative / paid courses, other LLMs) — valid as _topic-surface inventory and perspective_: which subtopics matter, which tradeoffs practitioners hit, how to frame the decision. NEVER as the citation backing a claim. Workflow: read the secondary source → extract a claim list → verify each claim against an official primary source → cite the primary source. If a secondary source meaningfully shaped the note's framing, credit it in a "Further reading" sub-bullet under `## See also`, never in `source:`. For Educative specifically, use `mcp__educative__search_courses` then `get_course` + `get_lesson` to inventory the topic surface.

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
3. Note the exact URL with anchor (`#section-id` for docs, `#L<m>-L<n>` for source). For MDX, keep that URL as the reader-facing inline citation next to the claim.
4. **Comparative claims are double work** (per AGENTS.md): "same as X" requires verifying X too. If you can't verify the comparator in this session, drop the comparison.
5. **Numeric specifics are high risk**: any "~20× cheaper", "~80% reduction", "12+ hours" — either find the exact number in primary docs or replace with a vague-but-honest phrasing ("over an order of magnitude", "measured in hours"). Never ship an unsourced specific.

If a claim survives verification, keep it with its citation. If it doesn't, drop it. Gaps > hallucinations.

## Phase 4 — Categorization and placement

- **Folder = area.** New published area? Create the MDX area MOC under `sites/docs/src/content/docs/<area>/index.mdx` and add the sidebar entry.
- **Page kind drives structure:** area MOC, sub-area MOC, concept, recipe, reference, or gotcha. Use `kb-author` S2 to choose required MDX elements, and S3 only for recipe behavior claims.
- **Title rules** (AGENTS.md "Note titles"): differentiating word first; folder context implicit; sentence case.
- **Plan the MDX link graph** before drafting: which existing published pages should link to the new page, which MOC/CardGrid/sidebar entries need updates, and whether any table links must use normal markdown links instead of `[[slug|label]]`.

## Phase 5 — Drafting

Follow the page shape from `docs/PUBLISHING.md` and `kb-author` S1–S6 (tagline → orientation/decision aid → minimal example or concept spine → gotchas → See also). Code rules:

- **TypeScript by default**, NestJS service (`@Injectable`) when illustrating a server-side use case. Python/Go/Java acceptable as one-liners after the canonical TS example, never as the only sample.
- **Fully runnable snippets**: every import present, every class wrapped in its container, every referenced field declared. AGENTS.md "Code examples (MANDATORY)" governs.
- **Inline citations next to surprising claims** with the precise anchor. For MDX, inline links are the durable reader-facing source.

## Phase 6 — Linter pass (BLOCKING, run before audit)

From repo root, run the Starlight checks for MDX work:

```bash
bun run lint:docs
bun run docs:build
bun run lint:publish-parity   # MDX page count health check
```

For full CI coverage before commit, run `bun run lint:ci` and `bun run test:ci` when the change touches tooling. Wikilink failures usually mean a missing MDX target, an aliased wikilink inside a table row, or a full-site URL where a wikilink should be used.

## Phase 7 — MDX audit and triage

Optional LLM pass on changed MDX, after `lint:docs` and `docs:build` pass:

```bash
bun run audit:mdx-triage -- --base HEAD~1
```

For explicit paths from `scripts/audit-notes/`:

```bash
cd scripts/audit-notes
bun run audit:mdx-triage -- ../../sites/docs/src/content/docs/<area>/<slug>.mdx
```

For each finding, **verify before acting** (per AGENTS.md "Audit findings are suggestions"). `kb-mdx-auditor` findings are hypotheses, not commands. Fix only after checking the page and cited primary sources. If you intentionally reject a finding, explain the verification chain in chat.

Re-run linters after every fix batch.

## Phase 8 — Finalize Starlight publication

Reader-facing notes are MDX-first.

1. **Re-author** MDX at `sites/docs/src/content/docs/<area>/<slug>.mdx`; do not paste raw markdown ([`kb-author` S1](../kb-author/audits/S1-publish-bar.md)).
2. Run **S1–S6** and `bun run lint:docs` + `bun run docs:build` ([`kb-author` Workflow 3](../kb-author/SKILL.md)).
3. Update `sites/docs/astro.config.mjs` sidebar and area MOC CardGrid when the slug is new.
4. `bun run lint:publish-parity` must stay green (MDX page count health check).

New notes go directly into MDX.

## Phase 9 — Commit if asked

When the user asks for a commit, use conventional commits, no scope, atomic. One logical change per commit. Examples:

- `feat: aws s3 storage classes concept note`
- `feat: publish aws s3 presigned-urls on Starlight`
- `fix: correct glacier min-billable-size in s3 storage classes`

Do NOT push. The user pushes.

## Anti-patterns to avoid

- **Writing prose before verification.** Always extract claims first, verify second, write third.
- **Running mutating cloud commands while authoring docs.** For AWS pages, author and verify command syntax against AWS docs/CLI reference, but do not run create/update/delete AWS CLI commands from the agent environment unless the user explicitly asks and confirms the target account/profile.
- **Citing a course as a source.** Courses surface topics; official docs are sources.
- **Mechanically applying audit findings.** Verify each one. The false-positive rate is high enough that mechanical apply is the single biggest source of regressions.
- **Softening a true claim to satisfy an auditor.** Add the inline citation instead. If you can't find a citation, the claim was wrong; drop it.
- **Duplicating a fact across notes.** A fact about X lives in X's note; other notes link to it.
- **Skipping the post-categorization audit-mode shift.** Recategorizing a note from `type/reference` to `type/concept` activates the jargon judge — re-run the audit before assuming the note is clean.

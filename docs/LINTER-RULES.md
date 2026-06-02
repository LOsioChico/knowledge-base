# Linter Rules Reference

> Extracted from AGENTS.md. This file documents the automated enforcement rules in `scripts/lint-wikilinks.mjs` and related linters. For the core authoring rules, see [AGENTS.md](../AGENTS.md).

## Discoverability rule

(same linter, BLOCKING): every pair of notes whose TF-IDF cosine similarity is ≥ 0.20 MUST be connected — either via `related:` (either direction), a body wikilink (either direction), or an explicit `unrelated:` opt-out (either direction). This is the safety net for "you don't know what you don't know": when you write a new note, the linter compares it against every existing note and flags semantic neighbors you didn't realize existed. Resolution is one of three: (1) add the missing `related:` link both ways, (2) add a body wikilink at first mention, or (3) if the overlap is genuinely coincidental (shared vocabulary, different topic), declare it via `unrelated:` on either side. **You cannot ignore the warning** — every above-threshold pair must be acknowledged. Threshold (0.20) was calibrated against the natural similarity cliff in the current knowledge base; revisit if the false-positive rate grows. Algorithm details: title × 3 + aliases × 2 + masked body × 1, smoothed IDF, ~120 English stopwords, `index` notes excluded.

## Agents-mirror rule

(same linter, BLOCKING): `.github/copilot-instructions.md` MUST be a byte-identical copy of `AGENTS.md`. The mirror exists so VS Code Copilot Chat (which reads `.github/copilot-instructions.md` universally) gets the same conventions as agentic flows that read `AGENTS.md`. After any edit to `AGENTS.md`, run `cp AGENTS.md .github/copilot-instructions.md` and commit both. The linter fails CI on drift.

## Inline-source-citations rule

(same linter, BLOCKING): every inline link in note bodies pointing at a primary-source URL (currently `https://github.com/<owner>/<repo>/blob/...` and `https://docs.nestjs.com/...`) must have its fragment-stripped form present in the note's frontmatter `source:` list. Fragment (`#L<m>-L<n>`, `#section-anchor`) and trailing slash are stripped before comparison, so inline links keep their precision while `source:` stays file-level. Don't try to remember this rule — the linter catches misses and tells you exactly which URL to add. Add new domain prefixes to `PRIMARY_SOURCE_RE` in `scripts/lint-wikilinks-core.mjs` when the knowledge base grows beyond NestJS sources.

## Cross-area wikilink rule

(enforced by `bun run lint:mdx-wikilinks`, BLOCKING): body wikilinks that cross area boundaries (target area ≠ file area) MUST use **multi-word display text** that includes area context (e.g. `[[effect-ts/schema|Schema deep-dive]]`, `[[nestjs/recipes/rate-limiting|NestJS Rate Limiting Recipe]]`). Single-word display text like `[[effect-ts/platform|HTTP]]` or `[[effect-ts/state|state]]` is forbidden — these words are too generic to link cross-area meaningfully. Index/MOC files, `*-vs-*` comparison notes, `## See also` sections, and prerequisite Aside blocks are exempt. Intentional exceptions go in `scripts/cross-area-allowlist.json`.

## Listing-completeness rule

(same linter): every note under an indexed sub-folder (currently `nestjs/recipes/`) MUST appear in the area `index.md`. Add new indexed folders to the `INDEXED_FOLDERS` array in `scripts/lint-wikilinks.mjs`.

## Starlight folder index slugs

In Starlight MDX pages under `sites/docs/`, folder index pages do NOT contain `/index` in their route slugs. The route slug is the folder name itself (e.g. `[[aws/sqs]]` or `[[aws/eventbridge]]`). Using the `/index` basename (such as `[[aws/sqs/index]]` or `[[aws/eventbridge/index]]`) in wikilinks or frontmatter `related:` lists is forbidden and will fail the `bun run lint:ci` compilation checks. Always reference the bare folder name for folder index pages.

## No aliased wikilinks inside markdown tables

Obsidian aliased wikilinks (`[[slug|label]]`) use the pipe character (`|`), which breaks markdown table column parsing. Inside all tables under `sites/docs/`, use standard markdown links `[label](/knowledge-base/slug/)` instead (enforced by `bun run lint:mdx-table-wikilinks`).

## Prerequisite Badges & Curriculum Progression Invariant

(BLOCKING): Every non-index note-level MDX page under `sites/docs/` must have documented prerequisites immediately following the tagline quote. This can be either:
1. A standard Astro Starlight Aside component: `<Aside type="tip" title="Prerequisites">Before diving in, make sure you understand: - [[prerequisite-slug|Prerequisite Concept]]</Aside>`
2. Or, for compact tracks (like Effect-TS), tagline-integrated: `> Prerequisite: [[prerequisite-slug|Prerequisite Concept]]` inside the initial tagline blockquote.

This is a programmatically enforced quality gate in `mdx-deterministic.ts` (`checkMdxPrerequisiteBadge`). If a page does not include either of these prerequisite indicators, the `bun run lint:ci` linter will fail and block compilation. Mapped prerequisites must align logically with the nearest Map of Content (MOC) index visual flowchart sequence.

## Contradiction scanner

(LLM-powered, NOT in CI): detects factual contradictions between related notes. For each pair of notes connected via `related:` or body wikilinks within the same area, an LLM extracts factual claims (execution order, API behavior, default values, scope assertions) and cross-checks for incompatible statements. Runs locally via `bun run audit:contradictions` (requires `CURSOR_API_KEY`). Findings use `dismissed.json` for false-positive management. Use `--area nestjs` to scope to one area, `--cross-area` for full cross-area comparison, `--json` for structured output. Skill prompt: `.github/skills/kb-contradiction-judge/SKILL.md`.

## Known limitation of forced symmetry

`related:` currently collapses three distinct relationships (peer ↔ peer, recipe → fundamental prerequisite, fundamental → recipes-that-use-it) into one symmetric field. This is fine at the current knowledge base size but will cause noise on fundamentals that get many dependents. When that starts to hurt (a fundamental's `related:` block becomes longer than its own content, ~10+ dependents), split the contract: keep `related:` for symmetric peers, add `prerequisites:` for asymmetric "you need to read this first" links (linter would NOT require back-references on `prerequisites:`). Don't pre-emptively split — wait for the friction.

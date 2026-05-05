# AGENTS.md

Operating contract for any AI agent (Copilot CLI, Claude Code, Cursor, etc.) editing this knowledge base. Read this file end-to-end before touching any note. Nearest `AGENTS.md` wins; this is the root.

## Surface choices, don't pick silently

When a request has plausibly different interpretations (callout severity, callout type, placement, prose vs. table, scope of a refactor, where to put a new section), name the options in one sentence and pick a default — don't commit to one silently. Cheap to ask, expensive to undo.

## Companion skill

Before editing any file under `content/`, load the **`kb-author`** skill (lives at
`.github/skills/kb-author/SKILL.md`). It carries the multi-step workflows that this file only
summarizes: the pre-flight discovery ritual, the post-edit audit checklist (code examples,
reference-table linking, sourcing), and the "encode-repeated-patterns" reflex. AGENTS.md remains
the source of truth for invariants (schema, vocabulary, linter rules); the skill is the playbook
for executing on them.

## What this repo is

A personal Quartz v4 knowledge base, deployed to https://losiochico.github.io/knowledge-base. Single author, multi-agent editors. Source markdown lives under `content/` at the repo root. All Quartz machinery (config, framework source, `package.json`, `node_modules`, build output) lives under `quartz/`. Quartz config is `quartz/quartz.config.ts`. Static assets shipped as-is from `quartz/quartz/static/`.

## Folder layout

```
content/
  index.md                       # vault home + areas list (top-level MOC)
  <area>/
    index.md                     # area MOC, MANDATORY for every area
    <subarea>/
      index.md                   # sub-area MOC if the subarea has 3+ notes
      <note>.md                  # atomic note, one concept per file
quartz/static/                   # site-level static assets (favicon, og image, etc.) — actual path is quartz/quartz/static/
```

Rules:

- One concept per file. Split before a note exceeds ~250 lines.
- Every folder under `content/` MUST have an `index.md` (its MOC).
- File names: kebab-case, descriptive nouns (`request-lifecycle.md`, not `req-lc.md`).
- No orphans. A note that nothing links to is a bug.

## Frontmatter schema (required)

Every `.md` under `content/` MUST start with:

```yaml
---
title: Human Readable Title
aliases: [synonym one, synonym two]
tags: [type/<type>, tech/<tech>]
area: <top-level area, e.g. nestjs>
status: evergreen # seed | draft | evergreen | archived
related:
  - "[[path/to/note-a]]"
  - "[[path/to/note-b]]"
unrelated: [] # optional; per-pair opt-out for discoverability linter
source:
  - https://official.docs/url
---
```

Field rules:

- `title`: required. Sentence case.
- `aliases`: required if there are common synonyms. Empty list `[]` is acceptable but discouraged.
- `tags`: required. Use the controlled vocabulary below. Hierarchical `type/x`, `tech/x` form. **Do not tag with the area** — the folder already encodes that.
- `area`: required frontmatter field. Matches the top-level folder. Used by tooling, NOT exposed as a tag.
- `status`: required. Default `evergreen` once the note is real.
- `related`: required. Wikilinks to every directly-related note found during the discovery ritual. Both directions: when you add a new note, you also update `related:` in the notes you linked from.
- `unrelated`: optional. Same wikilink syntax as `related:`. Use ONLY to silence the discoverability linter for a specific pair of notes that the TF-IDF check flags as semantic neighbors but that you've **considered and rejected** as a real relationship. This is a per-pair audit trail, NOT a global silence — you cannot opt a note out of the check entirely. Mirror format: `unrelated: ["[[path/to/note]]"]` or block YAML list.
- `source`: optional but strongly preferred when the note distills external docs.

## Controlled tag vocabulary

Tags are namespaced. Do not invent free-form tags. If a needed tag is missing, add it here in the same commit that introduces it.

### `area/*` — DO NOT USE AS A TAG

The top-level folder under `content/` encodes the area. A note under `content/nestjs/` is in the NestJS area; tagging it `area/nestjs` adds no information and pollutes the tag index. The `area:` frontmatter field is the machine-readable version for tooling. If a note ever needs to span two areas (e.g., a NestJS+React recipe), file it under the primary area's folder and add the secondary area to `related:` via wikilinks — not tags.

### `type/*` (note kind)

- `type/moc` — map of content (any `index.md`)
- `type/concept` — explains an idea
- `type/recipe` — step-by-step how-to
- `type/pattern` — design pattern writeup
- `type/gotcha` — bug, sharp edge, or footgun
- `type/reference` — cheat sheet or table

### `tech/*` (specific technology)

- `tech/typescript`, `tech/rxjs`, `tech/multer`, `tech/http`, `tech/class-validator`, `tech/class-transformer`, `tech/asynclocalstorage`, `tech/nest-cli`, `tech/typeorm`, `tech/postgres`, `tech/kafka` (reserved), `tech/prisma` (reserved), `tech/jwt` (reserved), `tech/aws`, `tech/cloudfront`, `tech/amplify`, `tech/rds`, `tech/iam`, `tech/acm`, `tech/secrets-manager`

### Cross-cutting concepts (no namespace, used sparingly)

- `lifecycle`, `events`, `cqrs`, `messaging`, `streaming`, `validation`, `errors`

## Pre-flight discovery ritual (MANDATORY before creating or significantly editing a note)

Run, in order, from the repo root:

```bash
# 1. Read the operating contract and the area MOC
bat AGENTS.md
bat content/<area>/index.md

# 2. Inventory the area
fd . content/<area> -e md

# 3. Search the whole vault for the concept and adjacent terms
rg -n -i '<keyword>|<synonym>|<adjacent-concept>' content

# 4. Inspect existing relationship metadata
rg -n '^(tags|aliases|area|related):' content -A 4

# 5. Read every candidate note that the searches surfaced
bat content/<area>/<candidate>.md
```

Only after those five steps may you draft the note. Then:

6. Add the note with the full frontmatter schema.
7. Update `related:` in EVERY note you linked from.
8. Update the closest `index.md` MOC and, if a new area, `content/index.md`.
9. **Audit every code block you touched** against the "Code examples (MANDATORY)" rules below: each fenced ` ```ts ` / ` ```typescript ` block (including those inside `> [!warning]` / `> [!example]` callouts) must carry all imports it uses, wrap class methods in their `@Controller` / `@Module` / `@Injectable` container, declare every field/constructor it references, and have zero undefined symbols. Do this as a final pass before commit, not while drafting — it's the step that's easiest to skip and the one that produces the most reader-facing breakage.

Skipping any step is a bug.

## Linking rules

- Body links use Obsidian wikilinks: `[[nestjs/fundamentals/guards|Guards]]`. Quartz renders these and emits backlinks automatically.
- `related:` frontmatter uses the same wikilink syntax inside quotes: `"[[nestjs/fundamentals/guards]]"`.
- Bidirectional by default — and **enforced by `npm run lint:wikilinks`**. If A `related:` B, then B `related:` A. The linter resolves partial wikilinks (e.g. `[[guards]]` → `nestjs/fundamentals/guards`) and exempts `index` notes (they're indices, not peers). CI blocks merges on asymmetric `related:` links.
- **Known limitation of forced symmetry**: `related:` currently collapses three distinct relationships (peer ↔ peer, recipe → fundamental prerequisite, fundamental → recipes-that-use-it) into one symmetric field. This is fine at the current vault size but will cause noise on fundamentals that get many dependents. When that starts to hurt (a fundamental's `related:` block becomes longer than its own content, ~10+ dependents), split the contract: keep `related:` for symmetric peers, add `prerequisites:` for asymmetric "you need to read this first" links (linter would NOT require back-references on `prerequisites:`). Don't pre-emptively split — wait for the friction.
- **First-mention wikilink rule** (enforced by `npm run lint:wikilinks`): the FIRST time a concept that has its own note appears in the body of another note, it MUST be a wikilink, not plain text. Subsequent mentions in the same note can stay plain. Code identifiers (e.g. `FileInterceptor`, `ParseFilePipe`) are not concepts; the underlying concept (`[[nestjs/fundamentals/interceptors|interceptor]]`, `[[nestjs/fundamentals/pipes|pipe]]`) is. The linter scans every note's title + aliases + filename to build the concept catalog, then checks every other note's body for unlinked first mentions. CI blocks merges on violations.
- **Wikilink-syntax rule** (enforced by `npm run lint:wikilinks`, BLOCKING): backticks MUST NOT appear inside `[[ ]]`. Quartz renders the wikilink display text as plain text, so backticks show up literally instead of as a code span. Forbidden: `[[exception-filters|`@Catch()` filters]]` (renders as the literal string `` `@Catch()` filters ``). Required: either drop the backticks from the alias (`[[exception-filters|@Catch() filters]]`) or move the code span outside the link (`` `@Catch()` filters (see [[exception-filters|exception filters]]) ``). Same rule applies to `related:` / `unrelated:` entries.
- **Listing-completeness rule** (same linter): every note under an indexed sub-folder (currently `nestjs/recipes/`) MUST appear in the area `index.md`. Add new indexed folders to the `INDEXED_FOLDERS` array in `quartz/scripts/lint-wikilinks.mjs`.- **Discoverability rule** (same linter, BLOCKING): every pair of notes whose TF-IDF cosine similarity is ≥ 0.20 MUST be connected — either via `related:` (either direction), a body wikilink (either direction), or an explicit `unrelated:` opt-out (either direction). This is the safety net for "you don't know what you don't know": when you write a new note, the linter compares it against every existing note and flags semantic neighbors you didn't realize existed. Resolution is one of three: (1) add the missing `related:` link both ways, (2) add a body wikilink at first mention, or (3) if the overlap is genuinely coincidental (shared vocabulary, different topic), declare it via `unrelated:` on either side. **You cannot ignore the warning** — every above-threshold pair must be acknowledged. Threshold (0.20) was calibrated against the natural similarity cliff in the current vault; revisit if the false-positive rate grows. Algorithm details: title × 3 + aliases × 2 + masked body × 1, smoothed IDF, ~120 English stopwords, `index` notes excluded.
- **Agents-mirror rule** (same linter, BLOCKING): `.github/copilot-instructions.md` MUST be a byte-identical copy of `AGENTS.md`. The mirror exists so VS Code Copilot Chat (which reads `.github/copilot-instructions.md` universally) gets the same conventions as agentic flows that read `AGENTS.md`. After any edit to `AGENTS.md`, run `cp AGENTS.md .github/copilot-instructions.md` and commit both. The linter fails CI on drift.
- **Inline-source-citations rule** (same linter, BLOCKING): every inline link in note bodies pointing at a primary-source URL (currently `https://github.com/<owner>/<repo>/blob/...` and `https://docs.nestjs.com/...`) must have its fragment-stripped form present in the note's frontmatter `source:` list. Fragment (`#L<m>-L<n>`, `#section-anchor`) and trailing slash are stripped before comparison, so inline links keep their precision while `source:` stays file-level. Don't try to remember this rule — the linter catches misses and tells you exactly which URL to add. Add new domain prefixes to `PRIMARY_SOURCE_RE` in `quartz/scripts/lint-wikilinks-core.mjs` when the vault grows beyond NestJS sources.
- A note never wikilinks to itself. Self-mentions stay plain. **In-note cross-references** (e.g., a row in a reference table pointing to a worked example further down the same note) MUST use a plain markdown anchor link like `[the section below](#defaultvaluepipe)` — never `[[note#Heading]]`, which the linter treats as a self-wikilink and rejects.
- **Reference-table linking rule**: when a note contains a reference table that enumerates entities (built-in pipes, built-in guards, decorators, common operators, etc.), every row whose entity is **demonstrated by a worked example** — either elsewhere in the same note or in another note — MUST link to that example from the row's notes/description column. Use a wikilink for cross-note targets (`[[nestjs/recipes/file-uploads|File uploads recipe]]`) and a plain anchor for in-note targets (`[composing pipes](#common-recipes)`). A row with no example to point to stays unlinked. Audit this every time you add a new example or a new table row: a freshly added example without a back-link from the table is a discoverability bug.
- `related:` is the safety net (machine-readable), wikilinks are the surface (reader-facing). Both must agree: if it's in `related:`, the body should link it at first mention; if the body links it, it must be in `related:`.
- Avoid stub links to non-existent notes. If you reference a future note, mark it explicitly: `[[microservices/kafka|Kafka (planned)]]`.

## Recipe template

Use `content/nestjs/recipes/file-uploads.md` as the canonical example. Structure:

1. tagline (single `>` blockquote)
2. setup (`npm install` + types)
3. minimal working example
4. comparison / config table
5. defaults and edge cases
6. gotchas section
7. `## See also` with internal wikilinks and an official-docs link

### Show, don't tell (MANDATORY for recipes)

Any section that describes an observable behavior change — "returns 400", "strips field X", "rejects payload Y", "the response becomes Z" — MUST include the concrete request and response. Show the input (JSON body, curl, or constructed instance) and the resulting output (JSON, status code, error shape) in fenced blocks. Phrases like "returns 400 with both messages" or "the password is stripped" without the actual JSON are a smell: the reader has to imagine what the recipe is claiming. Add the payloads, then the prose can shrink.

Applies to recipes (`type/recipe`); fundamentals can stay narrative when the behavior is obvious from the snippet.

**Scope: section bodies, not callouts.** This rule does NOT apply inside `> [!warning]` / `> [!info]` / `> [!example]` blocks. A callout is a compact visual flag — the warning IS the content; demanding paired request/response payloads inside every footgun bloats the visual and defeats the scan-friendly intent. If a callout's claim genuinely needs demonstration, promote the example into the surrounding section body and leave the callout as the pointer. The audit's `show-dont-tell` candidate finder skips callout interiors for this reason; do not work around the skip by restating the claim outside the callout just to trip the rule.

### Behavior-in-snippet, not buried in prose (MANDATORY for all notes with code)

When prose around a snippet claims a runtime behavior — "Nest auto-rewrites this", "emits a deprecation warning", "falls back to the default", "throws at startup if X", "silently coerces to Y" — that behavior MUST also appear **inside the snippet**: as a comment on the affected line, in the return value, in a console output line, or via an annotated identifier (e.g. `findAllV4`, `findAll_DEPRECATED`). Prose-only claims fail the scan-the-code reader, who never reads the surrounding paragraph.

Forbidden:

```typescript
// Before (Express v4)
@Get("users/*")
findAll() {}
```

(prose elsewhere says "Nest auto-rewrites this and emits a warning")

Required:

```typescript
// Before (Express v4): still works in v11, but Nest auto-rewrites it to a
// valid Express v5 route and logs a warning at startup. Don't ship new code
// with this shape.
@Get("users/*")
findAllV4() {
  return "auto-converted, deprecated"
}
```

One sentence inline next to the affected line beats one paragraph above the block. The rule is the snippet should stand alone in scan mode, even if the reader skips prose.

Advisory only — no automated detector. Audit during the post-edit code-block pass: for each prose claim about runtime behavior near a snippet, verify the snippet itself reflects the claim. See [`kb-author` Audit O](.github/skills/kb-author/audits/O-behavior-in-snippet.md).

### No assumed-knowledge jargon (MANDATORY for all notes)

A reader landing on a note for the first time should not need a second tab open to decode it. Every domain term, acronym, or named feature MUST be either (a) defined inline at first use in 3-10 words, (b) wikilinked to the note that defines it, or (c) replaced with the plain-English behavior it names. Compressed jargon-stacks ("WORM retention feature for concurrent-writer arbitration", "last-writer-wins by S3-side timestamp", "TLS terminator with origin shielding") fail the scan-the-note reader who came to learn the concept, not to confirm vocabulary they already have.

The reflex: when you reach for a noun phrase that took you more than a session of reading to internalize, ask "would the reader who needs this note already know this word?" If no, define it inline (`write-once-read-many (WORM)`, `the request that bypasses the cache and hits the origin`) or rewrite the claim around the observable behavior.

Forbidden (single bullet, three undefined terms in 50 words):

> No object locking for concurrent writers by default. Two PUTs to the same key resolve last-writer-wins by S3-side timestamp; the order is not predictable across clients. S3 Object Lock is a WORM retention feature for delete/overwrite protection, not concurrent-writer arbitration.

Required (lead with the observable behavior; jargon defined inline; trap promoted to a sub-bullet):

> Concurrent writes to the same key: last write wins, unpredictably. If two clients PUT to the same key at the same time, both succeed and S3 keeps the one with the later internal timestamp. You can't tell in advance which client that will be. S3 has no built-in lock for this; if you need ordering, gate writes through your own coordinator (a DynamoDB conditional write, a single-writer queue, etc.).
>
> - Don't reach for **S3 Object Lock** here: despite the name, it's a write-once-read-many (WORM) retention feature that prevents delete or overwrite for a fixed period, not a concurrency primitive.

Three patterns to apply when rewriting:

1. **Lead with the observable behavior, not the AWS/Nest/etc. name for it.** "Last write wins" before "last-writer-wins by S3-side timestamp". The named feature, if relevant, can follow.
2. **Define acronyms on first use.** `WORM (write-once-read-many)`, `MOC (map of content)`, `BPA (Block Public Access)`. After the first definition, the acronym alone is fine.
3. **Promote name-collision traps to sub-bullets.** When a feature has a misleading name ("S3 Object Lock isn't a lock", "Nest pipes aren't shell pipes"), make the warning a visually-distinct sub-item, not a tail clause of the main sentence.

Enforced as an LLM judge pass in `scripts/audit-notes/jargon-verify.ts` (Pass 1e), surfacing as `style-jargon` advisory findings. The judge (`kb-jargon-judge` skill) is constrained to quote a specific undefined token from a specific line: subjective complaints like "this paragraph is dense" are forbidden by the skill prompt. Triggers: undefined acronyms or named features used without an inline gloss/wikilink within ±10 lines, and misleading-name traps stated as tail clauses ("X is a Y feature, not Z"). A domain-shorthand whitelist suppresses universally-known acronyms in their home area (`AWS`/`S3`/`IAM`/etc. in `aws/**`; `JWT`/`DTO`/`HTTP`/etc. everywhere); reference notes (`type/reference` or `*/data/`, `*/reference/` paths) are skipped wholesale. Hard cap of 5 findings per note. Findings still surface as advisory because rewrites are subjective; dismiss via `dismissed.json` (sig-based) when the LLM is wrong. Audit during the post-edit reading pass too: read each section as if you'd never seen the technology, flag anything requiring an external glossary lookup. See [`kb-author` Audit P](.github/skills/kb-author/audits/P-no-assumed-jargon.md).

## Sourcing rule (NON-NEGOTIABLE)

Never write a technical claim from training-data memory. Every fact MUST be verified against primary sources at the moment of writing.

- **Primary sources first**: official docs, official repo source code, official RFCs/specs, package READMEs on npm/GitHub. Never a blog, never Stack Overflow, never another LLM's output.
- **Cross-check**: at least two independent primary sources for any non-trivial claim (signature, default value, behavior, package name, version-specific feature). One source is not enough.
- **Cite in `source:`**: every note's frontmatter `source:` list MUST contain the exact URLs consulted. If a section was added later, append the URL that backs it. No URL, no claim.
- **Inline link for surprising claims**: if a fact is counterintuitive or version-specific, link the source inline next to the claim, not just in frontmatter.
- **Citation precision**: when a claim cites a source file, link the specific lines (`blob/master/.../file.ts#L120-L135`); when it cites a docs page, link the section anchor (`docs.nestjs.com/openapi/operations#file-upload`). Bare file/page URLs are too coarse: the source-verification audit has to guess which paragraph backs the claim and degrades to vibes, and the next reader six months later has to re-find what you already found. Forbidden: `https://github.com/nestjs/nest/blob/master/packages/core/router/router-execution-context.ts` as the only pointer for a claim about one specific function — link `#L450-L470` (or whatever the relevant range is). Same for docs: `https://docs.nestjs.com/openapi/operations` is too coarse if the claim is about file uploads; link `#file-upload`. The exact 413 phrasing in nginx (`Request Entity Too Large`, not `Payload Too Large`) was caught precisely because the link pointed at `#client_max_body_size` — the audit fetched the right paragraph and the contradiction was obvious. Frontmatter `source:` can stay file-level (one URL per file keeps `check-source-urls.sh` cheap); inline prose links carry the precision. Trade-off: line numbers rot when upstream refactors, but the audit catches the drift the next time the note is touched, which is the right time to fix it. Pin to a commit SHA only for historical "this used to be true in vN" claims (e.g. release-notes notes).
- **Don't soften specifics to satisfy auditors**: when an LLM audit flags a specific anchor as wrong ("real range is L<m>-L<n>", "claim not supported by cited sources"), VERIFY before dropping. These findings have a high false-positive rate: the model often pattern-matches on a nearby symbol or misses that the claim IS supported by a file you simply haven't added to `source:` yet. Required verification: `curl -s <raw-url> | grep -n '<symbol>'` then `sed -n '<a>,<b>p'`. If the original anchor was correct, restore it and ignore the finding. If it was wrong, replace with the verified correct range — NEVER drop to a bare URL. If the claim is true but unsourced, **add the missing inline citation** to the prose (e.g. `([source](https://github.com/.../file.ts#L<n>-L<m>))` next to the claim) instead of weakening it; never edit `source:` directly — the inline citation IS the citation, `yarn autofix` keeps the frontmatter list in sync. Forbidden: replacing `[`formatPid()`](.../console-logger.service.ts#L417-L419)` with `[`formatPid()`](.../console-logger.service.ts)` because an auditor (incorrectly) said "real lines are L407-L409" — verify with `grep -n formatPid` first; the original anchor was right, the auditor was wrong. Forbidden: replacing "same `optional`/`default` ergonomics as `ParseIntPipe`" with a vague "see the pipes reference" because an auditor said the comparison wasn't in the cited sources — the comparison was true and verifiable from `parse-date.pipe.ts#L10-L31`; add that file to `source:` and keep the specific. Specificity > broadness; the audit is a hypothesis, not a verdict.
- **Reader-facing citations only**: cite surprising claims with normal links. Do not expose authoring audit wording in note bodies, such as "verified in", "checked against", "list verified against", raw repo paths as prose, approximate line-number notes, or scratchpad provenance. If a fact needs provenance, put the exact URL in `source:` or link the named API/docs naturally in prose.
- **Versions matter**: state the version when behavior is version-specific (e.g., "NestJS 10+", "class-validator 0.14"). Verify the claim still holds in the latest stable.
- **Unknowns are unknowns**: if you cannot verify a claim from primary sources within the session, do NOT write it. Leave a `// TODO: verify` placeholder or omit the section. Hallucinations are worse than gaps.
- **Code snippets**: copy from official docs or test against the actual package. Do not "reconstruct from memory". Mark adapted snippets as such.
- **Comparative claims are high-risk**: any wording of the form "same as X", "just like X", "X also accepts/returns Y", "mirrors X", "follows the X convention" is a hidden multi-source claim. It requires verifying BOTH X and the comparator against their primary sources before commit, not just the construct you're currently documenting. The natural failure mode is to verify the subject, write the analogy from memory about the comparator, and ship a confident-sounding lie. If you cannot verify the comparator in the same session, drop the comparison and link to the comparator's note instead.
- **Single source of truth for facts**: a fact about construct/feature X (interface signature, default value, behavior list) lives in X's note, not duplicated in adjacent notes that mention X. Cross-link instead. Duplicating the fact in note Y "because it's relevant" guarantees drift the next time X changes. When the user asks for an explanation in note Y that touches X, write the *Y-specific* framing in Y and link to X for the canonical signature/list/table.
- **Cite, don't hedge**: when an audit (or a reviewer) flags a claim as unsourced, the fix is to **add the missing primary-source link inline**, NOT to soften the claim into something unfalsifiable. The hedge reflex ("may apply", "broadly", "in some cases", "often", "tends to", "generally", "depending on") satisfies the auditor by removing information; the reader loses the specific they came for. Required shape for a cited specific: concrete claim + named API in backticks + parenthetical primary-source link with line anchor where the API is defined. Forbidden: replacing `gzip/deflate/brotli` with `gzip` to dodge a citation request, replacing `prompt offers npm/yarn/pnpm; bun missing` with `accepts a package-manager name`, replacing `getAllAndMerge returns an object (not a single-element array) when only one entry exists` with `sharper type inference`. Required: keep the specific, add `([source](https://github.com/.../file.ts#L<n>-L<m>))` next to it. Every audit-driven edit must either ADD information (a URL, a concrete API name, a line anchor) or stay the same length. Edits that subtract information are regressions even when the auditor goes green.

This rule applies to me (the agent) and to any sub-agent I delegate to. Pass this constraint explicitly when delegating research.

## Style

- English only.
- No em-dashes (`—`). Use `:` or rewrite the sentence.
- No `--` either.
- No filler ("In this guide, we will..."). Get to the example.
- NestJS HTTP notes are Express-first. Use Express imports/types in examples. Mention Fastify only when the adapter changes the implementation, usually as a gotcha or explicit adapter note.
- NestJS examples assume the **SWC** builder (see [[nestjs/recipes/swc-setup|SWC recipe]]). Show `nest start -b swc --type-check` (or the equivalent `nest-cli.json` config) when build commands appear. Mention `tsc` only as a fallback for known incompatibilities; mention `webpack` only in monorepo contexts where it's the CLI default.
- Conventional commits: `type: summary`. NO scope. Atomic commits, one logical change each.
- No commit body unless absolutely necessary. No co-author trailers.
- Quartz config: `enableSPA: false` (do not flip without testing the explorer redirects).

## Tagline (MANDATORY for every non-index note)

Every non-index note opens with a single `>` blockquote on the first body line, naming what the note is about in one sentence. No leading "In this note we...", no setup instructions before it, no `## Heading` before it. The tagline is what Quartz renders inside link popovers and what search uses for the result excerpt: it's the reader's first 2-second triage signal.

Forbidden: bare paragraph as the first body line ("How a request flows through a NestJS app..."). Required: prepend `> ` so the same sentence becomes a blockquote.

Forbidden: multi-paragraph tagline, or a tagline that doubles as a setup step. The tagline is *framing*, not content; if it's longer than one sentence, the second sentence belongs in the body.

Enforced by `npm run lint:wikilinks` (BLOCKING): the `tagline` check fails CI on any non-index note whose first non-empty body line does not start with `>`.

## Note titles

The explorer is the primary navigation surface; titles must scan as a parallel list within their folder, not as a wall of unique sentences. Rules:

- **Sentence case.** "Exception filters", not "Exception Filters".
- **Folder context is implicit; never repeat it.** A note under `nestjs/recipes/` does not start with "NestJS" or "Request"/"Response". Forbidden: "NestJS CLI monorepos" (folder is `nestjs/recipes/`), "Request validation with class-validator", "SWC builder for NestJS". Required: "Monorepos with the Nest CLI", "Validation with class-validator", "SWC builder".
- **Per-folder shape, parallel within the folder:**
  - **Recipes** (`nestjs/recipes/`): `<topic> with <tool>`, or just `<tool>` when the tool *is* the topic. The `<topic>` is the differentiating word and goes first so alphabetical sort groups by topic ("Validation with class-validator" sorts under V, not R for "Request").
  - **Fundamentals** (`nestjs/fundamentals/`): bare nouns or short noun phrases ("Guards", "Pipes", "Lifecycle hooks", "Global enhancers"). The long descriptor lives in the opening sentence, not the title.
  - **Releases** (`nestjs/releases/`): version only ("NestJS 11"). Any "what's new and what broke" framing belongs in the H1 subtitle / opening sentence.
  - **Reference / data** (`nestjs/data/`, `nestjs/auth/`): `<topic> with <tool>` like recipes when the tool dominates ("Caching with @nestjs/cache-manager", "JWT strategy with Passport"); gerund/noun form when the topic dominates ("Handling database errors", "PostgreSQL setup with TypeORM").
- **Differentiating word first.** "PostgreSQL setup with TypeORM" not "TypeORM PostgreSQL setup": readers scanning the explorer match on the first word.
- **Drop "the".** "Monorepos with the Nest CLI" only because removing "the" reads as a vague title; otherwise prefer no leading article.
- **Renames preserve searchability.** When changing a title, append the old title to `aliases` so search still resolves it and the wikilink linter's concept catalog still flags first-mention links from notes that reference the concept by its old name. For aliases that contain commas (e.g. an old descriptive title), use the **block form** (`aliases:\n  - "..."\n`) not the flow form `[...]` — flow-form parsing splits on commas and creates phantom aliases that match unrelated bare words in other notes' prose.

This applies to existing notes AND to any planned title scoped in `inbox.md` or anywhere else. When proposing a new note's path, also propose its final title against these rules.

## Callouts

Quartz renders Obsidian-style callouts (`> [!type]` / `> [!type]-` for collapsed). The vault uses **four types only**, with a defined intent for each. Picking the wrong type is a discoverability bug — the reader scans for visual hooks and learns to associate a color/icon with a kind of information. Inconsistency dilutes that signal.

Vocabulary (canonical):

| Type | Intent | Examples |
|------|--------|----------|
| `[!warning]` | Footgun, gotcha, silent failure mode, "X bypasses Y", "must do Z or breaks". | "`app.use()` loses DI", "Pass the class, not an instance", "Wildcard syntax changed since v11". |
| `[!info]` | Side-note explainer, cross-cutting fact, comparison, "how this works". Anything informational that isn't itself a warning or an example. | "How this works", "Class vs. instance binding", "No `ExceptionContext` in middleware". |
| `[!example]` | Worked-example snippet — runnable code with a one-line title that names what it demonstrates. The body is mostly a fenced code block. | "Recommended global setup", "Map a domain error to an HTTP status", "Per-route timeout". |
| `[!todo]` | Open review item the maintainer must revisit. See [Open review items in notes](#open-review-items-in-notes). | "Verify on TypeORM 0.4 release". |

**Forbidden** types (do not use, even though Obsidian/Quartz render them): `[!tip]`, `[!success]`, `[!question]`, `[!failure]`, `[!danger]`, `[!bug]`, `[!quote]`, `[!note]`, `[!abstract]`, `[!cite]`. Most overlap with one of the four above; using them fragments the visual vocabulary. Negative example: `> [!tip]- CommonJS vs ES modules` (this is a comparison, not actionable advice — `> [!info]-` is correct). Negative example: `> [!danger] Don't run migrations in production without a backup` (this is a footgun — `> [!warning]` is correct). If you find yourself reaching for a fifth type, the right move is almost always to split the content across two of the canonical four.

Open vs collapsed (`[!type]` vs `[!type]-`):

- **Open** (`[!type]` no trailing dash): the fact is **must-read at this point in the flow**. The reader cannot understand the next paragraph or skip the next snippet without internalizing it. Use sparingly: typically one open callout per major section, often at the top.
- **Collapsed** (`[!type]-`): an **enumerable** side-fact, gotcha, or worked example the reader can expand on demand. Most callouts are collapsed; long lists of footgun warnings or alternative examples should always be collapsed so the section's main flow stays scannable.

Negative example: `> [!warning]- Pass the class, not an instance` collapsed for the *primary* binding rule of a fundamentals note — the reader misses it and writes broken code. Required: open the canonical "pass the class" warning at the top of the binding section, collapse the secondary footguns ("BaseExceptionFilter cannot be `new`'d at route scope", etc.) below it.

No automated enforcement (callout intent is too subjective for a linter). Audit advisory: `grep -rE '^> \[!(tip|success|question|failure|danger|bug|quote|note|abstract|cite)\]' content/` should always return zero matches.

## Open review items in notes

When a note has a follow-up that is not blocking publication — verify against newer docs, expand once a planned recipe lands, double-check a behavior on the next release — mark it inline with a collapsed `todo` callout instead of leaving a TODO comment or opening an external tracker. Quartz/Obsidian render this natively.

```markdown
> [!todo]- Review on next NestJS release
> Confirm `getAllAndOverride` still returns `undefined` (not `null`) for missing metadata in v11.
```

Rules:

- Use `[!todo]-` (collapsed) so the reader doesn't trip on it; the maintainer expands during review sweeps.
- One concrete, actionable sentence. If it grows past two lines, it's no longer a polish item — promote it to a real edit or split it into a planned note.
- Greppable: `grep -rn "\[!todo\]" content/` lists every open item across the vault.
- Resolve or delete in the same PR that addresses the underlying concern. Do not let `[!todo]-` callouts accumulate as decoration.

## Code examples (MANDATORY)

Every TypeScript snippet that resembles a real file MUST be copy-pasteable as-is. Concretely:

1. **Always include all imports** the snippet uses (decorators, classes, RxJS operators, third-party modules). No "assume this is imported" — readers can't run partial code.
2. **Wrap class methods in their proper container.** A controller method goes inside `@Controller(...) export class FooController { ... }`. A module snippet goes inside `@Module({...}) export class FooModule {}`. No bare `@Get() foo() {}` floating outside a class.
3. **Show class fields and constructors that the example references.** If the body uses `this.store`, the field must be declared. If `this.config` is accessed, the constructor must inject it.
4. **No undefined references.** If a symbol appears (`UpdateCatDTO`, `AuditInterceptor`, `Guard1`), either it was defined earlier on the page, comes from an import, or has an inline comment pointing to where it's defined.
5. **Single-line illustrative fragments are OK** only when the surrounding prose makes the context unambiguous (e.g., showing one decorator usage right after the full class). When in doubt, write the full snippet.

When editing an existing snippet, audit the imports too — adding a new symbol means adding its import.

## When you finish

- Run `cd quartz && npx quartz build --serve -d ../content` if you changed plugins or config. Skip for content-only edits unless requested.
- ALWAYS run ALL local linters before each content commit; CI runs them and will fail the push otherwise. Three checks, all blocking: `lint:wikilinks` (broken links, asymmetric `related:`, backticks-in-wikilinks, etc.), `lint:content` (Pass-0: em-dashes, `--`), and `lint:format` (Prettier on `content/`). Forbidden: committing after running only a subset. One-liner from repo root:

  ```bash
  (cd quartz && npm run lint:wikilinks) && (cd scripts/audit-notes && yarn lint:content && yarn lint:format)
  ```

  All three must pass before `git commit`. If formatting fails, run `yarn format` (in `scripts/audit-notes/`) to auto-fix. Prettier ignores `quartz/` (the framework manages its own format) and the top-level docs (`AGENTS.md`, `CLAUDE.md`, `README.md`); see `.prettierignore`. If a commit slips through with a lint failure, the next commit fixes it; do not chain more content edits on top of a red CI.
- **Frontmatter `source:` is auto-maintained** by the linter rule `source-list-completeness` (BLOCKING) plus `yarn autofix` (in `scripts/audit-notes/`). The contract is bidirectional: every URL in `source:` must appear somewhere in the body, and every inline primary-source URL must appear in `source:` (the existing `inline-source-citations` rule). Workflow: cite primary sources **inline** in prose with the precise anchor (`#L<m>-L<n>` or `#section`); run `yarn autofix` (no args walks `content/`) and it strips any `source:` URL not referenced in the body. Forbidden: editing `source:` by hand to satisfy an audit finding. Adding a URL to `source:` that does not appear inline is a phantom citation: the linter catches it at commit time, the autofixer strips it, and the underlying claim still has no reader-visible source. The single source of truth for which URLs back a note is the inline citations.
- After editing any `source:` frontmatter or adding inline citations to GitHub blob URLs, run `scripts/check-source-urls.sh` from the repo root. It HEADs every `https://github.com/<owner>/<repo>/blob/<ref>/<path>` URL through `raw.githubusercontent.com` and fails on any 404. Local-only (network-dependent, hits GitHub's 60 req/hr unauth limit so unsuited for CI). Forbidden: skipping this after touching frontmatter URLs — typos like `parse-file-pipe-builder.ts` (real path: `parse-file-pipe.builder.ts`) sail past every other lint and only surface as silent gaps in the LLM audit's source verification.
- Commit. Do NOT push: pushing is the user's call.
- After committing any change under `content/`, run the LLM audit on the touched files and surface findings in chat for triage. CI no longer runs this; it's a chat-driven step:

  ```bash
  set -a; source .env; set +a   # loads CURSOR_API_KEY (gitignored)
  cd scripts/audit-notes
  yarn start --json ../../content/<path>.md [more.md ...] > /tmp/audit.json 2> /tmp/audit.err
  ```

  Diff-aware variant: pass `--base <ref>` to audit only the markdown files changed since `<ref>` (committed + staged + unstaged). Useful for "audit my last commit" (`--base HEAD~1`) or "audit everything since main diverged" (`--base origin/main`). Cuts cost on full-vault re-runs:

  ```bash
  yarn start --json --base HEAD~1 > /tmp/audit.json 2> /tmp/audit.err
  ```

  Source verification (audit N) is **always on**: the audit fetches each touched note's `source:` URLs and flags claims that the cited sources don't support. The flag to disable it has been removed; the script exits non-zero if `CURSOR_API_KEY` is missing or invalid. A deterministic **Pass 1c (anchor verifier)** runs after source verification: for any `source-verification` finding whose complaint is "wrong GitHub line anchor" (`L<m>-L<n>` claim), it fetches the cited file and checks whether the symbol named in the note's link text is actually defined within the original anchor's range. If yes, the finding is dropped automatically as a false positive (logged as `[pass-1c] anchor-verifier dropped N false-positive(s)`). This catches the most common LLM hallucination empirically (~50% FP rate on anchor claims) before it reaches human triage. A second deterministic **Pass 1d (fact-grounding)** runs after Pass 1c: for any finding emitted as `Not supported by cited sources: ...`, it extracts high-information terms from the claim (backtick-fenced spans, identifiers, version numbers) and substring-greps them across the on-disk cache of source extracts. If ALL terms appear in at least one cached source body, the LLM missed the supporting text and the finding is dropped (logged as `[pass-1d] fact-grounding dropped N false-positive(s)`). Conservative: never touches `Contradicts` findings, never touches `Plausible but unsourced` findings (those are advisory by design — see below), keeps when fewer than 2 terms can be extracted. Source-verification findings now ship in three flavors: `Contradicts cited sources: ...` (high-tier blocker), `Not supported by cited sources: ...` (high-tier blocker), and `Plausible but unsourced: ... Suggested source: <URL>` (advisory — the action is "add the URL to `source:`", not "rewrite the prose"). Then read `/tmp/audit.json` and triage: deterministic Pass-0 findings (em-dash, double-hyphen) get fixed in the next commit; high-tier LLM findings (including `source-verification`) get reviewed and fixed if valid; advisory findings are dismissable. High-tier findings carry a `suggestedFix: {kind, before, after, primarySource, rationale}` field when Pass 3 (fix-proposer) was able to produce one. The proposer is instructed to obey "Cite, don't hedge" and to decline rather than soften, so when `suggestedFix` is present it's a starting point for the three-gate review; absent fix means the proposer declined and the human writes the fix from scratch. Either way the fix is still a suggestion, still subject to the three-gate test.
- **Audit findings are suggestions, not mandates — verify EVERY one, treat false positives as the default risk**: every LLM-generated finding (Pass 1, Pass 2, and `suggestedFix` from Pass 3) is a hypothesis about a possible defect, NOT a proven bug. Empirically the false-positive rate on specific-anchor and "claim not supported" findings is high enough that **mechanical application is the single biggest source of regressions in this repo's audit loop**. One concrete batch: 5 of 9 high-tier findings I applied were false positives (`formatPid` real range L417-L419 not L407-L409; `loadSwcCliBinary` real range L198-L200 not L215; `"webpack": true` IS set by `sub-app.factory.ts#L358`; `ParseDatePipe`/`ParseIntPipe` ergonomics IS in `parse-date.pipe.ts#L10-L31`). The cost of a false positive is a deleted specific that took real research to produce; the cost of a missed true positive is one more audit cycle. **Bias HARD toward keeping the original.** Required workflow on every finding before applying: (1) fetch the cited file/range with `curl -s <raw-url> | grep -n '<symbol>'` and `sed -n '<a>,<b>p'` — if the original anchor was correct, RESTORE and ignore the finding; if wrong, replace with the verified correct anchor (NEVER drop to a bare URL); (2) for "claim not supported" findings, check whether the claim is true but the supporting URL isn't cited inline yet — if so, ADD the inline citation `([source](URL))` to the prose and keep the claim (`yarn autofix` will sync `source:`); never edit `source:` by hand; (3) confirm the fix preserves or adds information (cite-don't-hedge); (4) confirm the change is worth the diff. **Dismiss findings that fail any gate without guilt** and without a code-side suppression: the audit will re-flag if the underlying concern recurs, which is the right time to revisit. Forbidden: applying a finding mechanically because it's in the JSON. Forbidden: softening a true claim to a vague one because the auditor (incorrectly) said it wasn't sourced. Required: when applying, log the verification in the commit message or chat ("audit flagged X; verified file Y at L<n>-L<m>; original was correct/wrong; applied as Z") so the next pass over the same file knows it's been triaged.
- **Verify EVERY finding against primary sources before classifying it as dismissable** (same rigor as before applying). Eyeballing a message and concluding "auditor probably hallucinated" or "the cited file probably proves this" is the false-positive analogue of mechanical application: it buries real bugs (one concrete batch: I triaged 14 advisories from "looks plausible" without fetching, and 3 of them — `global-providers.md` testing-override, `exception-filters.md` rethrow-chain, `request-lifecycle.md` rethrow-chain — were actual prose bugs that primary-source verification caught; another 4 needed source-list additions, not dismissals). Required workflow on every finding before deciding the verdict (same shape as the apply-side workflow, executed earlier in the loop): (1) fetch the suggested source URL and the URLs already in the note's `source:` list with `curl -sL <raw-url> | grep -niE '<term1>|<term2>'`; (2) classify into one of four buckets — **TRUE-and-cited** (claim is supported by a URL already in `source:`; auditor extract failed, dismiss with the verifying URL named in the dismissal `reason`), **TRUE-but-uncited-inline** (claim is supported by a URL but never cited inline next to the claim; ADD the inline citation `([source](URL))` to the prose, do NOT dismiss — the audit's job is to make this gap visible; `yarn autofix` keeps `source:` in sync, never edit it by hand), **WRONG-claim** (primary source contradicts the prose; FIX the prose with a citation to the contradicting source), **UNVERIFIABLE** (no usable primary source within the session; leave the advisory in place as a `// TODO: verify` and dismiss with `reason: "no primary source available; revisit"`); (3) only after one of those four buckets is chosen, take the action. Forbidden: dismissing in chat triage on the basis of "follows from cited files" without actually grepping the cited files. Forbidden: dismissing on the basis of "auditor extract probably failed" without re-fetching the URL the auditor flagged. Required: every dismissal `reason` field names the file/anchor that was actually checked (e.g. "verified at `provider-scopes.md#L152`: '~5% latency-wise' is the exact wording"), not just "false positive" or "already cited".
- **Persisted dismissals**: when an advisory or high-tier finding has been triaged and rejected (rule misapplication, already-cited claim the auditor missed, literal-not-hedge phrasing, callout-scope exclusion, etc.) and the underlying line is unlikely to change soon, record it in `scripts/audit-notes/dismissed.json` so future audit runs auto-suppress it. Each entry is `{path, sig, rule, reason, date, originalLine}` where `sig = sha1(path + "\0" + rule + "\0" + trimmed line text)`. The signature is content-addressed: it survives line-number drift but **re-fires when the prose is rewritten**, which is the right time to re-evaluate. The audit pipeline filters before emitting the final tiered report and logs every suppression as `[dismissed] suppressed N previously-triaged finding(s)` with the original rationale, so the audit trail stays visible. Generate a new entry by running a small node one-liner that reads the line at `path:line`, hashes it, and appends to the JSON (see commit history for the seed batch). Forbidden: dismissing a finding by silently ignoring it in chat triage when the same finding will obviously re-appear on the next full-vault run — that wastes future-you's triage cycles. Forbidden: dismissing high-tier `Contradicts` findings without a written verification chain in the `reason` field (these are the highest-signal class; if you're dismissing one, the reason needs to explain why the auditor was wrong, not just "false positive"). The dismissal file is checked in so triage state is shared across machines and rebuilds.
- If the user asks to push, GitHub Pages rebuilds in 1-2 minutes.
- If you established a new convention, update this file in the same commit.

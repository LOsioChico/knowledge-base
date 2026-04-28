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

A personal Quartz v4 knowledge base, deployed to https://losiochico.github.io/knowledge-base. Single author, multi-agent editors. Source markdown lives under `content/`. Quartz config is `quartz.config.ts`. Static assets shipped as-is from `quartz/static/`.

## Folder layout

```
content/
  index.md                       # vault home + areas list (top-level MOC)
  <area>/
    index.md                     # area MOC, MANDATORY for every area
    <subarea>/
      index.md                   # sub-area MOC if the subarea has 3+ notes
      <note>.md                  # atomic note, one concept per file
quartz/static/                   # site-level static assets (favicon, og image, etc.)
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

- `tech/typescript`, `tech/rxjs`, `tech/multer`, `tech/http`, `tech/class-validator`, `tech/class-transformer`, `tech/asynclocalstorage`, `tech/nest-cli`, `tech/kafka` (reserved), `tech/prisma` (reserved), `tech/jwt` (reserved)

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
- **Listing-completeness rule** (same linter): every note under an indexed sub-folder (currently `nestjs/recipes/`) MUST appear in the area `index.md`. Add new indexed folders to the `INDEXED_FOLDERS` array in `scripts/lint-wikilinks.mjs`.- **Discoverability rule** (same linter, BLOCKING): every pair of notes whose TF-IDF cosine similarity is ≥ 0.20 MUST be connected — either via `related:` (either direction), a body wikilink (either direction), or an explicit `unrelated:` opt-out (either direction). This is the safety net for "you don't know what you don't know": when you write a new note, the linter compares it against every existing note and flags semantic neighbors you didn't realize existed. Resolution is one of three: (1) add the missing `related:` link both ways, (2) add a body wikilink at first mention, or (3) if the overlap is genuinely coincidental (shared vocabulary, different topic), declare it via `unrelated:` on either side. **You cannot ignore the warning** — every above-threshold pair must be acknowledged. Threshold (0.20) was calibrated against the natural similarity cliff in the current vault; revisit if the false-positive rate grows. Algorithm details: title × 3 + aliases × 2 + masked body × 1, smoothed IDF, ~120 English stopwords, `index` notes excluded.
- **Agents-mirror rule** (same linter, BLOCKING): `.github/copilot-instructions.md` MUST be a byte-identical copy of `AGENTS.md`. The mirror exists so VS Code Copilot Chat (which reads `.github/copilot-instructions.md` universally) gets the same conventions as agentic flows that read `AGENTS.md`. After any edit to `AGENTS.md`, run `cp AGENTS.md .github/copilot-instructions.md` and commit both. The linter fails CI on drift.
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

## Sourcing rule (NON-NEGOTIABLE)

Never write a technical claim from training-data memory. Every fact MUST be verified against primary sources at the moment of writing.

- **Primary sources first**: official docs, official repo source code, official RFCs/specs, package READMEs on npm/GitHub. Never a blog, never Stack Overflow, never another LLM's output.
- **Cross-check**: at least two independent primary sources for any non-trivial claim (signature, default value, behavior, package name, version-specific feature). One source is not enough.
- **Cite in `source:`**: every note's frontmatter `source:` list MUST contain the exact URLs consulted. If a section was added later, append the URL that backs it. No URL, no claim.
- **Inline link for surprising claims**: if a fact is counterintuitive or version-specific, link the source inline next to the claim, not just in frontmatter.
- **Reader-facing citations only**: cite surprising claims with normal links. Do not expose authoring audit wording in note bodies, such as "verified in", "checked against", "list verified against", raw repo paths as prose, approximate line-number notes, or scratchpad provenance. If a fact needs provenance, put the exact URL in `source:` or link the named API/docs naturally in prose.
- **Versions matter**: state the version when behavior is version-specific (e.g., "NestJS 10+", "class-validator 0.14"). Verify the claim still holds in the latest stable.
- **Unknowns are unknowns**: if you cannot verify a claim from primary sources within the session, do NOT write it. Leave a `// TODO: verify` placeholder or omit the section. Hallucinations are worse than gaps.
- **Code snippets**: copy from official docs or test against the actual package. Do not "reconstruct from memory". Mark adapted snippets as such.

This rule applies to me (the agent) and to any sub-agent I delegate to. Pass this constraint explicitly when delegating research.

## Style

- English only.
- No em-dashes (`—`). Use `:` or rewrite the sentence.
- No `--` either.
- No filler ("In this guide, we will..."). Get to the example.
- NestJS HTTP notes are Express-first. Use Express imports/types in examples. Mention Fastify only when the adapter changes the implementation, usually as a gotcha or explicit adapter note.
- Conventional commits: `type: summary`. NO scope. Atomic commits, one logical change each.
- No commit body unless absolutely necessary. No co-author trailers.
- Quartz config: `enableSPA: false` (do not flip without testing the explorer redirects).

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

- Run `npx quartz build --serve` if you changed plugins or config. Skip for content-only edits unless requested.
- Commit. Push to `main`. GitHub Pages rebuilds in 1-2 minutes.
- If you established a new convention, update this file in the same commit.

# AGENTS.md

Operating contract for any AI agent (Copilot CLI, Claude Code, Cursor, etc.) editing this knowledge base. Read this file end-to-end before touching any note. Nearest `AGENTS.md` wins; this is the root.

## What this repo is

A personal Quartz v4 knowledge base, deployed to https://losiochico.github.io/knowledge-base. Single author, multi-agent editors. Source markdown lives under `content/`. Quartz config is `quartz.config.ts`. Static assets shipped as-is from `quartz/static/` (this is where `llms.txt` lives).

## Folder layout

```
content/
  index.md                       # vault home + areas list (top-level MOC)
  <area>/
    index.md                     # area MOC, MANDATORY for every area
    <subarea>/
      index.md                   # sub-area MOC if the subarea has 3+ notes
      <note>.md                  # atomic note, one concept per file
quartz/static/llms.txt           # LLM entrypoint, regenerated on structural change
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
status: evergreen          # seed | draft | evergreen | archived
related:
  - "[[path/to/note-a]]"
  - "[[path/to/note-b]]"
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

- `tech/typescript`, `tech/rxjs`, `tech/multer`, `tech/http`, `tech/kafka` (reserved), `tech/prisma` (reserved), `tech/jwt` (reserved)

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

# 6. Check the LLM index for anything you missed
bat quartz/static/llms.txt
```

Only after those six steps may you draft the note. Then:

7. Add the note with the full frontmatter schema.
8. Update `related:` in EVERY note you linked from.
9. Update the closest `index.md` MOC and, if a new area, `content/index.md`.
10. Update `quartz/static/llms.txt` so the new note is discoverable to LLMs.

Skipping any step is a bug.

## Linking rules

- Body links use Obsidian wikilinks: `[[nestjs/fundamentals/guards|Guards]]`. Quartz renders these and emits backlinks automatically.
- `related:` frontmatter uses the same wikilink syntax inside quotes: `"[[nestjs/fundamentals/guards]]"`.
- Bidirectional by default — and **enforced by `npm run lint:wikilinks`**. If A `related:` B, then B `related:` A. The linter resolves partial wikilinks (e.g. `[[guards]]` → `nestjs/fundamentals/guards`) and exempts `index` notes (they're indices, not peers). CI blocks merges on asymmetric `related:` links.
- **Known limitation of forced symmetry**: `related:` currently collapses three distinct relationships (peer ↔ peer, recipe → fundamental prerequisite, fundamental → recipes-that-use-it) into one symmetric field. This is fine at the current vault size but will cause noise on fundamentals that get many dependents. When that starts to hurt (a fundamental's `related:` block becomes longer than its own content, ~10+ dependents), split the contract: keep `related:` for symmetric peers, add `prerequisites:` for asymmetric "you need to read this first" links (linter would NOT require back-references on `prerequisites:`). Don't pre-emptively split — wait for the friction.
- **First-mention wikilink rule** (enforced by `npm run lint:wikilinks`): the FIRST time a concept that has its own note appears in the body of another note, it MUST be a wikilink, not plain text. Subsequent mentions in the same note can stay plain. Code identifiers (e.g. `FileInterceptor`, `ParseFilePipe`) are not concepts; the underlying concept (`[[nestjs/fundamentals/interceptors|interceptor]]`, `[[nestjs/fundamentals/pipes|pipe]]`) is. The linter scans every note's title + aliases + filename to build the concept catalog, then checks every other note's body for unlinked first mentions. CI blocks merges on violations.
- **Listing-completeness rule** (same linter): every note under an indexed sub-folder (currently `nestjs/recipes/`) MUST appear in the area `index.md` AND in `quartz/static/llms.txt`. Add new indexed folders to the `INDEXED_FOLDERS` array in `scripts/lint-wikilinks.mjs`.
- A note never wikilinks to itself. Self-mentions stay plain.
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

## Sourcing rule (NON-NEGOTIABLE)

Never write a technical claim from training-data memory. Every fact MUST be verified against primary sources at the moment of writing.

- **Primary sources first**: official docs, official repo source code, official RFCs/specs, package READMEs on npm/GitHub. Never a blog, never Stack Overflow, never another LLM's output.
- **Cross-check**: at least two independent primary sources for any non-trivial claim (signature, default value, behavior, package name, version-specific feature). One source is not enough.
- **Cite in `source:`**: every note's frontmatter `source:` list MUST contain the exact URLs consulted. If a section was added later, append the URL that backs it. No URL, no claim.
- **Inline link for surprising claims**: if a fact is counterintuitive or version-specific, link the source inline next to the claim, not just in frontmatter.
- **Versions matter**: state the version when behavior is version-specific (e.g., "NestJS 10+", "class-validator 0.14"). Verify the claim still holds in the latest stable.
- **Unknowns are unknowns**: if you cannot verify a claim from primary sources within the session, do NOT write it. Leave a `// TODO: verify` placeholder or omit the section. Hallucinations are worse than gaps.
- **Code snippets**: copy from official docs or test against the actual package. Do not "reconstruct from memory". Mark adapted snippets as such.

This rule applies to me (the agent) and to any sub-agent I delegate to. Pass this constraint explicitly when delegating research.

## Style

- English only.
- No em-dashes (`—`). Use `:` or rewrite the sentence.
- No `--` either.
- No filler ("In this guide, we will..."). Get to the example.
- Conventional commits: `type: summary`. NO scope. Atomic commits, one logical change each.
- No commit body unless absolutely necessary. No co-author trailers.
- Quartz config: `enableSPA: false` (do not flip without testing the explorer redirects).

## Code examples (MANDATORY)

Every TypeScript snippet that resembles a real file MUST be copy-pasteable as-is. Concretely:

1. **Always include all imports** the snippet uses (decorators, classes, RxJS operators, third-party modules). No "assume this is imported" — readers can't run partial code.
2. **Wrap class methods in their proper container.** A controller method goes inside `@Controller(...) export class FooController { ... }`. A module snippet goes inside `@Module({...}) export class FooModule {}`. No bare `@Get() foo() {}` floating outside a class.
3. **Show class fields and constructors that the example references.** If the body uses `this.store`, the field must be declared. If `this.config` is accessed, the constructor must inject it.
4. **No undefined references.** If a symbol appears (`UpdateCatDTO`, `AuditInterceptor`, `Guard1`), either it was defined earlier on the page, comes from an import, or has an inline comment pointing to where it's defined.
5. **Single-line illustrative fragments are OK** only when the surrounding prose makes the context unambiguous (e.g., showing one decorator usage right after the full class). When in doubt, write the full snippet.

When editing an existing snippet, audit the imports too — adding a new symbol means adding its import.

## LLM ingest layer

`quartz/static/llms.txt` follows the https://llmstxt.org spec. It is the canonical entrypoint for any LLM that needs the whole vault. When you add or remove a note, update it in the same commit.

If the vault grows past ~50 notes and grep starts missing things, add a local embedding index (see `prioritized roadmap` in the research notes for this session). Until then, the deterministic source of truth is: **MOCs + tags + `related:` + this ritual**.

## When you finish

- Run `npx quartz build --serve` if you changed plugins or config. Skip for content-only edits unless requested.
- Commit. Push to `main`. GitHub Pages rebuilds in 1-2 minutes.
- If you established a new convention, update this file in the same commit.

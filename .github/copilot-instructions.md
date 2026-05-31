# AGENTS.md

> **Step 6: AI Editing Operating Contract**: Strict repository invariants, automated and manual auditing procedures (A-P, S1-S6), show-dont-tell rules, and behavior-in-snippet verification patterns. Prerequisite: [Step 5: CI/CD Quality Gates & Deployments](docs/PIPELINE.md); next step: none.

Operating contract for any AI agent (Copilot CLI, Claude Code, Cursor, etc.) editing this knowledge base. Read this file end-to-end before touching any note. Nearest `AGENTS.md` wins; this is the root.

## The Instant Clarity Principle (North Star)

**Every element in a note exists to make a concept *instantly graspable* to someone who knows nothing. If it doesn't, it's noise — no matter how beautiful it is.**

This is the principal goal of this knowledge base. Every other rule in this file, every skill, every audit, and every component serves this principle. Before finishing any work on a note, answer these three questions:

1. **Does it teach from zero?** No assumed context. The pedagogical order is always: concept explanation → code example → interactive demo. Never put a demo before the reader has the mental model to understand it. If a component references terms the reader hasn't seen yet, move it after those terms are introduced.
2. **Does each piece earn its place?** Mentally remove every section, callout, table, and component. If the note is equally clear without it, delete it. Visual beauty and technical impressiveness are worth zero if they don't accelerate understanding.
3. **Is it self-explaining?** Every interactive component, diagram, and code block must be understandable without reading the surrounding prose. If a widget needs external explanation to make sense, the widget is broken — fix it or remove it.

**The litmus test**: If a reader who knows nothing about the topic can't understand what they're looking at within 10 seconds of seeing it, the element has failed.

## Surface choices, don't pick silently

When a request has plausibly different interpretations, name the options in one sentence and pick a default: don't commit to one silently. Cheap to ask, expensive to undo.

## What this repo is

A personal knowledge base deployed to https://losiochico.github.io/knowledge-base. Single author, multi-agent editors.

**Published site (canonical):** Astro Starlight MDX under `sites/docs/src/content/docs/`. CI builds `sites/docs/dist/` and deploys to GitHub Pages. All notes are **MDX-only**.

Edit `.github/workflows/deploy.yml` for deploy changes.

## Folder layout

```
sites/docs/src/content/docs/     # Active Starlight MDX notes (100% of content)
  index.mdx                      # Home + areas list (top-level MOC)
  <area>/
    index.mdx                    # Area MOC, MANDATORY for every area
    <subarea>/
      index.mdx                  # Sub-area MOC if the subarea has 3+ notes
      <note>.mdx                 # Atomic note, one concept per file
sites/docs/src/components/interactive/ # Custom interactive Astro components (README.md has full API)
docs/                            # PUBLISHING.md, STARLIGHT-FEATURES.md, PIPELINE.md, AUDIT-PIPELINE.md, LINTER-RULES.md
scripts/                         # MDX linters, audit tooling
.github/workflows/deploy.yml     # lint → starlight build → Pages
```

Rules:

- One concept per file. Split when a note covers two distinct concepts that can stand alone, not based on line count.
- Every folder under `sites/docs/src/content/docs/` MUST have an `index.mdx` (its MOC).
- File names: kebab-case, descriptive nouns (`request-lifecycle.mdx`, not `req-lc.mdx`).
- No orphans. A note that nothing links to is a bug.

## Skills directory (MANDATORY routing)

All agent skills live under `.github/skills/<name>/SKILL.md`. **Before starting any task, scan this table and load EVERY skill whose trigger matches your task.**

### Authoring (load when editing notes)

| Skill | Trigger | What it covers |
|-------|---------|----------------|
| [`kb-author`](.github/skills/kb-author/SKILL.md) | Any note edit, MDX authoring, `sites/docs/` work | Discovery ritual, audits A-P and S1-S6, publish workflow, note-type standards, sourcing details. **Load on every note edit.** |
| [`kb-enrichment`](.github/skills/kb-enrichment/SKILL.md) | Adding/auditing interactive components | Component selection framework (Q1-Q10), validation, anti-patterns, placement rules. API reference in [`README.md`](sites/docs/src/components/interactive/README.md). |
| [`kb-research-author`](.github/skills/kb-research-author/SKILL.md) | Researching unfamiliar topics, writing new notes from scratch | Research → verify against primary docs → prepare audit-clean MDX. |

### Intake & Auditing

| Skill | Trigger | What it covers |
|-------|---------|----------------|
| [`kb-algomaster-intake`](.github/skills/kb-algomaster-intake/SKILL.md) | Extracting AlgoMaster system-design pages | Safe extraction into local Markdown before verification. |
| [`kb-audit-triage`](.github/skills/kb-audit-triage/SKILL.md) | Running audit pipeline, triaging findings | End-to-end loop: run pipeline → classify findings → apply or persist to `dismissed.json`. |

### Skill loading rules

1. **Match by trigger, not by name.** If your current task matches ANY trigger, load that skill.
2. **Multiple skills can apply.** Adding a component to a note? Load BOTH `kb-author` AND `kb-enrichment`.
3. **Skills are progressive.** Read only the sections relevant to your task.
4. **AGENTS.md wins on conflict.** Skills are playbooks; this file owns the invariants.

Full skill and tooling inventory: [`docs/TOOLING.md`](docs/TOOLING.md).

## Frontmatter schema (required)

Every `.mdx` under `sites/docs/src/content/docs/` MUST start with:

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
- `aliases`: required if there are common synonyms.
- `tags`: required. Use the controlled vocabulary below. **Do not tag with the area** — the folder encodes that.
- `area`: required. Matches the top-level folder. Used by tooling.
- `status`: required. Default `evergreen` once the note is real.
- `related`: required. Wikilinks to every directly-related note. Both directions: when you add a new note, update `related:` in notes you linked from.
- `unrelated`: optional. Silence the discoverability linter for a specific pair you've considered and rejected.
- `source`: optional but strongly preferred when the note distills external docs.

## Controlled tag vocabulary

Tags are namespaced. Do not invent free-form tags. Add new ones here in the same commit.

- **`area/*` — DO NOT USE AS A TAG.** The folder encodes the area; `area:` frontmatter is for tooling.

### `type/*` (note kind)

`type/moc` | `type/concept` | `type/recipe` | `type/pattern` | `type/gotcha` | `type/reference`

### `tech/*` (specific technology)

`tech/typescript`, `tech/rxjs`, `tech/multer`, `tech/http`, `tech/class-validator`, `tech/class-transformer`, `tech/asynclocalstorage`, `tech/nest-cli`, `tech/typeorm`, `tech/postgres`, `tech/kafka` (reserved), `tech/prisma` (reserved), `tech/jwt` (reserved), `tech/aws`, `tech/aws-cli`, `tech/eventbridge`, `tech/cloudfront`, `tech/amplify`, `tech/rds`, `tech/iam`, `tech/acm`, `tech/s3`, `tech/ec2`, `tech/lambda`, `tech/secrets-manager`, `tech/kms`, `tech/sts`, `tech/route53`, `tech/dynamodb`, `tech/sqs`, `tech/sns`, `tech/vpc`, `tech/ecs`, `tech/effect-ts`

### Cross-cutting concepts

`lifecycle`, `events`, `cqrs`, `messaging`, `streaming`, `validation`, `errors`, `gotchas`

`gotchas` tag = note CONTAINS a substantive gotchas section. `type/gotcha` = the note IS a single footgun.

## Linking rules

- Body links use Obsidian wikilinks: `[[nestjs/fundamentals/guards|Guards]]`.
- `related:` uses the same syntax in quotes: `"[[nestjs/fundamentals/guards]]"`.
- **Bidirectional by default.** If A `related:` B, then B `related:` A. Enforced by `bun run lint:wikilinks`.
- **First-mention rule**: the FIRST time a concept with its own note appears in body text, it MUST be a wikilink. Subsequent mentions stay plain.
- **No backticks inside `[[ ]]`**: wikilink display text is plain text.
- A note never wikilinks to itself. In-note cross-references use `[label](#slug)`.
- **Reference-table linking**: rows with worked examples MUST link to those examples.
- `related:` is the safety net (machine-readable), wikilinks are the surface (reader-facing). Both must agree.
- Avoid stub links to non-existent notes. Mark future notes: `[[topic|Topic (planned)]]`.

For detailed linter enforcement rules (discoverability algorithm, cross-area wikilinks, table wikilink prohibition, prerequisite badges, agents-mirror, etc.), see [`docs/LINTER-RULES.md`](docs/LINTER-RULES.md).

## Sourcing rule (NON-NEGOTIABLE)

Never write a technical claim from training-data memory. Every fact MUST be verified against primary sources at the moment of writing.

1. **Primary sources back every claim**: official docs, repo source code, RFCs/specs, package READMEs. Cite in `source:` frontmatter and inline for surprising claims.
2. **Secondary sources are inspiration, not citation**: blogs, courses, Stack Overflow surface topics. Every fact taken from them MUST be re-verified against a primary source. Credit framing influence in `## See also`, never in `source:`.
3. **Comparative claims require verifying both sides.** "Same as X" requires checking X too. If you can't verify the comparator, drop the comparison and link instead.
4. **Unknowns are unknowns.** If you cannot verify a claim, do NOT write it. Gaps > hallucinations.

For expanded sourcing guidance (cite-don't-hedge, don't-soften-specifics, citation precision, code snippets from docs), see [`kb-author` Audit E](.github/skills/kb-author/SKILL.md).

## Code examples (MANDATORY)

Every TypeScript snippet MUST be copy-pasteable:

1. Include all imports the snippet uses.
2. Wrap class methods in their proper container (`@Controller`, `@Module`, `@Injectable`).
3. Show class fields and constructors that the example references.
4. No undefined references. Every symbol is defined, imported, or commented.
5. Single-line fragments are OK when context is unambiguous.

## Style

- English only.
- No em-dashes (`—`) or `--`. Use `:` or rewrite.
- No filler ("In this guide, we will..."). Get to the example.
- NestJS HTTP notes are Express-first. Mention Fastify only when the adapter changes the implementation.
- NestJS examples assume the **SWC** builder.
- Conventional commits: `type: summary`. NO scope. Atomic, one logical change each.

## Tagline (MANDATORY for every non-index note)

Every non-index note opens with a single `>` blockquote naming what the note is about. No leading "In this note...", no setup instructions before it. Enforced by `bun run lint:wikilinks`.

## Note titles

- **Sentence case.** "Exception filters", not "Exception Filters".
- **Folder context is implicit.** A note under `nestjs/recipes/` does not start with "NestJS".
- **Differentiating word first.** "PostgreSQL setup with TypeORM" not "TypeORM PostgreSQL setup".

Per-folder naming conventions (Recipes, Fundamentals, Releases, Reference) are in [`kb-author`](.github/skills/kb-author/SKILL.md).

## Callouts

Four types only. Picking the wrong type is a discoverability bug.

| Type | Intent |
|------|--------|
| `[!warning]` | Footgun, gotcha, silent failure mode |
| `[!info]` | Side-note explainer, comparison, "how this works" |
| `[!example]` | Worked-example snippet with a one-line title |
| `[!todo]` | Open review item the maintainer must revisit (always collapsed) |

All other types (`[!tip]`, `[!success]`, `[!danger]`, etc.) are **forbidden**. Use MDX `<Aside>` for Starlight pages.

- **Open** (`[!type]`): must-read at this point. Use sparingly.
- **Collapsed** (`[!type]-`): expandable side-fact. Most callouts are collapsed.

## Open review items

Use `[!todo]-` (collapsed) for follow-ups that don't block publication. One concrete, actionable sentence. Resolve or delete in the PR that addresses the concern.

## Third-party intake policy

Courses and books are topic-surface inventory, not primary sources. Extract temporarily to `tmp/`, verify every claim against official docs, draft with original structure, cite only primary sources in `source:`. Details in [`kb-research-author`](.github/skills/kb-research-author/SKILL.md).

## When you finish

- Commit only when explicitly asked. Do NOT push.
- Run `bun run lint:ci` before push. Run `bun run lint:docs && bun run docs:build` after MDX edits.
- Mirror after any edit: `cp AGENTS.md .github/copilot-instructions.md`.
- If you established a new convention, update this file in the same commit.

Full audit pipeline, profiles, triage workflow, and `dismissed.json` mechanics: [`docs/AUDIT-PIPELINE.md`](docs/AUDIT-PIPELINE.md).

Session context hygiene and SkillOpt self-evolution: [`docs/SKILLOPT.md`](docs/SKILLOPT.md).

## Learned User Preferences

- Commit only when the user explicitly asks; do not push unless they ask.
- When the user says to verify first, run the full lint and test suite before committing tooling changes.
- Published MDX recipes must explain why before each bash fence and what to verify in output.
- Starlight MDX pages re-author and enrich content page-by-page; do not bulk-copy or over-compress.

## Learned Workspace Facts

- Engram MCP is configured for this repo with project id `knowledge-base`.
- CodeGraph: `.codegraph/config.json`; init with `npx @colbymchenry/codegraph init -i`.
- OpenSpec SDD config: `openspec/config.yaml` (`strict_tdd: false`; verify with `bun run lint:ci && bun run test:ci`).
- Published site: `sites/docs/` (base `/knowledge-base`) is canonical. 100% MDX-only.

---

**Reminder (sandwich reinforcement):** Every rule above serves the **Instant Clarity Principle**. If a note element doesn't make its concept instantly graspable to someone who knows nothing, it's noise — fix it or remove it.

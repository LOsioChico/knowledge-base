---
name: kb-author
description: >
  Authoring and publish workflow for this knowledge base. Published site is Starlight MDX under
  sites/docs/ (canonical). Covers discovery
  (A–P), Starlight MDX authoring (S1–S6), sourcing, and audit triage. Use for any note edit, MDX
  publish, or "write a recipe". Triggers: edit a note, author MDX, sites/docs, MDX, /kb-author.
---

# kb-author

Workflow companion to the repo's `AGENTS.md`. AGENTS.md owns invariants (frontmatter [[effect-ts/schema|schema]],
controlled vocabulary, linker rules); this skill owns the **multi-step workflows**.

**Always read `AGENTS.md` first.** On conflict it wins.

Skills and scripts inventory: [`docs/TOOLING.md`](../../docs/TOOLING.md).

This skill uses **progressive disclosure**: the index lives here, full audits live in
[`audits/`](audits/), full workflows in this file. Read an audit file only when you're about to
run that audit.

## When to load

User asks to: add/edit/expand a note, **author or edit MDX** under `sites/docs/`, write a
recipe/fundamental/reference page, audit existing notes, or runs `/kb-author`. Also: knowledge
base, Starlight, MDX, MOCs, wikilinks, GitHub Pages publish.

**One skill, two surfaces:**

| Surface | Path | Audits |
| --- | --- | --- |
| **Published site** (canonical) | `sites/docs/src/content/docs/**/*.mdx` | **S1–S6** + `bun run lint:docs` + `docs:build` |

**Published site only:** GitHub Pages serves `sites/docs/dist/`.

## Audit index

Run the relevant audits before commit on every note you touched (snippets inside callouts count).

| Audit | One-line summary | Full procedure |
| --- | --- | --- |
| **A** | Code blocks have all imports, class wrappers, declared fields, no undefined refs | [audits/A-code-examples.md](audits/A-code-examples.md) |
| **B** | Reference-table rows link to their worked examples | [audits/B-table-linking.md](audits/B-table-linking.md) |
| **C** | First mention of a concept-with-its-own-note is a wikilink | enforced by `bun run lint:wikilinks` |
| **D** | `related:` links are symmetric | enforced by `bun run lint:wikilinks` |
| **E** | Every claim backed by a primary-source URL in `source:` (see AGENTS.md "Sourcing rule") | inline below |
| **F** | Recipes show request + response payloads, not prose claims | [audits/F-show-dont-tell.md](audits/F-show-dont-tell.md) |
| **G** | Snippet-specific callouts placed at first use, not in trailing clusters | [audits/G-callout-placement.md](audits/G-callout-placement.md) |
| **H** | "X vs Y" / lifecycle-rule sections lead with a concrete analogy or rule-of-thumb table | [audits/H-mental-model.md](audits/H-mental-model.md) |
| **I** | Headlines and callout titles honestly describe what the code does | [audits/I-headline-vs-code.md](audits/I-headline-vs-code.md) |
| **J** | Demo names (CLI paths, class names, file stubs) come from a domain the note endorses | [audits/J-demo-names.md](audits/J-demo-names.md) |
| **K** | Callout severity matches reader stakes (warnings rare, infos common) | [audits/K-callout-severity.md](audits/K-callout-severity.md) |
| **L** | Comparative claims ("same as X", "mirrors X", "X also returns Y") verified against the comparator's primary source, or dropped | [audits/L-comparative-claims.md](audits/L-comparative-claims.md) |
| **M** | Wikilinks point at the right concept, not just the matching word; rephrase prose for vocabulary collisions instead of accepting the link or silencing with `unrelated:` | [audits/M-ambiguous-wikilinks.md](audits/M-ambiguous-wikilinks.md) |
| **N** | Re-fetch every URL in `source:` and diff prose against the live doc; mandatory for recipes, security, auth, error-handling, and version-specific notes | [audits/N-source-verification.md](audits/N-source-verification.md) |
| **O** | Prose claims about a snippet's runtime behavior (auto-converted, deprecated, throws at startup, emits warning) are mirrored INSIDE the snippet via comments, output, or annotated identifiers | [audits/O-behavior-in-snippet.md](audits/O-behavior-in-snippet.md) |
| **P** | No assumed-knowledge jargon: every domain term, acronym, or named feature is defined inline at first use, wikilinked to its note, or replaced with the observable behavior it names | [audits/P-no-assumed-jargon.md](audits/P-no-assumed-jargon.md) |
| **Q** | Prerequisite badge & curriculum progression: every non-index note carries visual prerequisite badges aligned with nearest MOC flowcharts | [audits/Q-prerequisite-badge.md](audits/Q-prerequisite-badge.md) |

### Starlight MDX audits (published site)

Run on every `.mdx` you add or materially change. Playbook: `docs/PUBLISHING.md`.

| Audit | One-line summary | Full procedure |
| --- | --- | --- |
| **S1** | Re-authored for web readers; not a raw paste | [audits/S1-publish-bar.md](audits/S1-publish-bar.md) |
| **S2** | TL;DR, symptom tables, contrast, MOC CardGrids | [audits/S2-reader-clarity.md](audits/S2-reader-clarity.md) |
| **S3** | Recipes: request + response JSON for behavioral claims | [audits/S3-show-dont-tell-mdx.md](audits/S3-show-dont-tell-mdx.md) |
| **S4** | Steps/Tabs/Aside/mermaid only when they teach | [audits/S4-enrichment-fit.md](audits/S4-enrichment-fit.md) |
| **S5** | Copy-pasteable fences; twoslash; EC annotations (`title=`, `ins=`/`del=`, `collapse=`); no wikilinks in Mermaid | [audits/S5-code-fences-mdx.md](audits/S5-code-fences-mdx.md) |
| **S6** | lint:docs, build, publish parity, no stale site URLs | [audits/S6-publish-validate.md](audits/S6-publish-validate.md) |

Other linter-enforced checks (orphans, discoverability, agents-mirror, listing-completeness)
also run from `scripts/lint-wikilinks.mjs` — see [AGENTS.md "Linking rules"](../../../AGENTS.md).

### Audit E — Sourcing (inline)

Every technical claim must be backed by a primary source URL in the `source:` frontmatter list.
Surprising or version-specific claims also get an inline link next to the claim. Never write
from training-data memory. See [AGENTS.md "Sourcing rule"](../../../AGENTS.md) for the full
non-negotiable contract.

## Workflow 1 — Pre-flight discovery ritual (BEFORE drafting any note)

Skipping any step is a bug. Run from repo root:

```bash
# 1. Read the operating contract and the area MOC
bat AGENTS.md
bat sites/docs/src/content/docs/<area>/index.mdx

# 2. Inventory the area
fd . sites/docs/src/content/docs/<area> -e mdx

# 3. Search for the concept and adjacent terms
rg -n -i '<keyword>|<synonym>|<adjacent-concept>' sites/docs/src/content/docs

# 4. Inspect existing relationship metadata
rg -n '^(tags|aliases|area|related):' sites/docs/src/content/docs -A 4

# 5. Read every candidate note that the searches surfaced
bat sites/docs/src/content/docs/<area>/<candidate>.mdx
```

Only after these five steps may you draft. Then:

6. Add the note with the full frontmatter schema (see AGENTS.md).
7. Update `related:` in EVERY note you linked from.
8. Update the closest `index.mdx` MOC and, if a new area, `sites/docs/src/content/docs/index.mdx`.
9. **Run the post-edit audits (the index above).**
10. Mirror `AGENTS.md` → `.github/copilot-instructions.md` if AGENTS.md changed:
    `cp AGENTS.md .github/copilot-instructions.md`.
11. Run the linter: `bun run lint:wikilinks` after edits; `bun run lint:ci` before push (includes Starlight `lint:docs` when MDX changed).
12. **Run the LLM audit on touched files** and triage findings. The full step-by-step loop
    (run pipeline → classify each finding into TRUE-and-cited / TRUE-but-uncited-inline /
    WRONG-claim / UNVERIFIABLE → apply or persist to `dismissed.json`) lives in the `kb-audit-triage`
    skill at [`.github/skills/kb-audit-triage/SKILL.md`](../kb-audit-triage/SKILL.md). Load
    that skill whenever the user says "run the audit", "triage findings", or invokes
    `/kb-audit-triage`.

## Workflow 3 — Starlight MDX (published site)

**Canonical publish path:** `sites/docs/src/content/docs/<area>/<slug>.mdx`. GitHub Pages serves
**only** the Starlight build (`sites/docs/dist/`). Topics without MDX are **not on the site**.

### Before writing

1. Read `docs/PUBLISHING.md`.
2. Verify every claim against primary sources; use MDX siblings or external docs for context only.
3. Skim a published sibling (e.g. `nestjs/fundamentals/request-lifecycle.mdx`).

### While writing

- Pick page kind: area MOC, sub-area MOC, concept, or recipe (see [S2](audits/S2-reader-clarity.md)).
- Re-author; pass [S1](audits/S1-publish-bar.md). Enrichment per [S4](audits/S4-enrichment-fit.md).
- **Recipes are not command dumps.** Every fenced `bash` block needs prose directly above it:
  what the command does, what field in the output to check, and what to do if it looks wrong.
  Condensing prose by deleting the "why" is a publish failure, not a win.
- Links: `[[slug|label]]` in prose and lists. In **markdown tables**, use
  `[label](/knowledge-base/slug/)` only (`lint:mdx-table-wikilinks`). No full-site URLs in MDX for
  slugs that already have `.mdx` (`lint:mdx-link-hygiene`).
- Unpublished topics: say "planned" in prose, or omit the link until MDX exists.

### After writing

1. Run audits **S1–S6** (recipes include **S3**).
2. `bun run lint:docs` and `bun run docs:build` from repo root.
3. Update `astro.config.mjs` (sidebar) and area MOC CardGrid; confirm `lint:publish-parity` passes.
4. Optional LLM pass on touched MDX (needs `CURSOR_API_KEY` in repo-root `.env`):

   ```bash
   bun run audit:mdx-triage -- --base HEAD~1
   ```

   Or use `bun run vault:check --base HEAD~1` — it runs structural MDX Pass 0, `lint:docs` when `sites/docs/` changed, and `mdx-triage` on changed `.mdx` when the key is set.

## Workflow 2 — Encode-then-audit (when you discover a repeated bug pattern)

After fixing N≥2 instances of the same content bug (missing import, missing back-link from a
reference table, undefined symbol, headline-vs-code mismatch):

1. STOP further piecemeal fixes.
2. Propose encoding the rule in `AGENTS.md` (and mirror to `.github/copilot-instructions.md`),
   or as a new audit under `audits/`.
3. Run a full audit pass against the new rule.
4. Fix everything the pass surfaces.
5. THEN resume normal work.

Don't wait for the user to ask. The skill grew Audits H, I, and J this way.

## Common pitfalls

- **Skipping discovery ritual** → duplicate notes, broken backlinks, asymmetric `related:`.
- **Drafting code without final audit** → readers can't run the snippet. Run [Audit A](audits/A-code-examples.md).
- **Adding a worked example without back-linking from the reference table** → discoverability
  bug. Run [Audit B](audits/B-table-linking.md).
- **Stacking callouts in a trailing Gotchas section when each one applies to a specific earlier
  snippet** → readers hit the footgun before reaching the warning. Run [Audit G](audits/G-callout-placement.md).
- **Comparison or "X vs Y" section that opens with jargon and no analogy** → reader has to
  build the mental model from scratch. Run [Audit H](audits/H-mental-model.md).
- **Callout title or section heading that promises a technique the code doesn't show** → reader
  copies misleading code. Run [Audit I](audits/I-headline-vs-code.md).
- **Rewriting a chat-derived explanation when porting it to a note** → the chat version was
  written for someone who just asked the question, which is exactly the reader of the note.
  Softer rewrites bury the insight. When the user says "add this to the note", port the chat
  version VERBATIM (table, mental model, rule of thumb), then add cross-links. Reword only if
  it's chat-specific ("as I mentioned earlier", "great question").
- **Using the most familiar example name even when its domain contradicts the note** → `auth/jwt`
  is the canonical "nested path" demo across the Nest ecosystem, but it has no business in
  [[nestjs/fundamentals/middleware|middleware]].md (which disclaims authz). Run [Audit J](audits/J-demo-names.md).
- **Marking every qualifier as `[!warning]`** → readers learn to skim past warnings, including
  the real ones. Warnings are for actual footguns (silent failures, security, hangs); everything
  else is `[!info]` or plain prose. Run [Audit K](audits/K-callout-severity.md).
- **Comparative claims written from memory** ("same union as X", "X also returns Y", "mirrors
  the X convention") → you only verified the subject, not the comparator. The natural failure
  mode is shipping a confident-sounding lie about X. Run [Audit L](audits/L-comparative-claims.md);
  default to dropping the comparison and linking to the comparator's note.
- **Reflexively accepting a first-mention wikilink suggestion** → the linter matches by note
  title/alias/filename, so words like "[[nestjs/recipes/validation|validation]]", "[[nestjs/fundamentals/guards|guards]]", "[[nestjs/fundamentals/pipes|pipes]]", "middleware" trigger
  links to their Nest-specific notes even when the surrounding sentence is about a different
  concept (Joi env checks, TS type guards, shell pipes, Express middleware in a non-Nest
  context). The fix is to **rephrase the prose** ("check the shape of" instead of "validate"),
  not to accept the link, add a disambiguating wikilink, or silence with `unrelated:`.
  `unrelated:` is for genuine semantic neighbors, not vocabulary collisions you authored. Run
  [Audit M](audits/M-ambiguous-wikilinks.md).
- **Treating Audit E as sufficient because every section has a `source:` URL** → E checks that
  citations exist; it does NOT check that they back the claim. Memory-vs-source drift hides in
  exactly the unsurprising claims you didn't think to verify. Run [Audit N](audits/N-source-verification.md)
  on every recipe and every note touching auth/security/error-handling/version-specific behavior.
- **Using `[[note#Heading]]` for in-note anchors** → linter rejects as self-wikilink. Use
  `[label](#slug)` instead.
- **Editing AGENTS.md without mirroring** → CI fails on `agents-mirror` lint check.
- **Writing dry, academic mathematical formulas for Systems Design concepts** → first-time readers cannot easily parse formal math. Always replace math with welcoming, intuition-first real-world analogies and step-by-step numeric transition tables (see AGENTS.md "Zero-Assumptions for Systems Design").
- **Trusting schematic `schema.json` for `nest g` defaults** → the CLI action layer overrides
  them. Always run `--dry-run` first and trust terminal output.
- **Using interactive components without loading [`kb-enrichment`](../kb-enrichment/SKILL.md)** →
  interactive components carry JS weight. Load the skill for the mandatory selection framework;
  `<Steps>` or `<Tabs>` may be enough.

- **Custom MDX/interactive component root missing `not-content`** → Starlight's
  `.sl-markdown-content` sibling-margin rules (`* + *`, heading margins) inject phantom
  vertical gaps between internal rows, legends, and group headers; timeline stacks look
  broken inside area MOCs. Every interactive wrapper root must include `not-content`
  (see `LearningRoadmap.astro`, `PipelineStrip.astro`; `premium.css` gates rules with
  `:not(:where(.not-content *))`). Load [`kb-enrichment`](../kb-enrichment/SKILL.md)
  when building or auditing components.
- **Mixed-height flex rows using `align-items: center` or baseline alignment** →
  fixed-size controls (e.g. 22px checkbox circles) float above or below adjacent title
  text. Use `align-items: flex-start` on the row and `padding-top: calc(control-height / 2)`
  on the control column (11px for a 22px button) to center against the title line; on
  hover lift only the button (`translateY(-2px)`), not the connector pseudo-element behind it.
- **Vertical timeline connector drawn as one absolute column across row gaps** → row
  `gap`/`margin` leaves visible breaks in a continuous line. Draw per-row segments on
  the checkbox column (`::before`, `width: 2px`, `left: 10px` = center of 22px column),
  extend with `top: -4px; bottom: -4px` to overlap siblings, clip `:first-child` at
  `top: 22px` and `:last-child` at `bottom: calc(100% - 22px)` so endpoints sit at
  control centers; align group separators with `margin-left: 10px`. Match inline-flex
  chip rows (prereq label + pill) to a shared `height: 20px`.

- **CodeWalkthrough steps must target the wrapped fence only** → In `handle-database-errors.mdx`, step bodies described PG constants/`isPgError` from the setup fence while the wrapped block was `TypeOrmExceptionFilter`; rewrite every step against symbols visible in the child fence, then run Audit I.
- **Fence `title=` must match later import paths** → Titling a helper stub `typeorm-exception.filter.ts` when the walkthrough does `import { isPgError, PG } from "./db-errors"` sends readers to the wrong file; name `title=` after the file that owns the exports (Audit S5 + J).
- **CodeWalkthrough on `ts twoslash` fences needs dev-server click-through before editing `lines`** → Misaligned highlights on twoslash blocks were caused by nested popup `.ec-line` DOM (fixed in `CodeWalkthrough.astro`), not wrong ranges — `quickstart.mdx` and `pipes.mdx` originals were correct; always click every step locally before changing step `lines`.

- **Em-dash→colon in frontmatter `description` must stay double-quoted** → Replacing `—` with `:` in YAML frontmatter (e.g. `aws/eventbridge/index.mdx`) yields `description: Amazon EventBridge: Serverless...`; YAML treats the second colon as a mapping key (`incomplete explicit mapping pair`). Wrap the full value: `description: "Amazon EventBridge: Serverless..."`. Re-run `bun run lint:wikilinks` (frontmatter-schema) after every frontmatter em-dash fix.
- **S6 handoff requires `docs:build`, not `astro check` alone** → Agent declared the session complete after `astro check` and documented a successful production build without running `bun run docs:build`; user immediately reported compile failure. `astro check` does not run twoslash export or full MDX compilation. Finish every touched-MDX session with `bun run lint:docs && bun run docs:build` exit 0 in the same turn before handoff.
- **Dense multi-branch ASCII beats FlowSimulator for capstone pipelines** → Replacing the fault-tolerant-ingestion ASCII block with `<FlowSimulator>` split a one-glance topology (concurrency boundary, fail-fast exits, retry loop) into tabbed replay steps. Keep static ASCII or mermaid when all branches must be scannable without clicking; reserve FlowSimulator for separate-actor message hops per kb-enrichment Q4 (Audit S4).

## Boundaries


This skill is the workflow companion to the repo's `AGENTS.md`. It does NOT override AGENTS.md
invariants — schema, vocabulary, linker rules — those win on conflict. It does NOT run the lint
or the build itself; the agent invokes those commands.

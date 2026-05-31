---
name: kb-author
description: >
  Authoring and publish workflow for this knowledge base. Published site is Starlight MDX under
  sites/docs/ (canonical). Covers discovery
  (A–P), Starlight MDX authoring (S1–S6), sourcing, and audit triage. Use for any note edit, MDX
  publish, or "write a recipe". Triggers: edit a note, author MDX, sites/docs, MDX, /kb-author.
---

import { Aside } from "@astrojs/starlight/components";

# kb-author

Workflow companion to the repo's `AGENTS.md`. AGENTS.md owns invariants (frontmatter [[effect-ts/schema|schema]],
controlled vocabulary, linker rules); this skill owns the **multi-step workflows**.

**Always read `AGENTS.md` first.** On conflict it wins.

<Aside type="note">
**North Star — The Instant Clarity Principle (from AGENTS.md)**:
Every element in a note exists to make a concept *instantly graspable* to someone who knows nothing. If it doesn't, it's noise — no matter how beautiful it is. Before finishing any note: (1) Does it teach from zero? (2) Does each piece earn its place? (3) Is every component self-explaining?
</Aside>

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

#### Sourcing rule (NON-NEGOTIABLE)

Never write a technical claim from training-data memory. Every fact MUST be verified against primary sources at the moment of writing.

- **Primary sources back every claim**: official docs, official repo source code, official RFCs/specs, package READMEs on npm/GitHub. Every fact in a note must resolve to one of these in `source:` and (for surprising claims) inline.
- **Secondary sources are inspiration, not citation**: blogs, conference talks, Stack Overflow answers, paid courses, and other LLMs' output are valid as *topic-surface inventory* — they surface which subtopics matter, which tradeoffs practitioners hit, what framings resonate. Read them freely when you need a perspective the official docs don't give. They are NOT valid as the citation backing a claim: every fact you take from a secondary source MUST be re-verified against a primary source before it lands in prose, and the citation in `source:` / inline is the primary one. Forbidden: citing a blog URL as the source for a behavior claim because "the author said so". Required: read the blog → extract the claim → verify against AWS/NestJS/etc. official docs → cite the docs. If the secondary source meaningfully shaped the framing of the note (e.g. you adopted its decision-matrix structure), credit it in a "Further reading" sub-bullet under `## See also` — never in `source:`.
- **Cross-check**: at least two independent primary sources for any non-trivial claim (signature, default value, behavior, package name, version-specific feature). One source is not enough.
- **Cite in `source:`**: every note's frontmatter `source:` list MUST contain the exact URLs consulted. If a section was added later, append the URL that backs it. No URL, no claim.
- **Inline link for surprising claims**: if a fact is counterintuitive or version-specific, link the source inline next to the claim, not just in frontmatter.
- **Citation precision**: when a claim cites a source file, link the specific lines (`blob/master/.../file.ts#L120-L135`); when it cites a docs page, link the section anchor (`docs.nestjs.com/openapi/operations#file-upload`). Bare file/page URLs are too coarse: the source-verification audit has to guess which paragraph backs the claim and degrades to vibes, and the next reader six months later has to re-find what you already found. Forbidden: `https://github.com/nestjs/nest/blob/master/packages/core/router/router-execution-context.ts` as the only pointer for a claim about one specific function — link `#L450-L470` (or whatever the relevant range is). Same for docs: `https://docs.nestjs.com/openapi/operations` is too coarse if the claim is about [[nestjs/recipes/file-uploads|file uploads]]; link `#file-upload`. The exact 413 phrasing in nginx (`Request Entity Too Large`, not `Payload Too Large`) was caught precisely because the link pointed at `#client_max_body_size` — the audit fetched the right paragraph and the contradiction was obvious. Frontmatter `source:` can stay file-level (one URL per file keeps `check-source-urls.sh` cheap); inline prose links carry the precision. Trade-off: line numbers rot when upstream refactors, but the audit catches the drift the next time the note is touched, which is the right time to fix it. Pin to a commit SHA only for historical "this used to be true in vN" claims (e.g. release-notes notes).
- **Don't soften specifics to satisfy auditors**: when an LLM audit flags a specific anchor as wrong ("real range is L<m>-L<n>", "claim not supported by cited sources"), VERIFY before dropping. These findings have a high false-positive rate: the model often pattern-matches on a nearby symbol or misses that the claim IS supported by a file you simply haven't added to `source:` yet. Required verification: `curl -s <raw-url> | grep -n '<symbol>'` then `sed -n '<a>,<b>p'`. If the original anchor was correct, restore it and ignore the finding. If it was wrong, replace with the verified correct range — NEVER drop to a bare URL. If the claim is true but unsourced, **add the missing inline citation** to the prose (e.g. `([source](https://github.com/.../file.ts#L<n>-L<m>))` next to the claim) instead of weakening it; never edit `source:` directly — the inline citation IS the citation, `cd scripts/audit-notes && bun run autofix` keeps the frontmatter list in sync. Forbidden: replacing `[\`formatPid()\`](.../console-logger.service.ts#L417-L419)` with `[\`formatPid()\`](.../console-logger.service.ts)` because an auditor (incorrectly) said "real lines are L407-L409" — verify with `grep -n formatPid` first; the original anchor was right, the auditor was wrong. Forbidden: replacing "same `optional`/`default` ergonomics as `ParseIntPipe`" with a vague "see the pipes reference" because an auditor said the comparison wasn't in the cited sources — the comparison was true and verifiable from `parse-date.pipe.ts#L10-L31`; add that file to `source:` and keep the specific. Specificity > broadness; the audit is a hypothesis, not a verdict.
- **Reader-facing citations only**: cite surprising claims with normal links. Do not expose authoring audit wording in note bodies, such as "verified in", "checked against", "list verified against", raw repo paths as prose, approximate line-number notes, or scratchpad provenance. If a fact needs provenance, put the exact URL in `source:` or link the named API/docs naturally in prose.
- **Versions matter**: state the version when behavior is version-specific (e.g., "[[nestjs/releases/v10|NestJS 10]]+", "class-validator 0.14"). Verify the claim still holds in the latest stable.
- **Unknowns are unknowns**: if you cannot verify a claim from primary sources within the session, do NOT write it. Leave a `// TODO: verify` placeholder or omit the section. Hallucinations are worse than gaps.
- **Code snippets**: copy from official docs or test against the actual package. Do not "reconstruct from memory". Mark adapted snippets as such.
- **Comparative claims are high-risk**: any wording of the form "same as X", "just like X", "X also accepts/returns Y", "mirrors X", "follows the X convention" is a hidden multi-source claim. It requires verifying BOTH X and the comparator against their primary sources before commit, not just the construct you're currently documenting. The natural failure mode is to verify the subject, write the analogy from memory about the comparator, and ship a confident-sounding lie. If you cannot verify the comparator in the same session, drop the comparison and link to the comparator's note instead.
- **Single source of truth for facts**: a fact about construct/feature X (interface signature, default value, behavior list) lives in X's note, not duplicated in adjacent notes that mention X. Cross-link instead. Duplicating the fact in note Y "because it's relevant" guarantees drift the next time X changes. When the user asks for an explanation in note Y that touches X, write the *Y-specific* framing in Y and link to X for the canonical signature/list/table.
- **Cite, don't hedge**: when an audit (or a reviewer) flags a claim as unsourced, the fix is to **add the missing primary-source link inline**, NOT to soften the claim into something unfalsifiable. The hedge reflex ("may apply", "broadly", "in some cases", "often", "tends to", "generally", "depending on") satisfies the auditor by removing information; the reader loses the specific they came for. Required shape for a cited specific: concrete claim + named API in backticks + parenthetical primary-source link with line anchor where the API is defined. Forbidden: replacing `gzip/deflate/brotli` with `gzip` to dodge a citation request, replacing `prompt offers npm/yarn/pnpm; bun missing` with `accepts a package-manager name`, replacing `getAllAndMerge returns an object (not a single-element array) when only one entry exists` with `sharper type inference`. Required: keep the specific, add `([source](https://github.com/.../file.ts#L<n>-L<m>))` next to it. Every audit-driven edit must either ADD information (a URL, a concrete API name, a line anchor) or stay the same length. Edits that subtract information are regressions even when the auditor goes green.

This rule applies to me (the agent) and to any sub-agent I delegate to. Pass this constraint explicitly when delegating research.

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

## Note-type premium standards

To deliver premium, state-of-the-art teaching and maximum utility, every note must adhere to the high-value standards corresponding to its type:

### Concepts (type/concept)

A concept note must establish deep mental clarity before introducing any implementation:
- **Visual Diagrams**: Include at least one visual system diagram using Mermaid.js or structured ASCII art to map data flows, lifecycle stages, or spatial relationships.
- **Mental Analogies**: Frame technical abstractions (such as AsyncLocalStorage, RxJS streams, or AWS KMS key structures) using a real-world or OOP analogy.
- **Zero-Assumptions for Systems Design**: Distributed systems and systems design concepts MUST be welcoming and "intuition-first" for first-time readers. Avoid academic or mathematical formulas (e.g. raw equations, algebraic symbols, or formal relation signs without gloss). Instead, replace formulas entirely with:
  1. A concrete real-world analogy (e.g. clock drift as physical wristwatches, Lamport limits as parallel personal diaries, happens-before as physical mail, partitions as branch office communication cuts).
  2. Step-by-step numeric transition tables or execution flow matrices showing exact node state shifts.
- **Behavior-in-Snippet Comments**: Do not leave code blocks unexplained. Annotate lines with precise comments highlighting exact runtime behavior.

### Gotchas (type/gotcha)

Gotcha notes must serve as immediate, actionable troubleshooting resources:
- **Diagnostic Path**: Provide the exact error log snippet, terminal output, or stack trace the developer will encounter.
- **Silent vs. Explicit Failures**: Clearly document the exact root cause, how to identify if the failure is silent, and configure explicit fail-fast mechanisms.

### References (type/reference)

Reference notes and cheat sheets must prioritize immediate utility and speed:
- **Worked-Example Back-Links**: Every row in an API or configuration table must link to a concrete, worked-example code block or sibling recipe note demonstrating its usage.
- **Copy-Pasteable Shell Blocks**: Provide a single, copy-pasteable environment setup block defining standard CLI variables so commands are immediately executable.

### Design Patterns (type/pattern)

Pattern notes must guide architectural decision-making:
- **Trade-offs Matrix**: Include a Markdown table contrasting options across axes like cognitive load, scale limits, operational cost, and database impact.
- **Directory Layout Trees**: Use fenced ASCII tree blocks to illustrate the exact folder structure required to implement the pattern in a project.

## AWS service indexes (slim shape)

In the `sites/docs/src/content/docs/aws/` area, **only `aws/s3/index.mdx` is a deeply-developed concept note**. Every other service's `index.mdx` follows a slim shape that fits on roughly one screen:

1. Tagline (single `>` blockquote, mandatory).
2. `## TL;DR` — 4-6 bullets naming the service's primitives, defaults, pricing model.
3. `## When to use` — 2-4 bullets for "use it for X" / "don't use it for Y".
4. `## Mental model` — OPTIONAL. Include only when the service has a non-obvious primitive shape worth a small table or one-paragraph diagram (Lambda's function/role/triggers/aliases; RDS's instance vs snapshot; IAM's principal taxonomy; KMS's three key flavors + key-policy primacy; CloudFront's distribution/origin/behavior/alias model; Amplify's App→Branch→Deployment→Domain hierarchy). Skip for services where TL;DR already conveys the model (DynamoDB, SQS, SNS, ECS, VPC, EC2 at this depth).
5. `## Pending notes` — bullet list of recipes/topics planned for sibling notes.
6. `## See also` — CLI cheatsheet + recipes + official docs link.

Status stays `seed` until the user explicitly graduates a service to S3-style depth.

The non-negotiable line is **depth**: slim indexes never grow into long prose sections, "How it works" deep dives, "Operational defaults" lists, or gotcha callouts. Those belong in sibling notes (`aws/<service>/<topic>.md`) so the index stays scannable. When asked to "expand" a service, write a sibling note — do not grow the index. Mirror `aws/dynamodb/index.md` (no Mental model) or `aws/lambda/index.md` (with Mental model) for new stubs; pick the closer analog.

### Quickstart (recommended sibling)

Each service folder SHOULD have a `aws/<service>/quickstart.md` recipe: a hands-on walkthrough that takes a beginner from "I have AWS credentials" to "the service is doing something for me" in ~10 minutes. Mirror `aws/s3/quickstart.md`. Shape:

1. Tagline.
2. `## Before you start` — prereqs (CLI profile, Region) + a 3-4 line shell-export block defining the variables every later command reuses (`AWS_PROFILE`, `REGION`, `ACCOUNT_ID`, plus the per-service identifier).
3. Numbered steps: **create the primitive with safe defaults** → **use it once** (upload / invoke / publish) → **inspect** → **share or wire up** (presigned URL, public function URL, etc.) → **clean up**.
4. `## Where to go next` — wikilinks to the deeper sibling notes (lifecycle, [[aws/s3/storage-classes|storage classes]], [[aws/s3/event-notifications|event notifications]], etc.).
5. `## See also` — concept index + official docs.

Status: `evergreen` once written. Skip the quickstart for services where there is no meaningful single-thread "do this to make it work" path (e.g. IAM is a cross-cutting layer, not a primitive you stand up in 10 minutes); for those, leave only the slim index.

## Per-folder note title shapes

Detailed per-folder naming conventions (extends AGENTS.md "Note titles" section):

- **Recipes** (`nestjs/recipes/`): `<topic> with <tool>`, or just `<tool>` when the tool *is* the topic. The `<topic>` is the differentiating word and goes first so alphabetical sort groups by topic ("Validation with class-validator" sorts under V, not R for "Request").
- **Fundamentals** (`nestjs/fundamentals/`): bare nouns or short noun phrases ("Guards", "Pipes", "[[nestjs/fundamentals/lifecycle-hooks|Lifecycle hooks]]", "[[nestjs/fundamentals/global-providers|Global enhancers]]"). The long descriptor lives in the opening sentence, not the title.
- **Releases** (`nestjs/releases/`): version only ("[[nestjs/releases/v11|NestJS 11]]"). Any "what's new and what broke" framing belongs in the H1 subtitle / opening sentence.
- **Reference / data** (`nestjs/data/`, `nestjs/auth/`): `<topic> with <tool>` like recipes when the tool dominates ("[[nestjs/data/caching|Caching with @nestjs/cache-manager]]", "[[nestjs/auth/jwt-strategy|JWT strategy with Passport]]"); gerund/noun form when the topic dominates ("Handling database errors", "[[nestjs/data/typeorm/postgresql-setup|PostgreSQL setup with TypeORM]]").
- **Differentiating word first.** "PostgreSQL setup with TypeORM" not "TypeORM PostgreSQL setup": readers scanning the explorer match on the first word.
- **Drop "the".** "Monorepos with the Nest CLI" only because removing "the" reads as a vague title; otherwise prefer no leading article.
- **Renames preserve searchability.** When changing a title, append the old title to `aliases` so search still resolves it and the wikilink linter's concept catalog still flags first-mention links from notes that reference the concept by its old name. For aliases that contain commas (e.g. an old descriptive title), use the **block form** (`aliases:\n  - "..."\n`) not the flow form `[...]` — flow-form parsing splits on commas and creates phantom aliases that match unrelated bare words in other notes' prose.

## Implementation notes (MANDATORY for non-trivial changes)

During any non-trivial implementation (SDD apply phases, multi-file edits, significant refactors, or new feature work), maintain a **running `implementation-notes.md`** file that captures decisions and context as they emerge. Do NOT reconstruct this after the fact: write entries in real-time as you implement.

The file lives at the conversation artifact directory (or `openspec/changes/{change-name}/implementation-notes.md` when using OpenSpec). It is the single place a reviewer looks to understand what happened between "spec approved" and "PR opened".

### What to capture

| Category | What to write |
| --- | --- |
| **Design decisions** | Where the spec was ambiguous and a call had to be made. Name the ambiguity, the options considered, and why you chose this one. |
| **Deviations** | Where the implementation intentionally diverged from the spec or design, and why. Not bugs: conscious trade-offs that the reviewer should sign off on. |
| **Tradeoffs** | What else was considered and why the chosen path won. Include rejected alternatives so the reviewer doesn't re-derive them. |
| **Open questions** | Anything you'd want the reviewer to sign off on, flag for follow-up, or validate before merging. |
| **Discoveries** | Non-obvious findings about the codebase, dependencies, or platform behavior that surfaced during implementation. |

### Format

```markdown
# Implementation Notes: {change-name}

## Decisions
- **{short title}**: {ambiguity encountered} → chose {option} because {reason}.

## Deviations from Spec
- **{what changed}**: spec said {X}, implemented {Y} because {reason}.

## Tradeoffs
- **{choice}**: considered {alternatives}; chose {this} because {criteria}.

## Open Questions
- {question that needs reviewer input}

## Discoveries
- {non-obvious finding about the codebase or dependencies}
```

### When to skip

Skip for trivial, mechanical, single-file changes (typo fix, lint fix, adding one import, updating a version number). The threshold: if the change requires no judgment calls, there's nothing to note.

### Persistence

- **SDD (engram)**: save as `sdd/{change-name}/implementation-notes` topic key.
- **SDD (openspec/hybrid)**: write to `openspec/changes/{change-name}/implementation-notes.md`.
- **Non-SDD**: write to the conversation artifact directory.
- The verify phase SHOULD read implementation notes to validate that deviations were intentional and open questions were addressed.

## Boundaries


This skill is the workflow companion to the repo's `AGENTS.md`. It does NOT override AGENTS.md
invariants — schema, vocabulary, linker rules — those win on conflict. It does NOT run the lint
or the build itself; the agent invokes those commands.

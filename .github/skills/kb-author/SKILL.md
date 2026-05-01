---
name: kb-author
description: >
  Authoring and pre-commit audit workflow for personal markdown knowledge bases (Quartz, Obsidian,
  or any vault with frontmatter + wikilinks). Covers the pre-flight discovery ritual before drafting
  a note, the post-edit audit (code examples have all imports, reference tables link to their
  examples, sourcing is verified against primary sources), and the agents-mirror reminder. Use this
  skill when editing files under `content/`, `notes/`, `vault/`, or any folder of `.md` notes
  governed by an `AGENTS.md`. Triggers: "edit a note", "add a note", "audit content", "write a
  recipe", "update the knowledge base", "/kb-author".
---

# kb-author

Workflow companion to the repo's `AGENTS.md`. AGENTS.md owns invariants (frontmatter schema,
controlled vocabulary, linker rules); this skill owns the **multi-step workflows**.

**Always read `AGENTS.md` first.** On conflict it wins.

This skill uses **progressive disclosure**: the index lives here, full audits live in
[`audits/`](audits/), full workflows in this file. Read an audit file only when you're about to
run that audit.

## When to load

User asks to: add/edit/expand a note, write a recipe/fundamental/reference page, audit existing
notes, or runs `/kb-author`. Also any mention of the knowledge base, vault, MOCs, or wikilinks.

## Audit index

Run the relevant audits before commit on every note you touched (snippets inside callouts count).

| Audit | One-line summary | Full procedure |
| --- | --- | --- |
| **A** | Code blocks have all imports, class wrappers, declared fields, no undefined refs | [audits/A-code-examples.md](audits/A-code-examples.md) |
| **B** | Reference-table rows link to their worked examples | [audits/B-table-linking.md](audits/B-table-linking.md) |
| **C** | First mention of a concept-with-its-own-note is a wikilink | enforced by `npm run lint:wikilinks` |
| **D** | `related:` links are symmetric | enforced by `npm run lint:wikilinks` |
| **E** | Every claim backed by a primary-source URL in `source:` (see AGENTS.md "Sourcing rule") | inline below |
| **F** | Recipes show request + response payloads, not prose claims | [audits/F-show-dont-tell.md](audits/F-show-dont-tell.md) |
| **G** | Snippet-specific callouts placed at first use, not in trailing clusters | [audits/G-callout-placement.md](audits/G-callout-placement.md) |
| **H** | "X vs Y" / lifecycle-rule sections lead with a concrete analogy or rule-of-thumb table | [audits/H-mental-model.md](audits/H-mental-model.md) |
| **I** | Headlines and callout titles honestly describe what the code does | [audits/I-headline-vs-code.md](audits/I-headline-vs-code.md) |
| **J** | Demo names (CLI paths, class names, file stubs) come from a domain the note endorses | [audits/J-demo-names.md](audits/J-demo-names.md) |
| **K** | Callout severity matches reader stakes (warnings rare, infos common) | [audits/K-callout-severity.md](audits/K-callout-severity.md) |
| **L** | Comparative claims ("same as X", "mirrors X", "X also returns Y") verified against the comparator's primary source, or dropped | [audits/L-comparative-claims.md](audits/L-comparative-claims.md) |
| **M** | Wikilinks point at the right concept, not just the matching word; rephrase prose for vocabulary collisions instead of accepting the link or silencing with `unrelated:` | [audits/M-ambiguous-wikilinks.md](audits/M-ambiguous-wikilinks.md) |

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

Only after these five steps may you draft. Then:

6. Add the note with the full frontmatter schema (see AGENTS.md).
7. Update `related:` in EVERY note you linked from.
8. Update the closest `index.md` MOC and, if a new area, `content/index.md`.
9. **Run the post-edit audits (the index above).**
10. Mirror `AGENTS.md` → `.github/copilot-instructions.md` if AGENTS.md changed:
    `cp AGENTS.md .github/copilot-instructions.md`.
11. Run the linter: `npm run lint:wikilinks`.

## Workflow 2 — Encode-then-audit (when you discover a repeated bug pattern)

After fixing N≥2 instances of the same content bug (missing import, missing back-link from a
reference table, undefined symbol, headline-vs-code mismatch):

1. STOP further piecemeal fixes.
2. Propose encoding the rule in `AGENTS.md` (and mirror to `.github/copilot-instructions.md`),
   or as a new audit under `audits/`.
3. Run a vault-wide audit pass against the new rule.
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
  middleware.md (which disclaims authz). Run [Audit J](audits/J-demo-names.md).
- **Marking every qualifier as `[!warning]`** → readers learn to skim past warnings, including
  the real ones. Warnings are for actual footguns (silent failures, security, hangs); everything
  else is `[!info]` or `[!tip]`. Run [Audit K](audits/K-callout-severity.md).
- **Comparative claims written from memory** ("same union as X", "X also returns Y", "mirrors
  the X convention") → you only verified the subject, not the comparator. The natural failure
  mode is shipping a confident-sounding lie about X. Run [Audit L](audits/L-comparative-claims.md);
  default to dropping the comparison and linking to the comparator's note.
- **Reflexively accepting a first-mention wikilink suggestion** → the linter matches by note
  title/alias/filename, so words like "validation", "guards", "pipes", "middleware" trigger
  links to their Nest-specific notes even when the surrounding sentence is about a different
  concept (Joi env checks, TS type guards, shell pipes, Express middleware in a non-Nest
  context). The fix is to **rephrase the prose** ("check the shape of" instead of "validate"),
  not to accept the link, add a disambiguating wikilink, or silence with `unrelated:`.
  `unrelated:` is for genuine semantic neighbors, not vocabulary collisions you authored. Run
  [Audit M](audits/M-ambiguous-wikilinks.md).
- **Using `[[note#Heading]]` for in-note anchors** → linter rejects as self-wikilink. Use
  `[label](#slug)` instead.
- **Editing AGENTS.md without mirroring** → CI fails on `agents-mirror` lint check.
- **Trusting schematic `schema.json` for `nest g` defaults** → the CLI action layer overrides
  them. Always run `--dry-run` first and trust terminal output.

## Boundaries

This skill is the workflow companion to the repo's `AGENTS.md`. It does NOT override AGENTS.md
invariants — schema, vocabulary, linker rules — those win on conflict. It does NOT run the lint
or the build itself; the agent invokes those commands.

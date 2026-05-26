# Audit S2 — Reader clarity (MDX)

Goal: a reader can **orient**, **decide**, and **debug** without re-reading the note graph.

## Required by page kind

| Page kind | Required elements |
| --- | --- |
| Area / sub-area MOC | **TL;DR** (4–6 bullets max) + **CardGrid** with one-line value per card |
| Pipeline orchestrator (e.g. request lifecycle) | **Contrast Aside** (e.g. not application lifecycle) + **symptom → layer** table near top |
| Layer concept (guard, pipe, filter, …) | **"Why not X?"** or comparison table vs adjacent layers |
| Global/cross-cutting (global providers, lifecycle) | **Decision table or mermaid** before long examples |
| Recipe | **When to reach for it** bullets + **Steps** for setup (see audit S3 for payloads). **Before each command block:** one sentence on purpose + what to verify in output |

## TL;DR rules

- Place after tagline on MOCs and area indexes only (not every concept page — avoids noise).
- Bullets are **claims a reader can act on**, not feature lists.
- Link the orchestrator note once (`[[.../request-lifecycle|...]]` for NestJS).

## Debugging tables

Use when the page sits in a **stack** (NestJS pipeline, Effect channels, deploy phases).

Template:

```markdown
| Symptom | Open this first |
| --- | --- |
| ... | [[slug|Layer]] or recipe |
```

Keep ≤ 8 rows. If the table duplicates "Pick the right tool" at the bottom, **merge** into one.

## Contrast sections

When two concepts share vocabulary ("lifecycle", "global", "validation"):

- Add a short **two-column table** or Aside: "This page" vs "The other page".
- Link the other page with a wikilink in the first paragraph.

## Prose rules

- **Lead with observable behavior**, then API name (`last write wins` before `last-writer-wins`).
- One idea per paragraph; tables beat bullet walls for comparisons.
- Section headings are **nouns or tasks** ("Bind middleware", not "Introduction").
- No filler ("In this guide we will…").

## Anti-patterns

- CardGrid on non-MOC pages (sidebar already navigates).
- Three nested Tabs with one sentence each.
- Mermaid with >12 nodes — split or simplify.
- Repeating the same Aside on every layer note verbatim — link to the orchestrator instead.

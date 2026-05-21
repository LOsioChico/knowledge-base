# Curated Prompt Pack v2: Effect-TS Notes

> Working artifact derived from the Dia-generated `kb-agent-prompts-effect-ts.md`, rewritten against the current repo standards.
> Source of truth remains: `AGENTS.md`, `docs/PUBLISHING.md`, and `.github/skills/kb-author/SKILL.md`.
> Use these prompts inside the repo root. Do not treat old deployed content or generated gap lists as authoritative.

---

## How to use this pack

Before any agent starts:

1. Read `AGENTS.md`
2. Read `docs/PUBLISHING.md`
3. Read `.github/skills/kb-author/SKILL.md`
4. Treat `content/` as legacy parity material, not a content source
5. Verify every Effect API claim against current official docs or source
6. New MDX-only pages are allowed; do not create legacy `content/` stubs for parity

Effect pages have a different quality bar from NestJS/AWS:

- Preserve the area’s `ts twoslash` teaching style where types teach.
- Do not add “Common errors” tables mechanically; use them only when they prevent real confusion.
- Prefer one progressive type-story over many disconnected examples.
- Avoid making every page compare itself to plain TypeScript or NestJS unless the comparison teaches.

---

## Prompt 01 — Effect-TS gap audit

> Tags: `discovery`, `no edits`
> Use first.

```text
Read these files fully before analysis:
- AGENTS.md
- docs/PUBLISHING.md
- .github/skills/kb-author/SKILL.md
- sites/docs/src/content/docs/effect-ts/index.mdx
- all current Effect-TS MDX pages

Then inspect the current Effect-TS MDX tree:
find sites/docs/src/content/docs/effect-ts -name "*.mdx" | sort

Use the overview's pending notes as suggestions, not truth. Cross-check with current Effect docs.

Produce a gap report with:
- HIGH: topics existing pages already reference or rely on without a canonical page
- MEDIUM: pending topics that are useful but not blocking current pages
- LOW: advanced/ecosystem topics that should wait

For each HIGH item, provide:
- proposed MDX path
- page kind: concept, recipe, reference, bridge, or capstone
- why this is high-value now
- current pages that should link to it
- official docs/source to verify before writing
- whether the page needs sidebar/MOC updates as an MDX-only slug

Do not edit files. Output only the report.
```

---

## Prompt 02 — Spec the Schema page

> Tags: `spec-first`, `highest priority`
> Likely the strongest missing page, but API details must be current.

```text
Read these files fully before analysis:
- AGENTS.md
- docs/PUBLISHING.md
- .github/skills/kb-author/SKILL.md
- sites/docs/src/content/docs/effect-ts/index.mdx
- sites/docs/src/content/docs/effect-ts/typed-errors.mdx
- sites/docs/src/content/docs/effect-ts/fault-tolerant-ingestion.mdx
- sites/docs/src/content/docs/effect-ts/ecosystem-map.mdx

Do NOT write the page yet.

Produce a page spec for:
sites/docs/src/content/docs/effect-ts/schema.mdx

The spec must include:
- page goal and target reader
- why Schema should be standalone
- proposed section outline
- minimal progressive example sequence
- which examples should use `ts twoslash`
- exact behaviors to demonstrate: decode success, decode failure, inferred type, encoded output if relevant
- integration points with existing pages
- comparisons to zod/class-validator only if they can be sourced and kept concise
- common gotchas worth including
- source-verification checklist
- publish-parity implications

Output the spec only.
```

---

## Prompt 03 — Spec Streams vs Concurrency priority

> Tags: `spec-first`, `prioritization`
> Avoid writing both large core pages in one batch.

```text
Read these files fully before analysis:
- AGENTS.md
- docs/PUBLISHING.md
- .github/skills/kb-author/SKILL.md
- sites/docs/src/content/docs/effect-ts/index.mdx
- sites/docs/src/content/docs/effect-ts/composition.mdx
- sites/docs/src/content/docs/effect-ts/scoped-resources.mdx
- sites/docs/src/content/docs/effect-ts/fault-tolerant-ingestion.mdx
- sites/docs/src/content/docs/effect-ts/retry-and-schedule.mdx

Do NOT write pages yet.

Evaluate which page should come first:
- sites/docs/src/content/docs/effect-ts/streams.mdx
- sites/docs/src/content/docs/effect-ts/concurrency.mdx

Return:
- recommended first page
- why the other should wait or be scoped smaller
- outline for the first page
- key examples to include
- type-level story the page should teach
- cross-links to existing pages
- risky claims to verify
- publish-parity implications

Output the recommendation and first-page spec only.
```

---

## Prompt 04 — Effect page diagnostics: real gotchas, not boilerplate

> Tags: `review-only`, `quality`
> Replaces the generated “add common errors to every page” prompt.

```text
Read these files fully before analysis:
- AGENTS.md
- docs/PUBLISHING.md
- .github/skills/kb-author/SKILL.md
- all current Effect-TS MDX pages

Review only. Do not edit.

For each page, decide whether it needs a `Common gotchas` / `Common errors` section.

Decision rules:
- Add one only if the page has recurring reader failure modes that are not already covered.
- Prefer concrete type/compiler/runtime symptoms over generic advice.
- Do not add tables just because NestJS pages have them.
- If a page already has a good gotchas section, say KEEP.

Output:
| Page | Verdict | Missing symptom if any | Smallest fix |

End with the top 3 gotcha additions worth doing first.
```

---

## Prompt 05 — Spec real-world HTTP service recipe

> Tags: `spec-first`, `recipe`
> Useful only after Schema direction is clear.

```text
Read these files fully before analysis:
- AGENTS.md
- docs/PUBLISHING.md
- .github/skills/kb-author/SKILL.md
- sites/docs/src/content/docs/effect-ts/fault-tolerant-ingestion.mdx
- sites/docs/src/content/docs/effect-ts/layers-and-di.mdx
- sites/docs/src/content/docs/effect-ts/typed-errors.mdx
- sites/docs/src/content/docs/effect-ts/ecosystem-map.mdx
- sites/docs/src/content/docs/effect-ts/layers-vs-nestjs-di.mdx

Do NOT write the page yet.

Produce a page spec for:
sites/docs/src/content/docs/effect-ts/http-service.mdx

The spec must include:
- page goal and reader problem
- whether this should wait until `schema.mdx` exists
- proposed progressive build-up
- request/response demos to include
- where Layers, Schema, typed errors, and platform packages enter
- comparison to NestJS/Express only where it teaches
- common gotchas
- source-verification checklist
- publish-parity implications

Output the spec only.
```

---

## Prompt 06 — Reusable Effect-TS page prompt

> Tags: `template`, `reusable`
> Use only after the topic is approved.

```text
Read these files fully before writing:
- AGENTS.md
- docs/PUBLISHING.md
- .github/skills/kb-author/SKILL.md
- sites/docs/src/content/docs/effect-ts/typed-errors.mdx
- sites/docs/src/content/docs/effect-ts/fault-tolerant-ingestion.mdx

Create or edit:
sites/docs/src/content/docs/effect-ts/{PAGE_NAME}.mdx

Topic: {TOPIC}

Before writing:
1. Search current Effect-TS MDX pages for the topic and adjacent terms.
2. Check whether the topic appears in `effect-ts/index.mdx` pending notes.
3. Read the current official Effect docs and source for the API names used.
4. Decide whether this should be a concept, recipe, reference, bridge, or capstone page.
5. Confirm the new MDX-only slug needs sidebar/MOC updates.

While writing:
- Do not mutate `content/`; new published work is MDX-only.
- Use `ts twoslash` only where types teach.
- Every command block needs prose above it explaining why to run it and what to verify.
- Show runtime output where prose claims observable behavior.
- Keep type comparisons precise: show the `Effect<A, E, R>` story instead of vague claims.
- Do not add a `Common errors` table unless it prevents real confusion.

After writing:
- Update the Effect-TS MOC/sidebar only if the page is meant to be published now.
- Run `bun run lint:docs` and `bun run docs:build`.
- Run `bun run lint:publish-parity` and report the result separately.
- Do not commit until asked.
```

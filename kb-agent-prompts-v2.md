# Curated Prompt Pack v2: NestJS Notes

> Working artifact derived from `kb-agent-prompts.md`, but rewritten against the current repo standards.
> Source of truth remains: `AGENTS.md`, `docs/PUBLISHING.md`, and `.github/skills/kb-author/SKILL.md`.
> Use these prompts inside the repo root. Do not treat old deployed content as authoritative.

---

## How to use this pack

Before any agent starts:

1. Read `AGENTS.md`
2. Read `docs/PUBLISHING.md`
3. Read `.github/skills/kb-author/SKILL.md`
4. Treat `content/` as legacy parity material, not a content source
5. Verify every factual claim against primary sources

This pack intentionally drops low-ROI or high-maintenance prompt ideas from the generated artifact:

- Dropped for now: forced 3-tab progressive examples on every fundamentals page
- Dropped for now: self-test sections on every page
- Dropped for now: “under the hood” appendices with brittle GitHub line anchors on every page
- Replaced: generic page scoring rubrics with repo-specific MDX quality checks

---

## Prompt 01 — Priority gap audit for NestJS MDX

> Tags: `discovery`, `no edits`
> Use this first.

```text
Read these files fully before doing anything else:
- AGENTS.md
- docs/PUBLISHING.md
- .github/skills/kb-author/SKILL.md

Then inspect the current published NestJS MDX tree:
find sites/docs/src/content/docs/nestjs -name "*.mdx" | sort

Also read these MOC / planning surfaces:
- sites/docs/src/content/docs/nestjs/index.mdx
- sites/docs/src/content/docs/nestjs/fundamentals/index.mdx
- sites/docs/src/content/docs/nestjs/recipes/index.mdx
- sites/docs/src/content/docs/nestjs/auth/index.mdx
- sites/docs/src/content/docs/nestjs/data/index.mdx
- sites/docs/src/content/docs/nestjs/data/typeorm/index.mdx

Cross-check against official NestJS docs sections relevant to the current site:
- fundamentals
- techniques
- security
- recipes
- faq

Produce a report with 3 buckets:
1. HIGH: missing pages already promised by current MDX pages, or topics the current pages repeatedly depend on
2. MEDIUM: common NestJS topics a mid-level user will look for next
3. LOW: advanced or niche topics that should wait

For each HIGH item, provide:
- proposed file path
- title
- why this is high-value now
- which existing pages should link to it
- whether it should be a concept page, recipe, or area page

Important constraints:
- Do not use the old generated prompt pack as authority
- Do not create files
- Do not suggest vault edits under `content/`
- Prioritize reader value over TOC completeness

Output only the report in chat.
```

---

## Prompt 02 — MDX quality audit: enrich or leave alone

> Tags: `discovery`, `no edits`
> Repo-specific quality audit, not a generic scoring game.

```text
Read these files fully first:
- AGENTS.md
- docs/PUBLISHING.md
- .github/skills/kb-author/SKILL.md
- .github/skills/kb-author/audits/S1-publish-bar.md
- .github/skills/kb-author/audits/S2-reader-clarity.md

Then read every NestJS `.mdx` page under:
sites/docs/src/content/docs/nestjs/

For each non-index page, assess whether the page already lets a reader answer:
1. What problem does this page solve?
2. When should I use this tool/layer?
3. What failure looks like?
4. Where this fits in the NestJS system?

Classify each page into one of four buckets:
- strong as-is
- needs observable behavior examples
- needs clearer decision guidance
- needs structural rewrite

Be strict about false positives: do NOT recommend enrichment just because a page lacks a favorite pattern. Recommend changes only where the missing teaching value is real.

For every page you flag, provide:
- the specific missing teaching outcome
- the smallest worthwhile fix
- whether the fix belongs in that page or in a separate page

Also call out pages that should NOT be expanded because more content would create duplication with:
- request-lifecycle.mdx
- fundamentals/index.mdx
- recipes/index.mdx

Do not edit files. Output only findings in chat.
```

---

## Prompt 03 — Add observable request traces to fundamentals pages

> Tags: `fundamentals`, `per page`
> Best current enrichment track.

```text
Read these files fully first:
- AGENTS.md
- docs/PUBLISHING.md
- .github/skills/kb-author/SKILL.md
- sites/docs/src/content/docs/nestjs/fundamentals/request-lifecycle.mdx
- the target page: sites/docs/src/content/docs/nestjs/fundamentals/{PAGE}.mdx

Goal: make the page more teachable through observable behavior, not more verbose.

Add or improve a section that shows:
1. a minimal copy-pasteable example with all imports
2. the request being made
3. the exact terminal or HTTP output the developer would see
4. the failure path when this layer rejects or throws

Target pages with highest ROI:
- guards.mdx
- pipes.mdx
- exception-filters.mdx
- middleware.mdx
- interceptors.mdx

Requirements:
- Use real, concrete request/response or console output
- Keep pipeline-wide explanation short and link back to `request-lifecycle.mdx`
- Do not restate the whole orchestrator page inside every fundamentals page
- Verify exact error shapes or behaviors from official docs or source before writing
- Favor one strong trace over multiple weak snippets

Do not commit. If the page already has enough observable behavior, say so instead of forcing new sections.
```

---

## Prompt 04 — Tighten “why this layer, not that one?” on fundamentals

> Tags: `fundamentals`, `per page`
> Use selectively, not mechanically.

```text
Read these files fully first:
- AGENTS.md
- docs/PUBLISHING.md
- .github/skills/kb-author/SKILL.md
- sites/docs/src/content/docs/nestjs/fundamentals/request-lifecycle.mdx
- the target page: sites/docs/src/content/docs/nestjs/fundamentals/{PAGE}.mdx

Goal: strengthen the page's decision boundary.

Improve the page so a reader can answer:
- why this layer exists at this position
- what it can do that the adjacent layers cannot
- what it cannot do, and which layer to use instead

Use the smallest effective shape:
- a short comparison table
- a compact “why not X?” section
- or one strong Aside with cross-links

Do NOT force a new “mental model” section if the page already teaches the boundary clearly.
Do NOT add metaphor-heavy prose unless it truly clarifies the mechanism.
Do NOT duplicate the same boundary explanation across all five layer pages.

Best targets:
- middleware.mdx
- guards.mdx
- interceptors.mdx
- pipes.mdx
- exception-filters.mdx

Output should improve decision quality, not page length.
```

---

## Prompt 05 — Spec a new recipe: choosing the right layer

> Tags: `new page`, `spec-first`
> High-value page candidate.

```text
Read these files fully first:
- AGENTS.md
- docs/PUBLISHING.md
- .github/skills/kb-author/SKILL.md
- sites/docs/src/content/docs/nestjs/fundamentals/request-lifecycle.mdx
- sites/docs/src/content/docs/nestjs/fundamentals/middleware.mdx
- sites/docs/src/content/docs/nestjs/fundamentals/guards.mdx
- sites/docs/src/content/docs/nestjs/fundamentals/interceptors.mdx
- sites/docs/src/content/docs/nestjs/fundamentals/pipes.mdx
- sites/docs/src/content/docs/nestjs/fundamentals/exception-filters.mdx

Do NOT write the page yet.

Produce a page spec for:
sites/docs/src/content/docs/nestjs/recipes/choosing-the-right-layer.mdx

The spec must include:
- page goal
- target reader
- why this should be a separate recipe instead of expanding `request-lifecycle.mdx`
- proposed section outline
- 3 scenario comparisons with “wrong layer vs right layer” framing
- cross-links to add from existing pages
- risks of duplication or over-explaining
- primary sources to verify before writing

The page should optimize for decision-making under confusion, not layer reference completeness.

Output the spec only.
```

---

## Prompt 06 — Spec a new recipe: testing in NestJS

> Tags: `new page`, `spec-first`
> Highest-value missing recipe.

```text
Read these files fully first:
- AGENTS.md
- docs/PUBLISHING.md
- .github/skills/kb-author/SKILL.md
- sites/docs/src/content/docs/nestjs/recipes/file-uploads.mdx
- sites/docs/src/content/docs/nestjs/fundamentals/global-providers.mdx
- sites/docs/src/content/docs/nestjs/fundamentals/lifecycle-hooks.mdx
- sites/docs/src/content/docs/nestjs/auth/jwt-strategy.mdx
- sites/docs/src/content/docs/nestjs/data/caching.mdx
- sites/docs/src/content/docs/nestjs/releases/v10.mdx

Do NOT write the page yet.

Produce a page spec for:
sites/docs/src/content/docs/nestjs/recipes/testing.mdx

The spec must include:
- reader problems this page solves
- scope boundaries: unit vs integration vs e2e
- section outline
- the smallest set of examples that earns the page
- specific links to current pages it should connect to
- likely gotchas that deserve space
- claims that need especially careful source verification

Be critical: if some desirable subtopic should be deferred to a later page, say so.

Output the spec only.
```

---

## Prompt 07 — Spec a new recipe: configuration in NestJS

> Tags: `new page`, `spec-first`
> Useful gap, but easy to get sloppy.

```text
Read these files fully first:
- AGENTS.md
- docs/PUBLISHING.md
- .github/skills/kb-author/SKILL.md
- sites/docs/src/content/docs/nestjs/recipes/file-uploads.mdx
- sites/docs/src/content/docs/nestjs/fundamentals/global-providers.mdx
- sites/docs/src/content/docs/nestjs/data/caching.mdx
- sites/docs/src/content/docs/nestjs/auth/jwt-strategy.mdx

Also verify against official docs before making claims.

Do NOT write the page yet.

Produce a page spec for:
sites/docs/src/content/docs/nestjs/recipes/configuration.mdx

The spec must include:
- what concrete production problems this page solves
- section outline
- minimal example, typed config example, and validation example
- where current pages should be updated to cross-link it
- risky claims that must be sourced carefully
- statements from the old generated prompt that should be discarded unless re-verified

Be especially strict about not repeating folklore about `.env`, boot order, or config loading.

Output the spec only.
```

---

## Prompt 08 — Reusable prompt for a new NestJS recipe page

> Tags: `template`, `reusable`
> Use only after the page topic has already been approved.

```text
Read these files fully first:
- AGENTS.md
- docs/PUBLISHING.md
- .github/skills/kb-author/SKILL.md
- sites/docs/src/content/docs/nestjs/recipes/file-uploads.mdx
- sites/docs/src/content/docs/nestjs/recipes/trace-id.mdx

Create a new recipe page at:
sites/docs/src/content/docs/nestjs/recipes/{RECIPE_NAME}.mdx

Topic: {TOPIC}

Before writing:
1. Search existing NestJS MDX pages for this topic and adjacent terms
2. Read the relevant official docs and primary sources
3. Check whether any existing page already partially covers it
4. Decide whether this should really be a recipe, not a fundamentals or area page

While writing:
- Re-author for web readers; do not paste legacy vault structure
- Add only the components the page earns
- Every bash block must have prose above it explaining why to run it and what to verify
- Prefer one strong minimal example over many thin examples
- Show observable behavior where the page claims runtime effects
- Cross-link only where it improves navigation, not just because the link exists

After writing:
- Update the nearest NestJS MOC or overview page if needed
- Update cross-links from materially related pages
- Run `bun run lint:docs`
- Run `bun run docs:build`
- Do not commit until asked
```

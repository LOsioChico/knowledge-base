---
title: Inbox
aliases: [reading queue, backlog]
tags: [type/moc]
area: inbox
status: seed
related:
  - "[[index]]"
---

> Reading queue. Things I want to extract notes from later. One bullet per source, with a short reminder of why it caught my attention. When a source becomes a real note, drop the bullet (or strike it through) and link the note from the relevant area MOC.

## Articles

- [20 mistakes that quietly destroy JS/TS codebases](https://thetshaped.dev/p/20-mistakes-that-quietly-destroy-javascript-typescript-codebases-common-code-smell-patterns): survey of common code smells; mine the ones that don't already have notes (likely candidates: leaky abstractions, type-narrowing footguns, error-handling anti-patterns).
- [Everything about barrel exports in JavaScript](https://4markdown.com/everything-about-barrel-exports-in-javascript/): when `index.ts` re-exports help vs hurt (bundle size, circular deps, IDE perf). Likely a `typescript/patterns/barrel-exports` note.
- [Consider using type imports in TypeScript](https://4markdown.com/consider-using-type-imports-in-typescript/): `import type` vs runtime imports; effect on bundling and `verbatimModuleSyntax`. Short `typescript/gotchas` candidate.
- [Exhaustiveness checking and discriminant property](https://4markdown.com/exhaustiveness-checking-and-discriminant-property-the-complete-guide/): discriminated unions + `never` for exhaustive `switch`. Likely a `typescript/patterns/exhaustiveness-check` note.
- [Trilon: Dependency Inversion Principle in NestJS](https://trilon.io/blog/dependency-inversion-principle): the "D" of SOLID applied to Nest providers (depend on abstract tokens / interfaces, not concrete classes). Candidate `nestjs/patterns/dependency-inversion` note; cross-link from `global-providers` and the existing DI material.
- [Trilon: Avoiding circular dependencies in NestJS](https://trilon.io/blog/avoiding-circular-dependencies-in-nestjs): `forwardRef`, module restructuring, and the design smells that cause cycles. Likely a `nestjs/gotchas/circular-dependencies` note (or a section under a future modules deep-dive).
- [Trilon: NestJS + Drizzle ORM](https://trilon.io/blog/nestjs-drizzleorm-a-great-match): Drizzle wiring (module, schema, repository pattern) as an alternative to TypeORM/Prisma. Lands as `nestjs/data/drizzle` once verified against current Drizzle docs; useful even before then to anchor a "choose your ORM" comparison from the data MOC.
- [Trilon: ElevenLabs voice AI integration with NestJS](https://trilon.io/blog/elevenlabs-nestjs-voice-ai-integration): streaming third-party SDK responses through a Nest service. Probably too vendor-specific for its own note; mine for the **streaming pattern** (chunked response, backpressure, abort handling) and fold into a future `nestjs/recipes/streaming-responses` note rather than a vendor recipe.

## Videos

- [Marius Espejo: Decouple your NestJS code with this technique!](https://www.youtube.com/watch?v=-MlXwb42nKo): likely about provider abstraction / port-and-adapter style in Nest. Watch and decide whether it lands as a `nestjs/patterns` note or sharpens an existing fundamentals note.
- [Marius Espejo: ts-rest end-to-end type safety](https://www.youtube.com/watch?v=tjfEkaPiKQQ): use the video only to grok the **shape** of the problem (one schema, both client and server type-safe, no codegen). Do **not** write the recipe against ts-rest: the project is unmaintained (last meaningful release 2024, open issues piling up). Build the recipe against [oRPC](https://orpc.unnoq.com) instead, sourced from its docs and any solid blog/migration write-ups. Cross-check ts-rest's maintenance status before committing the recipe so the framing ("ts-rest taught the shape, oRPC is the maintained successor") holds. Lands as `nestjs/recipes/end-to-end-type-safety` (or similar).

## How to use this list

1. When reading a source, decide: does it deserve its own note, or does it just sharpen an existing one?
2. New note → create under the right area, link from the area MOC, then remove the inbox bullet.
3. Existing note → edit and add the URL to that note's `source:` frontmatter, then remove the inbox bullet.
4. Not worth it → delete the bullet. Inbox debt is fine; inbox lies are not.

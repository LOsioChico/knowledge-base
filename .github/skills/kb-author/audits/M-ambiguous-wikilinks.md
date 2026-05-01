# Audit M — Wikilink the concept, not the word

The first-mention linter (`scripts/lint-wikilinks.mjs`) builds its concept catalog from every
note's title, aliases, and filename, then flags the first occurrence of any of those strings
in any other note's body. That catalog is **lexical**, not semantic. The same English word can
name two different technical concepts in the same vault, and the linter cannot tell them apart.

Real example caught in the wild: `nestjs/data/typeorm/postgresql-setup.md` had a sentence about
**Joi env-shape checks at bootstrap** that used the word "validate". The linter flagged it as a
missing first-mention link to `nestjs/recipes/validation.md`, which is about
**`class-validator` request DTOs via `ValidationPipe`**. Different library, different lifecycle
stage, different reader intent. Accepting the suggested wikilink dragged validation.md into
TypeORM territory it had no business in (forced into `related:` by the symmetry rule, then into
the discoverability check, etc.).

Other vocabulary collisions that exist in this vault or are likely to appear:

| Bare word | Concept A (note) | Concept B (different concept) |
| --- | --- | --- |
| validation | `nestjs/recipes/validation` (class-validator request DTOs) | Joi env-shape checks; runtime input validation in any layer; schema validation |
| guards | `nestjs/fundamentals/guards` (Nest authz layer) | TypeScript type guards; React route guards; iframe sandbox guards |
| pipes | `nestjs/fundamentals/pipes` (Nest transform/validate layer) | shell pipes; RxJS pipe operator; FFmpeg filter pipes |
| middleware | `nestjs/fundamentals/middleware` | Express middleware in non-Nest contexts; Redux middleware |
| serialization | `nestjs/recipes/serialization` (class-transformer responses) | JSON serialization in general; protobuf serialization |
| interceptors | `nestjs/fundamentals/interceptors` (Nest AOP) | Axios/HTTP interceptors; Java EE interceptors |

## Audit procedure

When the first-mention linter flags a missing wikilink, **do not reflexively accept it**:

1. Read the surrounding sentence. What is the **referent** in this sentence?
2. Read the target note's tagline (first blockquote) or first paragraph. What is **its**
   referent?
3. Compare. Same concept, or just same English word?

If same concept → add the wikilink.

If different concept → **rephrase the prose to avoid the ambiguous bare word**. The Joi case
became "check their shape at boot with a Joi schema" — no "validation" word, no link, no
follow-on damage. Other rewrites that work:

- "validate" → "check the shape of", "enforce the shape of", "assert"
- "guard" (non-Nest) → "protect", "gate", "restrict"
- "pipe" (non-Nest) → "stream through", "chain into"
- "middleware" (non-Nest) → "wrapper", "intermediary"

## What NOT to do

The wrong fixes, in increasing order of damage:

1. **Accept the bogus wikilink.** Misleads the reader and forces a bidirectional `related:`
   entry that pollutes both notes' metadata.
2. **Add a parenthetical disambiguator that still wikilinks** — e.g.
   `[[nestjs/recipes/validation|class-validator request pipe]] (not Joi env checks)`. Still
   counts as a first mention, still triggers `related:` symmetry, still wrong on inspection.
3. **Silence the linter with `unrelated:`.** `unrelated:` is the audit trail for genuine
   semantic neighbors that share vocabulary but cover different topics. It is **not** an
   escape hatch for vocabulary collisions you authored by careless word choice. Using it that
   way leaves a misleading "the author considered linking these and rejected it" claim, which
   is doubly wrong: there was nothing to consider.

## When `unrelated:` is the right tool

Reserve it for: two notes that genuinely share enough TF-IDF vocabulary to trip the
discoverability check (≥ 0.20 cosine similarity) but cover unrelated topics on inspection.
Example: a note about Redis cache eviction and a note about LRU cache implementation in
JavaScript will share words like "cache", "evict", "key", "LRU" without being editorial peers.
That's `unrelated:` material. A made-up word collision (your "validate" → their `validation`
note) is not.

## When this audit fires

- Any time `npm run lint:wikilinks` reports a first-mention violation.
- Any time you're tempted to add a wikilink because a word "matches" another note's title.
- Any time you're tempted to add `unrelated:` to silence the discoverability linter — pause and
  check whether a body-link rephrase would solve it instead.

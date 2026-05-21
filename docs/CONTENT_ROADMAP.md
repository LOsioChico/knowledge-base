# Content roadmap

Short-lived planning map for the published Starlight knowledge base. This file keeps the useful decisions from the Dia-generated prompt packs without preserving large prompt artifacts as source of truth.

Authoring source of truth remains:

- [`AGENTS.md`](../AGENTS.md)
- [`docs/PUBLISHING.md`](PUBLISHING.md)
- [`kb-author`](../.github/skills/kb-author/SKILL.md)
- [`kb-research-author`](../.github/skills/kb-research-author/SKILL.md)
- audit scripts under [`scripts/audit-notes/`](../scripts/audit-notes/)

## Current policy

- Published MDX under `sites/docs/src/content/docs/` is canonical.
- `content/` is legacy and read-only.
- MDX-only pages are allowed.
- `lint:publish-parity` verifies that legacy vault slugs are still covered by MDX.
- New pages still need sidebar/MOC updates plus `bun run lint:docs` and `bun run docs:build`.

## NestJS

Recently added:

- `nestjs/recipes/configuration`
- `nestjs/recipes/testing`

Recommended next work:

1. **Fundamentals observable traces**
   - Targets: `interceptors`, `guards`, `pipes`
   - Goal: one concrete request/response or console trace per page, not broad rewrites.

2. **Dependency injection**
   - Proposed slug: `nestjs/fundamentals/dependency-injection`
   - Why: existing pages already rely on provider tokens, custom providers, request scope, and `new X()` vs DI.

3. **Modules**
   - Proposed slug: `nestjs/fundamentals/modules`
   - Why: `imports` / `exports` / feature-module boundaries are assumed by data, auth, middleware, and monorepo pages.

Deferred:

- `choosing-the-right-layer`: useful, but lower priority because `request-lifecycle` already covers the core decision table.
- self-test sections everywhere: not current style and not worth the maintenance cost yet.

## AWS

Recently added:

- `aws/iam/policy-evaluation`

Recommended next work:

1. **Lambda quickstart**
   - Proposed slug: `aws/lambda/quickstart`
   - Must include: execution role, handler package, invoke output, log inspection, cleanup.
   - Warning: author commands only; do not run AWS CLI mutations from the agent environment.

2. **SQS quickstart**
   - Proposed slug: `aws/sqs/quickstart`
   - Safe create/send/receive/delete loop.

3. **DynamoDB conditional writes**
   - Proposed slug: `aws/dynamodb/conditional-writes`
   - Better first DynamoDB deep dive than single-table design because it is concrete and operational.

4. **Account migrations hardening**
   - Existing slug: `aws/account-migrations`
   - Focus: rollback windows, cutover order, and unsupported-service boundaries.

Deferred:

- Bulk CLI “common mistakes” tables.
- Graduating non-S3 service indexes to S3-level depth.
- ECS/VPC deep dives unless tied to a specific reader failure.

## Effect-TS

Recently added:

- `effect-ts/schema`

Recommended next work:

1. **Concurrency**
   - Proposed slug: `effect-ts/concurrency`
   - Scope: fibers, bounded `Effect.forEach`, interruption, failure behavior, and cleanup links to scoped resources.

2. **Streams**
   - Proposed slug: `effect-ts/streams`
   - Should come after concurrency so backpressure and interruption have a shared vocabulary.

3. **HTTP client with Schema**
   - Proposed slug: `effect-ts/http-client-with-schema`
   - Narrower and safer than a broad HTTP service recipe.

4. **Logging and tracing**
   - Proposed slug: `effect-ts/logging-and-tracing`
   - Focus: `Effect.log`, log spans, `Effect.fn`, and where `@effect/opentelemetry` begins.

Deferred:

- Generic common-errors tables on every Effect page.
- Full `@effect/platform` server recipe before Schema and concurrency are stable.
- Durability boundary until retry/concurrency/http vocabulary is mature.

## How to use this roadmap

Before drafting any item:

1. Load `kb-author`; use `kb-research-author` when external docs drive the topic.
2. Produce a spec first when the topic is broad or source-heavy.
3. Verify current primary sources during the session.
4. Write MDX only, not legacy vault content.
5. Update sidebar and nearest MOC.
6. Run validation:

```bash
bun run lint:docs
bun run docs:build
bun run lint:publish-parity
```

For substantial content, also run the MDX audit when credentials are available:

```bash
bun run audit:mdx-triage -- --base HEAD~1
```

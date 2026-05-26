# Content roadmap

Short-lived planning map for the published Starlight knowledge base. This file keeps the useful decisions from the Dia-generated prompt packs without preserving large prompt artifacts as source of truth.

## When agents should consult this file

Consult this roadmap when the user asks what to work on next, asks for one of the roadmap-listed topics, or gives a broad area request where priority and scope are ambiguous. Do not load it as mandatory preflight for small targeted edits, typo fixes, or already-scoped page changes.

This file is a planning aid, not a fact source. User instructions and the authoring source-of-truth docs below win. Before writing, verify every technical claim against current primary sources during the session.

Authoring source of truth remains:

- [`AGENTS.md`](../AGENTS.md)
- [`docs/PUBLISHING.md`](PUBLISHING.md)
- [`kb-author`](../.github/skills/kb-author/SKILL.md)
- [`kb-research-author`](../.github/skills/kb-research-author/SKILL.md)
- audit scripts under [`scripts/audit-notes/`](../scripts/audit-notes/)

## Current policy

- Published MDX under `sites/docs/src/content/docs/` is canonical.
- `lint:publish-parity` runs as an MDX page count health check.
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
- `effect-ts/concurrency`
- `effect-ts/streams`
- `effect-ts/state`
- `effect-ts/observability`
- `effect-ts/platform`

Recommended next work:

1. **HTTP client with Schema**
   - Proposed slug: `effect-ts/http-client-with-schema`
   - Narrower and safer than a broad HTTP service recipe.

2. **Logging and tracing**
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
4. Write MDX only.
5. Update sidebar and nearest MOC.
6. Run validation:

```bash
bun run lint:docs
bun run docs:build
bun run lint:publish-parity   # MDX page count health check
```

For substantial content, also run the MDX audit when credentials are available:

```bash
bun run audit:mdx-triage -- --base HEAD~1
```

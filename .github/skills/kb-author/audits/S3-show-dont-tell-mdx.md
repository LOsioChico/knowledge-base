# Audit S3 — Show, don't tell (MDX / recipes)

Same intent as [audit F](F-show-dont-tell.md), applied to Starlight **recipes** and any MDX section that claims
an observable HTTP or CLI outcome.

## When this audit applies

- `type/recipe` equivalents on Starlight (`sites/docs/**/recipes/*.mdx`)
- Concept pages that claim status codes, error shapes, or response transforms (e.g. ValidationPipe 400)

Does **not** require JSON inside `<Aside>` bodies — keep Asides short; put payloads in section body.

## Required shape

For each behavioral claim ("returns 400", "strips field X", "wraps as `{ data }`"):

1. **Input** — request line, curl, or JSON body (fenced).
2. **Output** — status + JSON body, or stdout (fenced).
3. Then one sentence of prose if needed.

Bad:

> Invalid email returns 400 with validation messages.

Good:

```json
{ "email": "not-an-email" }
```

```json
{
  "statusCode": 400,
  "message": ["email must be an email"],
  "error": "Bad Request"
}
```

## NestJS defaults

Readers expect Nest's default exception envelope unless you document `exceptionFactory`.
Note when the exact `message` array may vary.

## CLI recipes (e.g. SWC)

Show **command** + **what success looks like** (exit 0, log line) or **failure** (missing package hint).
Tables for builder comparison are not a substitute for one worked command block.

## Checklist

- [ ] Every status code claim has a fenced response example
- [ ] Before/after transforms show both sides (whitelist strip vs reject)
- [ ] No "returns an error" without the error JSON or status line

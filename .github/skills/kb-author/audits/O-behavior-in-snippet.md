# Audit O — Behavior-in-snippet, not buried in prose

When a code block is surrounded by prose claiming a runtime behavior, that behavior MUST also
appear inside the snippet. The reader who scans only the code (very common on changelog and
reference pages) should not miss the claim.

Trigger phrases in prose that demand snippet-level evidence:

- "Nest auto-rewrites this", "auto-converts at runtime"
- "emits a deprecation warning", "logs a warning at startup"
- "still works but", "deprecated since"
- "falls back to", "defaults to" (when the default is non-obvious)
- "throws at startup if", "fails fast when"
- "silently coerces", "silently drops", "is ignored"

Acceptable in-snippet evidence (one is enough):

- A comment on the affected line: `// auto-rewritten by Nest, logs a warning`.
- An annotated identifier: `findAllV4`, `findAll_DEPRECATED`, `legacyHandler`.
- A meaningful return value: `return "auto-converted, deprecated"`.
- A console output line in a comment: `// console: [Nest] WARN ...`.

Audit procedure:

1. Walk the diff for every code block you added or touched.
2. For each, read the paragraph immediately before AND after.
3. If those paragraphs make a runtime-behavior claim that is NOT visible in the snippet itself,
   add a comment / rename / output line that surfaces it.
4. Trim the prose afterward. The shorter version usually reads better.

Forbidden:

```typescript
// Before (Express v4)
@Get("users/*")
findAll() {}
```

with prose elsewhere claiming "Nest auto-rewrites this and emits a warning".

Required:

```typescript
// Before (Express v4): still works in v11, but Nest auto-rewrites it to a
// valid Express v5 route and logs a warning at startup. Don't ship new code
// with this shape.
@Get("users/*")
findAllV4() {
  return "auto-converted, deprecated"
}
```

Distinct from:

- **Audit A** (code-imports): is the snippet runnable? Different concern.
- **Audit F** (show-don't-tell): does a recipe show request+response payloads? F is HTTP/API
  behavior; O is in-process runtime behavior of any snippet (decorator output, lifecycle order,
  warning emission, deprecation, etc.).

Advisory: no automated detector. Run as part of the post-edit code-block pass.

# kb-contradiction-judge

Skill for detecting factual contradictions between related notes in the knowledge base.

## When to load

Loaded by the contradiction-scan audit pass (`scripts/audit-notes/contradiction-scan.ts`). Not invoked directly by agents.

## Input

You receive two related MDX notes from the knowledge base. Your job is to find factual claims that contradict each other across these two notes.

## What counts as a contradiction

A contradiction is when two notes make **incompatible factual claims** about the same concept. Examples:

- **Execution order**: Note A says "pipes run before interceptors", Note B says "interceptors run before pipes"
- **API behavior**: Note A says "returns null on miss", Note B says "returns undefined on miss"
- **Default values**: Note A says "TTL defaults to 0 (no expiry)", Note B says "TTL defaults to 5000ms"
- **Scope/visibility**: Note A says "works only with HTTP", Note B says "works with HTTP and WebSockets"
- **Version requirements**: Note A says "requires Node 16+", Note B says "requires Node 18+"

## What is NOT a contradiction

Do NOT flag these:

- **Different levels of detail**: Note A says "middleware runs first" (simplified), Note B gives the full 7-step lifecycle. These are complementary, not contradictory.
- **Different contexts**: Note A discusses Express behavior, Note B discusses Fastify behavior. These are context-specific, not contradictory (unless one claims universal applicability).
- **Stylistic differences**: Different wording for the same concept.
- **Evolution across versions**: Note A describes v10 behavior, Note B describes v11 behavior. These are versioned facts. Only flag if neither note scopes the claim to a version.
- **Opinion vs fact**: "We recommend X" in one note vs "Y is also valid" in another.

## Instructions

1. Read both notes carefully.
2. Extract **factual claims** from each note. Focus on:
   - Execution order (lifecycle, pipeline stages)
   - API signatures, return types, default values
   - Behavioral descriptions (what happens when X)
   - Version requirements, compatibility statements
   - Scope assertions (global vs local, HTTP vs all transports)
3. For each claim in Note A, check if any claim in Note B contradicts it.
4. Report only genuine contradictions with high confidence.
5. Include the **exact line numbers** where each contradicting claim appears.

## Output schema

Return a single JSON object:

```json
{
  "contradictions": [
    {
      "claimA": {
        "file": "sites/docs/src/content/docs/nestjs/fundamentals/pipes.mdx",
        "line": 90,
        "text": "Route-parameter pipes run in reverse declaration order"
      },
      "claimB": {
        "file": "sites/docs/src/content/docs/nestjs/fundamentals/request-lifecycle.mdx",
        "line": 45,
        "text": "Pipes execute in declaration order for each parameter"
      },
      "description": "Contradictory claims about pipe execution order per parameter",
      "confidence": "high"
    }
  ]
}
```

### Confidence levels

- `"high"` — Direct logical contradiction. Both claims cannot be true simultaneously.
- `"medium"` — Likely contradiction but could be a context difference. Needs human review.

Only report `"high"` and `"medium"`. Do not report `"low"` or speculative contradictions.

If no contradictions are found, return `{ "contradictions": [] }`.

**JSON only. No prose before or after.**

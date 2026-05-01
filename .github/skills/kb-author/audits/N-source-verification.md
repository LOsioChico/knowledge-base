# Audit N — Source verification (re-fetch and diff)

## When to run

- **Always** for: `type/recipe`, `type/gotcha`, and any note touching auth, security, error handling, or version-specific behavior.
- **On demand** for: `type/concept`, `type/pattern`, `type/reference` when a claim looks suspicious or the note is older than 6 months.
- **Skip** for: `type/moc`, sub-area indexes, and notes with no `source:` URLs (they shouldn't exist; flag those instead).

This audit is the **hallucination safety net**. Audit E checks that citations exist; Audit N checks that the citations actually back the claims. Without N, an audit pass means "the structure is fine" — it does not mean "the facts are true".

## What it catches

- Claims written from training-data memory that the original `source:` URL never supported.
- Drift: package renamed an export, changed a default, deprecated an API, bumped a major version.
- Comparative claims where the subject was verified but the comparator was not (Audit L's failure mode, one layer deeper).
- Stale version-pinned facts ("v5+", "NestJS 10+") that need re-checking against the current stable.
- Citations that point at a doc page that has since been restructured (URL still resolves, content is different).

## Procedure

For each note in scope:

1. **List `source:` URLs.** Treat each as a contract: the claims in the note must be derivable from these pages alone.
2. **Re-fetch each URL** (use the agent's webpage-fetch tool or `curl | head`). For GitHub source links, fetch the file at the linked branch/tag.
3. **Pick non-trivial claims to verify** — at minimum:
   - Every default value asserted in prose ("defaults to X").
   - Every behavior claim about a third-party API ("returns Y", "throws Z").
   - Every version-specific statement ("v5+", "since vN").
   - Every comparative claim that wasn't already dropped by Audit L.
   - Every method/option name in reference tables (typos slip past Audit A because the snippet runs against a fictional API).
4. **Diff prose against fetched content.** For each claim:
   - **Match**: leave alone.
   - **Drift** (claim was true, source has since changed): update the note + bump the version qualifier.
   - **Hallucination** (source never said this): rewrite from the fetched content; if you can't, drop the claim.
   - **Couldn't verify** (URL 404, cited section gone, no longer authoritative): replace the source, or weaken the claim to what's actually verifiable.
5. **Spot-check one claim per section** that's NOT in your verify list. If it also matches, the section is probably clean. If it drifts, expand the verify list for that section.
6. **Update `source:` URLs** if any redirected, were renamed, or now point at a less-authoritative page.

## What "primary source" means here

Same as AGENTS.md "Sourcing rule":

- Official docs site (e.g., `docs.nestjs.com`, `nodejs.org/api/`).
- Package README on GitHub (the canonical repo, not a mirror).
- Package source code at a specific tag.
- W3C / IETF specs.
- TC39 proposals at their official stage.

NOT primary: blog posts, Stack Overflow, third-party tutorials, other LLM output, this knowledge base itself.

## Output of this audit

Per note, report:

- ✅ Verified claims (count is enough).
- ⚠ Drift fixed (list each).
- 🚨 Hallucinations rewritten (list each).
- ❓ Unverifiable claims (list each + decision: weaken / drop / new source).

Commit fixes per note (`docs: re-source <note> against primary docs`).

## Anti-patterns

- **Trusting the audit is "done" because every section has a `source:` URL.** That's Audit E. N is one level deeper: do the URLs back the claims?
- **Adding more URLs to `source:` instead of verifying the existing ones.** Citations are not decoration. Each one represents a claim; an unverified pile of URLs is worse than a single verified one.
- **Verifying only the surprising claims.** The unsurprising ones are exactly where memory-vs-source drift hides — you didn't think to check because "everyone knows" the API works that way.
- **Re-using a previous session's verification.** Sources change. Re-fetch every time.

## Cost

Real. ~5–15 fetches per recipe-class note + reading time. Worth it for security/version-specific notes; overkill for stable conceptual notes. Use the "When to run" guidance.

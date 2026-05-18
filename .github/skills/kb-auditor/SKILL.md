---
name: kb-auditor
description: >
  Read-only audit pass for knowledge-base notes. Emits a strict JSON report keyed by a small
  rule-ID enum so CI can render check-run annotations or fail per-rule. Companion to `kb-author`:
  kb-author OWNS authoring workflows, kb-auditor OWNS read-only verification. The detailed
  per-rule procedures live in `audits/` (symlinked to `.github/skills/kb-author/audits/` so the
  authoring and auditing skills share one source of truth). Use this skill whenever the user
  asks to "audit notes", "check this note against AGENTS.md", "lint content", or runs
  `/kb-auditor`. Triggered automatically by `scripts/audit-notes/audit-notes.ts`.
---

# kb-auditor

Read-only auditor. Never edits files. Never runs shell commands beyond reading the target notes,
`AGENTS.md`, and the per-rule procedures under `audits/`. Output is **JSON only**, following the
schema below.

**Always read `AGENTS.md` first.** On conflict it wins.

## Inputs

The caller passes:

- `targets`: an array of repo-relative paths to `.md` notes under `content/`.
- (Optional) hints about which rules to emphasize. Default: all rules below.

## Rule index

Emit findings ONLY against these rule IDs. Each rule has a **tier** that controls how the
orchestrator handles its findings:

- **objective**: routed through Pass 2 verifier + deterministic post-filter. Surface as
  high-confidence "fix before merge" PR comments.
- **subjective**: skip Pass 2 (Composer-2-as-judge agreement bias makes it unreliable here).
  Surface as "reader-experience suggestions" in a separate PR comment section.

**Read the linked procedure file before emitting findings of that rule.** If a violation
doesn't fit one of these IDs, skip it.

| Rule ID              | Tier       | One-line summary                                                                       | Procedure |
| -------------------- | ---------- | -------------------------------------------------------------------------------------- | --------- |
| `code-imports`       | objective  | Snippets carry all imports, methods inside `@Controller` etc., no undefined symbols    | [audits/A-code-examples.md](audits/A-code-examples.md) |
| `table-link`         | objective  | Reference-table rows link to their worked example (in this note or another)            | [audits/B-table-linking.md](audits/B-table-linking.md) |
| `express-first`      | objective  | NestJS HTTP examples use Express imports/types; Fastify only as adapter notes          | inline below |
| `callout-placement`  | subjective | Snippet-specific callouts placed at first use, not in trailing clusters                | [audits/G-callout-placement.md](audits/G-callout-placement.md) |
| `mental-model`       | subjective | "X vs Y" / lifecycle-rule sections lead with a concrete analogy or rule-of-thumb table | [audits/H-mental-model.md](audits/H-mental-model.md) |
| `headline-vs-code`   | subjective | Headlines and callout titles honestly describe what the code does                      | [audits/I-headline-vs-code.md](audits/I-headline-vs-code.md) |
| `demo-names`         | subjective | Demo names (CLI paths, class names, file stubs) come from a domain the note endorses   | [audits/J-demo-names.md](audits/J-demo-names.md) |
| `callout-severity`   | subjective | Callout severity matches reader stakes (warnings rare, infos common)                   | [audits/K-callout-severity.md](audits/K-callout-severity.md) |
| `ambiguous-wikilink` | subjective | Wikilinks point at the right concept; rephrase prose for vocabulary collisions         | [audits/M-ambiguous-wikilinks.md](audits/M-ambiguous-wikilinks.md) |

**`show-dont-tell` is handled separately** by the deterministic candidate finder
(`scripts/audit-notes/candidates/show-dont-tell.ts`) plus the `kb-show-dont-tell-judge`
skill. Do NOT emit `show-dont-tell` findings here — they would be duplicated and the
open-ended phrasing produces too many false positives.

### Inline rule: `express-first`

NestJS HTTP examples should use Express imports (`from "express"`) and types
(`Request`, `Response`). Flag a snippet that imports from `@nestjs/platform-fastify` or uses
Fastify-only types (`FastifyRequest`, `FastifyReply`) UNLESS the surrounding prose is an
explicit adapter note (the note title, an H2, or the immediately preceding paragraph names
Fastify as the topic).

## What this skill does NOT check

The following live elsewhere and will produce false positives if you try to check them here:

- **Style: em-dashes, `--`, frontmatter schema** — handled by the deterministic Pass 0 in
  `scripts/audit-notes/deterministic.ts`. Do NOT emit `style-em-dash`, `style-double-hyphen`,
  or `frontmatter-schema` findings; the orchestrator adds them and you would only duplicate.
- **Symmetric `related:`, first-mention wikilinks, listing completeness, agents-mirror,
  discoverability** — enforced by `npm run lint:wikilinks`. Skip.
- **Sourcing / comparative claims** (audits L and N) — require browsing primary sources to
  verify. Composer-2 in this pipeline cannot reliably do that, and AGENTS.md's anti-pattern
  list forbids emitting sourcing complaints without evidence. Skip; remain a human pre-commit
  responsibility under `kb-author`.

## Working procedure

1. Read `AGENTS.md`.
2. Read each file in `targets`.
3. For each rule the note plausibly violates, **read the linked `audits/<X>-*.md` file** for its
   exact procedure, then emit findings. Don't audit a rule you haven't read the procedure for.
4. Emit ONE JSON object covering all targets.

## Output schema

Single JSON object, no prose, no Markdown, no fenced block.

```ts
type Report = {
  files: Array<{
    path: string;              // exactly as given in `targets`
    findings: Finding[];       // empty array means clean
  }>;
};

type Finding = {
  rule:
    | "code-imports"
    | "table-link"
    | "express-first"
    | "callout-placement"
    | "mental-model"
    | "headline-vs-code"
    | "demo-names"
    | "callout-severity"
    | "ambiguous-wikilink";
  line: number;                // 1-based; the most relevant line. Use the start of the offending block.
  message: string;             // one sentence. No markdown. No "I think" / "appears to". State the violation.
  evidence?: string;           // optional verbatim snippet (≤ 120 chars)
};
```

Example output:

```json
{
  "files": [
    {
      "path": "content/nestjs/fundamentals/guards.md",
      "findings": [
        {
          "rule": "code-imports",
          "line": 198,
          "message": "Symbols Guard1, Guard2, Guard3 used with no imports or prior definition.",
          "evidence": "@UseGuards(Guard1, Guard2)"
        }
      ]
    }
  ]
}
```

Order findings by `line` ascending within each file.

## Anti-patterns (do NOT emit)

- Findings for rules outside the enum above.
- Findings hedged with "appears to", "may be", "consider".
- Sourcing/comparative-claim complaints — out of scope.
- Findings about a snippet whose imports sit on an earlier line in the same note.
- Findings about reference-table rows whose example sits literally in the next code block under
  the same H2 (immediate adjacency is exempt — see `audits/B-table-linking.md`).
- Style findings inside fenced code blocks or URLs.
- Audit findings for a rule whose `audits/<X>-*.md` file you did NOT read this run.

## Boundaries

This skill is the **read-only** companion to AGENTS.md. It does not author, edit, or fix. For
authoring and fix workflows, use `kb-author`. The verifier (`kb-verifier`) consumes this
skill's output.

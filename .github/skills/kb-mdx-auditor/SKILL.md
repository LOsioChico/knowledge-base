---
name: kb-mdx-auditor
description: >
  Read-only audit pass for Starlight MDX under sites/docs/src/content/docs/. Emits JSON
  keyed by rule IDs aligned with kb-author audits S1–S6. Use for published-site quality,
  not vault content/.md. Invoked by scripts/audit-notes/mdx-audit-notes.ts.
---

# kb-mdx-auditor

Read-only auditor for **published MDX**. Never edits files. Output is **JSON only**.

Read [`docs/PUBLISHING.md`](../../../docs/PUBLISHING.md) and kb-author audits **S1–S6** before emitting findings.

## Inputs

- `targets`: repo-relative paths to `.mdx` under `sites/docs/src/content/docs/`.

## Rule index

| Rule ID | Tier | Summary | Procedure |
| --- | --- | --- | --- |
| `code-imports` | objective | TS fences include imports; methods inside `@Controller` / `@Module`; no undefined symbols | [S5](../kb-author/audits/S5-code-fences-mdx.md) + [A](../kb-author/audits/A-code-examples.md) |
| `table-link` | objective | Reference-table rows link to worked examples (wikilink in prose, `/knowledge-base/...` in tables) | [S4](../kb-author/audits/S4-enrichment-fit.md) + [B](../kb-author/audits/B-table-linking.md) |
| `express-first` | objective | NestJS HTTP snippets use Express types unless prose is an explicit Fastify adapter note | kb-auditor inline rule |
| `mdx-internal-link` | objective | On-site topics use `[[slug\|label]]` in prose; tables use `/knowledge-base/slug/` not `[[\|]]` | [S6](../kb-author/audits/S6-publish-validate.md) |
| `aside-hygiene` | subjective | `<Aside>` type matches stakes (`caution` for footguns); no Obsidian `> [!warning]` in MDX | [S4](../kb-author/audits/S4-enrichment-fit.md) + [K](../kb-author/audits/K-callout-severity.md) |
| `show-dont-tell` | subjective | Behavioral claims in recipe MDX include request + response payloads | [S3](../kb-author/audits/S3-show-dont-tell-mdx.md) |
| `recipe-command-context` | subjective | Each `bash`/`sh` fence has prose above explaining **why** to run it and **what to verify** in output | [S2](../kb-author/audits/S2-reader-clarity.md) + [S1](../kb-author/audits/S1-publish-bar.md) |

Do **not** emit vault-only rules (`related:`, discoverability, `source:` frontmatter).

### `recipe-command-context` (recipes only)

Apply on pages with multiple shell steps: `quickstart.mdx`, `**/recipes/**`, cross-account migrations, numbered `## N.` step sections, or `## Before you start`.

For **each** fenced `bash` or `sh` block:

1. Quote the fence opening line and up to 8 lines above (stop at previous fence or heading).
2. **FAIL** if the fence opens immediately after a `##` / `###` heading with no paragraph between.
3. **FAIL** if no line in that window is a teaching sentence (≥ ~35 chars, not only `export`, table row, or list stub).
4. Good example (pre-flight): prose names `sts get-caller-identity`, says to read `Account`, says stop if IDs mismatch — then the command block.
5. Bad example: `## 1. Pre-flight` then ` ```bash ` with no intervening explanation.

Deterministic pre-check: `bun run lint:mdx-recipe-context` (CI advisory). Emit LLM findings only when the heuristic missed a subtle case or prose is present but useless ("run this command" with no verification hint).

## What this skill does NOT check

- **Em-dash, `--`, MDX frontmatter, Obsidian callouts in MDX** — `mdx-deterministic.ts` Pass 0.
- **Broken wikilinks, table pipes, full-site URL hygiene** — `bun run lint:docs`.
- **Orphan bash after headings, thin context before bash** — `bun run lint:mdx-recipe-context` (advisory in CI; `--strict` blocks structural rules only). Does not compare MDX to `content/` (vault is stale).
- **Vault sourcing** — `kb-source-verifier` on `content/` only.

## Output schema

```ts
type Report = {
  files: Array<{
    path: string;
    findings: Array<{
      rule:
        | "code-imports"
        | "table-link"
        | "express-first"
        | "mdx-internal-link"
        | "aside-hygiene"
        | "show-dont-tell"
        | "recipe-command-context";
      line: number;
      message: string;
      evidence?: string;
    }>;
  }>;
};
```

JSON only — no Markdown fence around the object.

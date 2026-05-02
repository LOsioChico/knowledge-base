// Pass 3: fix proposer.
//
// Runs after Pass 2 (verifier) on the surviving high-tier findings. For each
// finding, asks the LLM to produce a concrete `{before, after, primarySource}`
// proposal that obeys the AGENTS.md "Cite, don't hedge" rule. The proposer is
// instructed to DECLINE (return no fix) when the right action is unclear or
// when the proposed change would just soften the prose.
//
// Designed to be cheap: only fires on findings that survived all earlier
// passes (typically 0-5 per run), single LLM call total, single-purpose
// prompt.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { FlatFinding, SuggestedFix } from "./types.js";

interface ProposalEntry {
  index: number;
  fix?: SuggestedFix;
  declined?: boolean;
  declineReason?: string;
}

interface ProposerReport {
  proposals: ProposalEntry[];
}

function buildProposerPrompt(
  repoRoot: string,
  findings: readonly FlatFinding[],
): string {
  const blocks: string = findings
    .map((f: FlatFinding, idx: number): string => {
      const abs: string = resolve(repoRoot, f.path);
      const text: string = readFileSync(abs, "utf8").split("\n").slice(
        Math.max(0, f.line - 4),
        f.line + 3,
      ).join("\n");
      return [
        `[${idx}] ${f.path}:${f.line}  rule=${f.rule}`,
        `MESSAGE: ${f.message}`,
        `EVIDENCE: ${f.evidence ?? "(none)"}`,
        "CONTEXT (±3 lines around the cited line):",
        "---",
        text,
        "---",
      ].join("\n");
    })
    .join("\n\n");

  return [
    "You are proposing concrete fixes for audit findings on a personal NestJS knowledge base.",
    "",
    "AGENTS.md rules you MUST obey:",
    "",
    "1. Cite, don't hedge. Forbidden: replacing a specific claim (e.g. `gzip/deflate/brotli`,",
    "   `getAllAndMerge returns an object when only one entry exists`) with a vague generalization",
    "   (`compression`, `sharper type inference`). Required: keep the specific claim, ADD an inline",
    "   primary-source link with a line anchor where applicable.",
    "",
    "2. Every fix must either ADD information (a URL, a named API in backticks, a `#L<n>-L<m>` anchor)",
    "   or stay the same length. A proposal that subtracts information is a regression.",
    "",
    "3. Forbidden hedge phrases: \"may apply\", \"in some cases\", \"often\", \"tends to\", \"generally\",",
    "   \"depending on\", \"broadly\". If your `after` text contains one of these without an inline citation",
    "   right next to it, DECLINE the proposal instead.",
    "",
    "4. Decline freely. If you cannot produce a concrete fix that adds a real primary-source URL",
    "   (not a guess, not a fabricated line anchor), return `declined: true` with a one-sentence reason.",
    "   The downstream human triager prefers no proposal over a bad proposal.",
    "",
    "5. Code identifiers in backticks. URLs as bare links. No prose padding.",
    "",
    "Output schema (JSON only, no markdown, no fenced block):",
    "",
    "{",
    "  \"proposals\": [",
    "    {",
    "      \"index\": 0,",
    "      \"fix\": {",
    "        \"kind\": \"add-citation\" | \"add-information\" | \"rewrite\",",
    "        \"before\": \"<the exact substring on the cited line that needs to change>\",",
    "        \"after\":  \"<the proposed replacement; must include the primary source link inline if kind=add-citation>\",",
    "        \"primarySource\": \"<URL with line anchor if applicable; omit if kind=rewrite and no source needed>\",",
    "        \"rationale\": \"<one sentence: which AGENTS.md rule this satisfies and why this fix doesn't subtract information>\"",
    "      }",
    "    },",
    "    {",
    "      \"index\": 1,",
    "      \"declined\": true,",
    "      \"declineReason\": \"<one sentence>\"",
    "    }",
    "  ]",
    "}",
    "",
    "Findings to fix:",
    "",
    blocks,
  ].join("\n");
}

export interface ProposerDeps {
  runAgent: (prompt: string, label: string) => Promise<string>;
  extractJson: (text: string) => string;
  log: (msg: string) => void;
  repoRoot: string;
}

export async function runFixProposerPass(
  findings: readonly FlatFinding[],
  deps: ProposerDeps,
): Promise<FlatFinding[]> {
  if (findings.length === 0) return findings.slice();
  deps.log(`\n--- pass 3 (fix-proposer): ${findings.length} finding(s) ---`);
  const prompt: string = buildProposerPrompt(deps.repoRoot, findings);
  let parsed: ProposerReport;
  try {
    const text: string = await deps.runAgent(prompt, "fix-proposer");
    const json: string = deps.extractJson(text);
    parsed = JSON.parse(json) as ProposerReport;
  } catch (err: unknown) {
    const msg: string = err instanceof Error ? err.message : String(err);
    deps.log(`[pass-3] proposer failed: ${msg}; emitting findings without fixes`);
    return findings.slice();
  }
  const proposals: readonly ProposalEntry[] = Array.isArray(parsed.proposals)
    ? parsed.proposals
    : [];
  const byIndex: Map<number, ProposalEntry> = new Map(
    proposals.map((p: ProposalEntry): [number, ProposalEntry] => [p.index, p]),
  );
  let proposed: number = 0;
  let declined: number = 0;
  const enriched: FlatFinding[] = findings.map(
    (f: FlatFinding, idx: number): FlatFinding => {
      const entry: ProposalEntry | undefined = byIndex.get(idx);
      if (entry === undefined) return f;
      if (entry.fix !== undefined) {
        proposed += 1;
        return { ...f, suggestedFix: entry.fix };
      }
      if (entry.declined === true) {
        declined += 1;
      }
      return f;
    },
  );
  deps.log(`[pass-3] proposed=${proposed} declined=${declined}`);
  return enriched;
}

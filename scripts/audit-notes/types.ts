// Shared types for the audit pipeline.

export type RuleId =
  // Pass 0 (deterministic)
  | "frontmatter-schema"
  | "style-em-dash"
  | "style-double-hyphen"
  // Pass 1 (LLM auditor) — letters map to .github/skills/kb-author/audits/*
  | "code-imports" //         audit A
  | "table-link" //           audit B
  | "show-dont-tell" //       audit F
  | "callout-placement" //    audit G
  | "mental-model" //         audit H
  | "headline-vs-code" //     audit I
  | "demo-names" //           audit J
  | "callout-severity" //     audit K
  | "ambiguous-wikilink" //   audit M
  | "source-verification" //  audit N (always on; requires CURSOR_API_KEY)
  | "express-first";

export interface Finding {
  rule: RuleId;
  line: number;
  message: string;
  evidence?: string;
}

export interface FileReport {
  path: string;
  findings: Finding[];
}

export interface Report {
  files: FileReport[];
}

export interface FlatFinding extends Finding {
  path: string;
}

export interface VerifiedFinding extends FlatFinding {
  quote: string;
  verdict: "VERIFIED" | "REJECTED";
  rationale: string;
}

export interface VerifiedReport {
  verifiedFindings: VerifiedFinding[];
}

// Confidence tier:
//   - "high":   Pass 0 deterministic OR objective Pass-1 rule that survived
//               post-filter and verifier. Render as "fix before merge".
//   - "advisory": subjective Pass-1 rule. Render as "reader-experience
//                 suggestion; may be opinionated".
export type ConfidenceTier = "high" | "advisory";

export const OBJECTIVE_LLM_RULES: ReadonlySet<RuleId> = new Set<RuleId>([
  "code-imports",
  "table-link",
  "express-first",
  "source-verification",
]);

export const SUBJECTIVE_LLM_RULES: ReadonlySet<RuleId> = new Set<RuleId>([
  "show-dont-tell",
  "callout-placement",
  "mental-model",
  "headline-vs-code",
  "demo-names",
  "callout-severity",
  "ambiguous-wikilink",
]);

export interface TieredFinding extends FlatFinding {
  tier: ConfidenceTier;
}

export interface TieredFileReport {
  path: string;
  findings: Array<Finding & { tier: ConfidenceTier }>;
}

export interface TieredReport {
  files: TieredFileReport[];
}

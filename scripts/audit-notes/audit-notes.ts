#!/usr/bin/env -S npx tsx
// Three-pass audit pipeline:
//   Pass 0 — deterministic (no LLM): style + frontmatter
//   Pass 1 — LLM auditor (kb-auditor skill): code-imports, table-link, express-first
//   Pass 2 — LLM verifier (kb-verifier skill, adversarial): drops unverifiable Pass 1 findings
//
// Final report = Pass 0 findings ∪ verified(Pass 1).
//
// Usage:
//   CURSOR_API_KEY=... yarn start <file.md> [more.md ...]
//
// Flags:
//   --no-verify   skip Pass 2 verifier (faster; useful for local debugging)
//   --json        emit only the final JSON to stdout (for CI piping)
//
// Source verification (Pass 1b) is always on. CURSOR_API_KEY must be set;
// the script exits non-zero on missing key or any auth/network failure.

import { Agent } from "@cursor/sdk";
import type { Run, RunResult, SDKMessage } from "@cursor/sdk";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { runDeterministic, runDeterministicAdvisory } from "./deterministic.js";
import { runFixProposerPass } from "./fix-proposer.js";
import { postFilter } from "./post-filter.js";
import { findShowDontTellCandidates } from "./candidates/show-dont-tell.js";
import type { ShowDontTellCandidate } from "./candidates/show-dont-tell.js";
import { groundFindings } from "./ground.js";
import { runSourceVerifyPass } from "./source-verify.js";
import { runAnchorVerifyPass } from "./anchor-verify.js";
import { runFactGroundPass } from "./fact-ground.js";
import type {
  ConfidenceTier,
  FileReport,
  Finding,
  FlatFinding,
  Report,
  TieredFileReport,
  TieredReport,
  VerifiedFinding,
  VerifiedReport,
} from "./types.js";
import { OBJECTIVE_LLM_RULES } from "./types.js";

const REPO_ROOT: string = resolve(
  fileURLToPath(new URL("../..", import.meta.url)),
);
const DEFAULT_TARGETS: readonly string[] = [
  "content/nestjs/fundamentals/guards.md",
];

interface Args {
  targets: string[];
  noVerify: boolean;
  jsonOnly: boolean;
}

// Resolve targets from `git diff --name-only <ref>` (committed + staged +
// unstaged) filtered to existing markdown files under content/. Returns the
// repo-relative paths.
function targetsFromBase(ref: string): string[] {
  let raw: string;
  try {
    raw = execSync(`git diff --name-only ${ref} -- 'content/**/*.md'`, {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
  } catch (err: unknown) {
    const msg: string = err instanceof Error ? err.message : String(err);
    log(`error: \`git diff --name-only ${ref}\` failed: ${msg}`);
    process.exit(2);
  }
  const all: string[] = raw
    .split("\n")
    .map((s: string): string => s.trim())
    .filter((s: string): boolean => s.length > 0);
  return all.filter((p: string): boolean =>
    existsSync(resolve(REPO_ROOT, p)),
  );
}

function parseArgs(): Args {
  const argv: string[] = process.argv.slice(2);
  const noVerify: boolean = argv.includes("--no-verify");
  const jsonOnly: boolean = argv.includes("--json");
  const baseIdx: number = argv.indexOf("--base");
  const baseRef: string | null =
    baseIdx !== -1 ? (argv[baseIdx + 1] ?? null) : null;
  if (baseIdx !== -1 && baseRef === null) {
    log("error: --base requires a git ref argument (e.g. --base HEAD~1)");
    process.exit(2);
  }
  const positional: string[] = argv.filter((a: string, i: number): boolean => {
    if (a.startsWith("--")) return false;
    if (baseIdx !== -1 && i === baseIdx + 1) return false;
    return true;
  });

  let targets: string[];
  if (baseRef !== null) {
    targets = targetsFromBase(baseRef);
    log(`[args] --base ${baseRef} resolved to ${targets.length} file(s)`);
    if (positional.length > 0) {
      log(
        `[args] ignoring ${positional.length} positional arg(s) because --base was given`,
      );
    }
  } else {
    const raw: readonly string[] =
      positional.length > 0 ? positional : DEFAULT_TARGETS;
    targets = raw.map((p: string): string =>
      relative(REPO_ROOT, resolve(p)),
    );
    const missing: string[] = targets.filter(
      (p: string): boolean => !existsSync(resolve(REPO_ROOT, p)),
    );
    if (missing.length > 0) {
      log(`error: file(s) not found: ${missing.join(", ")}`);
      process.exit(2);
    }
  }
  return { targets, noVerify, jsonOnly };
}

let JSON_ONLY: boolean = false;
function log(msg: string): void {
  if (!JSON_ONLY) console.error(msg);
}

async function streamAssistantText(run: Run): Promise<string> {
  let buf: string = "";
  for await (const event of run.stream() as AsyncIterable<SDKMessage>) {
    switch (event.type) {
      case "assistant": {
        for (const block of event.message.content) {
          if (block.type === "text") {
            buf += block.text;
            if (!JSON_ONLY) process.stderr.write(block.text);
          }
        }
        break;
      }
      case "tool_call": {
        if (event.status === "running") log(`\n[tool] ${event.name}`);
        break;
      }
      case "status": {
        log(`[status] ${event.status}`);
        break;
      }
    }
  }
  return buf;
}

// Extract a JSON object from arbitrary assistant text.
// Strategy: prefer the last fenced ```json block (assistant reliably emits
// the schema-conformant payload last). Fall back to the last balanced
// top-level `{...}` substring that JSON.parse accepts. We scan from the end
// because the assistant often narrates findings first, and prose can quote
// code containing stray `{` (e.g. `import { Foo } from '...'`) that the
// previous "first `{`" strategy misparsed.
function extractJson(text: string): string {
  const fenceRe: RegExp = /```json\s*\n([\s\S]*?)\n```/g;
  let lastFence: string | null = null;
  for (let m: RegExpExecArray | null; (m = fenceRe.exec(text)) !== null; ) {
    lastFence = m[1] ?? null;
  }
  if (lastFence !== null) {
    try {
      JSON.parse(lastFence);
      return lastFence;
    } catch {
      // fall through to balanced-scan
    }
  }
  // Walk every `{`...balanced-`}` substring; return the longest one that
  // parses (the outermost / wrapping object, not a nested fragment).
  let best: string | null = null;
  for (let start: number = 0; start < text.length; start++) {
    if (text[start] !== "{") continue;
    let depth: number = 0;
    let inString: boolean = false;
    let escape: boolean = false;
    for (let i: number = start; i < text.length; i++) {
      const ch: string = text[i] ?? "";
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const candidate: string = text.slice(start, i + 1);
          try {
            JSON.parse(candidate);
            if (best === null || candidate.length > best.length) {
              best = candidate;
            }
          } catch {
            // not parseable; ignore
          }
          break;
        }
      }
    }
  }
  if (best !== null) return best;
  throw new Error("no parseable JSON object found in assistant output");
}

async function runAgent(prompt: string, label: string): Promise<string> {
  const apiKey: string = process.env["CURSOR_API_KEY"] ?? "";
  const maxAttempts: number = 3;
  let lastError: unknown = null;
  for (let attempt: number = 1; attempt <= maxAttempts; attempt++) {
    log(
      `\n--- ${label}${attempt > 1 ? ` (attempt ${attempt}/${maxAttempts})` : ""} ---`,
    );
    const t0: number = Date.now();
    try {
      await using agent = await Agent.create({
        apiKey,
        // Per `Cursor.models.list()` (queried 2026-05-02), `composer-2` exposes
        // a single `fast: "true" | "false"` parameter and `fast=true` is the
        // default variant (`isDefault: true`). Passing it explicitly pins the
        // selection so the audit doesn't drift if Cursor changes the default.
        model: { id: "composer-2", params: [{ id: "fast", value: "true" }] },
        local: { cwd: REPO_ROOT, settingSources: ["project"] },
      });
      const run: Run = await agent.send(prompt);
      const text: string = await streamAssistantText(run);
      const result: RunResult = await run.wait();
      const elapsed: string = ((Date.now() - t0) / 1000).toFixed(1);
      log(
        `\n[${label}] status=${result.status} duration=${elapsed}s runId=${result.id}`,
      );
      if (result.status !== "finished") {
        throw new Error(`${label} failed: status=${result.status}`);
      }
      return text;
    } catch (err: unknown) {
      lastError = err;
      const elapsed: string = ((Date.now() - t0) / 1000).toFixed(1);
      const msg: string = err instanceof Error ? err.message : String(err);
      log(`[${label}] attempt ${attempt} failed after ${elapsed}s: ${msg}`);
      if (/\b(401|403|unauthor|forbidden|invalid.*api.*key|api.*key.*invalid|authentication)\b/i.test(msg)) {
        log("error: CURSOR_API_KEY appears invalid; aborting (source verification is mandatory)");
        process.exit(2);
      }
      if (attempt < maxAttempts) {
        const backoffMs: number = 2000 * 2 ** (attempt - 1);
        log(`[${label}] retrying in ${backoffMs}ms`);
        await new Promise<void>((r): void => {
          setTimeout(r, backoffMs);
        });
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`${label} failed after ${maxAttempts} attempts`);
}

function buildAuditorPrompt(targets: readonly string[]): string {
  const list: string = targets.map((p: string): string => `- ${p}`).join("\n");
  return [
    "Use the `kb-auditor` skill to audit the following notes against AGENTS.md.",
    "",
    "Targets:",
    list,
    "",
    "Output a single JSON object matching the skill's `Report` schema. JSON only — no prose, no Markdown, no fenced block.",
  ].join("\n");
}

function buildVerifierPrompt(findings: FlatFinding[]): string {
  return [
    "Use the `kb-verifier` skill to adversarially verify the following findings.",
    "",
    "Findings:",
    JSON.stringify(findings, null, 2),
    "",
    "For each finding, locate the cited line in the cited file, quote it verbatim, and decide VERIFIED or REJECTED.",
    "Default to REJECTED unless you can quote evidence that clearly maps to the rule.",
    "Output a single JSON object matching the skill's `VerifiedReport` schema. JSON only.",
  ].join("\n");
}

async function runAuditorPass(targets: readonly string[]): Promise<Report> {
  const prompt: string = buildAuditorPrompt(targets);
  const text: string = await runAgent(prompt, "audit");
  const json: string = extractJson(text);
  return JSON.parse(json) as Report;
}

async function runVerifierPass(
  findings: FlatFinding[],
): Promise<VerifiedReport> {
  if (findings.length === 0) return { verifiedFindings: [] };
  const prompt: string = buildVerifierPrompt(findings);
  const text: string = await runAgent(prompt, "verify");
  const json: string = extractJson(text);
  return JSON.parse(json) as VerifiedReport;
}

// Pass 1a: deterministic candidate finder + binary LLM judge for show-dont-tell.
interface JudgeReport {
  judgments: Array<{
    path: string;
    line: number;
    verdict: "shown" | "missing";
    quote: string;
    rationale: string;
  }>;
}

function buildShowDontTellPrompt(
  candidates: readonly ShowDontTellCandidate[],
): string {
  return [
    "Use the `kb-show-dont-tell-judge` skill. For each candidate below, decide whether the",
    "behavioral claim on that line is demonstrated by a request+response pair within the",
    "`context` field. Return one judgment per candidate.",
    "",
    "Candidates:",
    JSON.stringify(candidates, null, 2),
    "",
    "Output a single JSON object matching the skill's `Report` schema. JSON only.",
  ].join("\n");
}

async function runShowDontTellPass(
  targets: readonly string[],
): Promise<FlatFinding[]> {
  const candidates: ShowDontTellCandidate[] = targets.flatMap(
    (p: string): ShowDontTellCandidate[] =>
      findShowDontTellCandidates(REPO_ROOT, p),
  );
  log(`\n[pass-1a] show-dont-tell candidates: ${candidates.length}`);
  if (candidates.length === 0) return [];
  const text: string = await runAgent(
    buildShowDontTellPrompt(candidates),
    "judge-sdt",
  );
  const json: string = extractJson(text);
  const parsed: JudgeReport = JSON.parse(json) as JudgeReport;
  const missing = parsed.judgments.filter(
    (j): boolean => j.verdict === "missing",
  );
  log(
    `[pass-1a] judge: ${parsed.judgments.length} judged, ${missing.length} missing`,
  );
  return missing.map(
    (j): FlatFinding => ({
      rule: "show-dont-tell",
      path: j.path,
      line: j.line,
      message: `Behavioral claim is asserted but not shown by a request+response pair within the next 30 lines. ${j.rationale}`,
      evidence: j.quote.slice(0, 120),
    }),
  );
}

function flatten(report: Report): FlatFinding[] {
  return report.files.flatMap((f: FileReport): FlatFinding[] =>
    f.findings.map((finding): FlatFinding => ({ ...finding, path: f.path })),
  );
}

function nest(targets: readonly string[], flat: FlatFinding[]): Report {
  const byPath: Map<string, FileReport> = new Map();
  for (const t of targets) byPath.set(t, { path: t, findings: [] });
  for (const f of flat) {
    const file: FileReport | undefined = byPath.get(f.path);
    if (file === undefined) continue;
    const { path: _path, ...rest } = f;
    void _path;
    file.findings.push(rest);
  }
  for (const file of byPath.values()) {
    file.findings.sort((a, b): number => a.line - b.line);
  }
  return { files: Array.from(byPath.values()) };
}

function nestTiered(
  targets: readonly string[],
  flat: Array<FlatFinding & { tier: ConfidenceTier }>,
): TieredReport {
  const byPath: Map<string, TieredFileReport> = new Map();
  for (const t of targets) byPath.set(t, { path: t, findings: [] });
  for (const f of flat) {
    const file: TieredFileReport | undefined = byPath.get(f.path);
    if (file === undefined) continue;
    const { path: _path, ...rest } = f;
    void _path;
    const entry: Finding & { tier: ConfidenceTier } = rest;
    file.findings.push(entry);
  }
  for (const file of byPath.values()) {
    // Sort: high before advisory, then by line.
    file.findings.sort((a, b): number => {
      if (a.tier !== b.tier) return a.tier === "high" ? -1 : 1;
      return a.line - b.line;
    });
  }
  return { files: Array.from(byPath.values()) };
}

async function main(): Promise<void> {
  const args: Args = parseArgs();
  JSON_ONLY = args.jsonOnly;

  if ((process.env["CURSOR_API_KEY"] ?? "") === "") {
    log("error: CURSOR_API_KEY is not set; source verification is mandatory");
    process.exit(2);
  }

  log(`[audit] cwd=${REPO_ROOT}`);
  log(`[audit] targets=${args.targets.join(", ")}`);
  log(`[audit] verify=${!args.noVerify}`);

  if (args.targets.length === 0) {
    log("[audit] no targets to audit; exiting clean");
    if (JSON_ONLY) {
      process.stdout.write(JSON.stringify({ files: [] }, null, 2) + "\n");
    }
    process.exit(0);
  }

  // Pass 0: deterministic
  log("\n--- pass 0 (deterministic) ---");
  const det: FileReport[] = args.targets.map(
    (p: string): FileReport => runDeterministic(resolve(REPO_ROOT, p), p),
  );
  const detFlat: FlatFinding[] = flatten({ files: det });
  log(`[pass-0] ${detFlat.length} findings`);

  // Pass 0b: deterministic advisory (hedge sniff). Routed to the advisory
  // tier so existing hedges in the vault don't wedge CI.
  const detAdvisory: FileReport[] = args.targets.map(
    (p: string): FileReport =>
      runDeterministicAdvisory(resolve(REPO_ROOT, p), p),
  );
  const detAdvisoryFlat: FlatFinding[] = flatten({ files: detAdvisory });
  log(`[pass-0b] ${detAdvisoryFlat.length} advisory hedge findings`);

  // Pass 1, 1a, 1b run concurrently — they're independent and all network-bound.
  log("\n--- pass 1 (auditor) + 1a (show-dont-tell) + 1b (source verify) in parallel ---");
  const [audit, sdtFindings, sourceFindings] = await Promise.all([
    runAuditorPass(args.targets),
    runShowDontTellPass(args.targets),
    runSourceVerifyPass({
      repoRoot: REPO_ROOT,
      targets: args.targets,
      runAgent,
      extractJson,
      log,
    }),
  ]);
  const auditFlat: FlatFinding[] = flatten(audit);
  log(`[pass-1]  ${auditFlat.length} candidate findings`);
  log(`[pass-1a] ${sdtFindings.length} show-dont-tell finding(s)`);
  log(`[pass-1b] ${sourceFindings.length} source-verification finding(s)`);

  // Pass 1c: deterministic anchor verifier. Drops `source-verification`
  // findings whose only complaint is a wrong GitHub line anchor when the
  // anchor actually points at a definition of the cited symbol. This
  // catches the most common LLM false-positive pattern (~50% rate
  // empirically) before it reaches Pass 3 / human triage.
  const anchorVerified = await runAnchorVerifyPass(sourceFindings, {
    repoRoot: REPO_ROOT,
    log,
  });
  if (anchorVerified.dropped.length > 0) {
    log(
      `[pass-1c] anchor-verifier dropped ${anchorVerified.dropped.length} false-positive(s) (original anchor was correct)`,
    );
  }

  // Pass 1d: deterministic fact-grounding. For each "Not supported by"
  // source-verification finding, extract high-information terms from the
  // claim and grep them across the cached source extracts. If ALL terms
  // appear in at least one source, the LLM missed it — drop as a false
  // positive. Conservative: never touches "Contradicts" or "Plausible but
  // unsourced" findings.
  const factGrounded = runFactGroundPass(anchorVerified.kept, {
    repoRoot: REPO_ROOT,
    log,
  });
  if (factGrounded.dropped.length > 0) {
    log(
      `[pass-1d] fact-grounding dropped ${factGrounded.dropped.length} false-positive(s) (claim terms found in source extracts)`,
    );
  }
  const verifiedSourceFindings: FlatFinding[] = factGrounded.kept;

  // Span-grounding (technique C): drop any LLM finding whose evidence quote
  // is not a substring of the file within ±10 lines of the cited line.
  const groundedAudit = groundFindings(REPO_ROOT, auditFlat, 10);
  if (groundedAudit.dropped.length > 0) {
    log(
      `[ground] dropped ${groundedAudit.dropped.length} pass-1 finding(s) lacking verbatim evidence:`,
    );
    for (const d of groundedAudit.dropped) {
      log(`  - ${d.path}:${d.line} [${d.rule}] no quote in ±10 lines`);
    }
  }
  const groundedSdt = groundFindings(REPO_ROOT, sdtFindings, 10);
  if (groundedSdt.dropped.length > 0) {
    log(
      `[ground] dropped ${groundedSdt.dropped.length} pass-1a finding(s) lacking verbatim evidence:`,
    );
  }

  // Split LLM findings by tier:
  //   - objective: route through post-filter + verifier (high confidence)
  //   - subjective: skip both; surface as advisory suggestions
  const objectiveCandidates: FlatFinding[] = groundedAudit.kept.filter(
    (f: FlatFinding): boolean => OBJECTIVE_LLM_RULES.has(f.rule),
  );
  const subjectiveCandidates: FlatFinding[] = groundedAudit.kept.filter(
    (f: FlatFinding): boolean => !OBJECTIVE_LLM_RULES.has(f.rule),
  );
  log(
    `[pass-1] split: objective=${objectiveCandidates.length} subjective=${subjectiveCandidates.length}`,
  );

  // Pass 1.5: deterministic post-filter (objective rules only).
  const { kept: filteredFlat, dropped } = postFilter(
    REPO_ROOT,
    objectiveCandidates,
  );
  if (dropped.length > 0) {
    log(`[pass-1.5] post-filter dropped ${dropped.length} finding(s):`);
    for (const { finding, reason } of dropped) {
      log(`  - ${finding.path}:${finding.line} [${finding.rule}] ${reason}`);
    }
  }
  log(`[pass-1.5] ${filteredFlat.length} finding(s) survive to Pass 2`);

  // Pass 2: LLM verifier (objective only, optional).
  let verifiedFlat: FlatFinding[];
  if (args.noVerify) {
    verifiedFlat = filteredFlat;
  } else {
    const verified: VerifiedReport = await runVerifierPass(filteredFlat);
    const kept: VerifiedFinding[] = verified.verifiedFindings.filter(
      (v: VerifiedFinding): boolean => v.verdict === "VERIFIED",
    );
    const rejected: number = verified.verifiedFindings.length - kept.length;
    log(`\n[pass-2] kept=${kept.length} rejected=${rejected}`);
    verifiedFlat = kept.map(
      (v: VerifiedFinding): FlatFinding => ({
        rule: v.rule,
        line: v.line,
        message: v.message,
        path: v.path,
        ...(v.quote !== undefined ? { evidence: v.quote.slice(0, 120) } : {}),
      }),
    );
  }

  // Pass 3: fix-proposer. Runs on the union of high-tier findings (verified
  // objective + grounded show-dont-tell + source-verification). Cheap because
  // post-verification the count is typically 0-5.
  //
  // Split source-verification findings: "Plausible but unsourced" findings are
  // advisory (action is "add a `source:` URL", not "rewrite the prose"). Real
  // contradictions and unsupported claims stay high-tier.
  const advisorySourceFindings: FlatFinding[] = verifiedSourceFindings.filter(
    (f: FlatFinding): boolean => f.message.startsWith("Plausible but unsourced"),
  );
  const highSourceFindings: FlatFinding[] = verifiedSourceFindings.filter(
    (f: FlatFinding): boolean => !f.message.startsWith("Plausible but unsourced"),
  );
  const highTierForFixes: FlatFinding[] = [
    ...verifiedFlat,
    ...groundedSdt.kept,
    ...highSourceFindings,
  ];
  const enrichedHighTier: FlatFinding[] = await runFixProposerPass(
    highTierForFixes,
    { runAgent, extractJson, log, repoRoot: REPO_ROOT },
  );
  const enrichedVerified: FlatFinding[] = enrichedHighTier.slice(
    0,
    verifiedFlat.length,
  );
  const enrichedSdt: FlatFinding[] = enrichedHighTier.slice(
    verifiedFlat.length,
    verifiedFlat.length + groundedSdt.kept.length,
  );
  const enrichedSources: FlatFinding[] = enrichedHighTier.slice(
    verifiedFlat.length + groundedSdt.kept.length,
  );

  // Merge with tiers: deterministic + verified objective + grounded show-dont-tell => high.
  // Subjective candidates (other than show-dont-tell) => advisory.
  // "Plausible but unsourced" source-verification findings also => advisory
  // (action is "add a `source:` URL", not "rewrite the prose").
  const allTiered: Array<FlatFinding & { tier: ConfidenceTier }> = [
    ...detFlat.map(
      (f: FlatFinding): FlatFinding & { tier: ConfidenceTier } => ({
        ...f,
        tier: "high",
      }),
    ),
    ...verifiedFlat.map(
      (f: FlatFinding): FlatFinding & { tier: ConfidenceTier } => {
        const enriched: FlatFinding | undefined = enrichedVerified.find(
          (e: FlatFinding): boolean =>
            e.path === f.path && e.line === f.line && e.rule === f.rule,
        );
        return { ...f, ...(enriched ?? {}), tier: "high" };
      },
    ),
    ...groundedSdt.kept.map(
      (f: FlatFinding): FlatFinding & { tier: ConfidenceTier } => {
        const enriched: FlatFinding | undefined = enrichedSdt.find(
          (e: FlatFinding): boolean =>
            e.path === f.path && e.line === f.line && e.rule === f.rule,
        );
        return { ...f, ...(enriched ?? {}), tier: "high" };
      },
    ),
    ...highSourceFindings.map(
      (f: FlatFinding): FlatFinding & { tier: ConfidenceTier } => {
        const enriched: FlatFinding | undefined = enrichedSources.find(
          (e: FlatFinding): boolean =>
            e.path === f.path && e.line === f.line && e.rule === f.rule,
        );
        return { ...f, ...(enriched ?? {}), tier: "high" };
      },
    ),
    ...advisorySourceFindings.map(
      (f: FlatFinding): FlatFinding & { tier: ConfidenceTier } => ({
        ...f,
        tier: "advisory",
      }),
    ),
    ...subjectiveCandidates.map(
      (f: FlatFinding): FlatFinding & { tier: ConfidenceTier } => ({
        ...f,
        tier: "advisory",
      }),
    ),
    ...detAdvisoryFlat.map(
      (f: FlatFinding): FlatFinding & { tier: ConfidenceTier } => ({
        ...f,
        tier: "advisory",
      }),
    ),
  ];

  const finalReport: TieredReport = nestTiered(args.targets, allTiered);

  if (JSON_ONLY) {
    process.stdout.write(JSON.stringify(finalReport, null, 2) + "\n");
  } else {
    log("\n--- final report ---");
    process.stdout.write(JSON.stringify(finalReport, null, 2) + "\n");
  }

  const totals = finalReport.files.reduce(
    (acc: { high: number; advisory: number }, f: TieredFileReport) => {
      for (const x of f.findings) {
        if (x.tier === "high") acc.high += 1;
        else acc.advisory += 1;
      }
      return acc;
    },
    { high: 0, advisory: 0 },
  );
  log(`\n[totals] high=${totals.high} advisory=${totals.advisory}`);
  // Exit 1 only on high-confidence findings; advisory ones are non-blocking.
  process.exit(totals.high > 0 ? 1 : 0);
}

main().catch((err: unknown): void => {
  console.error("audit failed:", err);
  process.exit(2);
});

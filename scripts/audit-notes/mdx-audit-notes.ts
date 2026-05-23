#!/usr/bin/env -S npx tsx
// MDX audit pipeline for sites/docs/src/content/docs/**/*.mdx
//
//   mdx-ci     — Pass 0 deterministic (no LLM)
//   mdx-triage — Pass 0 + kb-mdx-auditor LLM
//   mdx-full   — Pass 0 + 0b + auditor + show-dont-tell + verifier (objective)
//
// Usage:
//   CURSOR_API_KEY=... tsx mdx-audit-notes.ts --profile=mdx-triage --base HEAD~1
//   tsx mdx-audit-notes.ts --profile=mdx-ci sites/docs/src/content/docs/nestjs/foo.mdx

import { Agent } from "@cursor/sdk";
import type { Run, RunResult, SDKMessage } from "@cursor/sdk";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { readFromCache, writeToCache } from "./cache-helper.js";

import { findShowDontTellCandidates } from "./candidates/show-dont-tell.js";
import type { ShowDontTellCandidate } from "./candidates/show-dont-tell.js";
import { extractJson } from "./extract-json.js";
import { groundFindings } from "./ground.js";
import {
  runMdxDeterministic,
  runMdxDeterministicAdvisory,
} from "./mdx-deterministic.js";
import { postFilter } from "./post-filter.js";
import type {
  ConfidenceTier,
  FileReport,
  FlatFinding,
  Report,
  TieredFileReport,
  TieredReport,
  VerifiedFinding,
  VerifiedReport,
} from "./types.js";

const REPO_ROOT: string = resolve(
  fileURLToPath(new URL("../..", import.meta.url)),
);
const MDX_PREFIX: string = "sites/docs/src/content/docs/";

export type MdxAuditProfile = "mdx-ci" | "mdx-triage" | "mdx-full";

const OBJECTIVE_MDX_RULES: ReadonlySet<string> = new Set([
  "code-imports",
  "table-link",
  "express-first",
  "mdx-internal-link",
]);

interface Args {
  targets: string[];
  jsonOnly: boolean;
  profile: MdxAuditProfile;
  noVerify: boolean;
}

function parseProfile(argv: readonly string[]): MdxAuditProfile {
  for (const arg of argv) {
    const eq: RegExpMatchArray | null =
      /^--profile=(mdx-ci|mdx-triage|mdx-full)$/.exec(arg);
    if (eq !== null) return eq[1] as MdxAuditProfile;
  }
  const idx: number = argv.indexOf("--profile");
  if (idx !== -1) {
    const val: string | undefined = argv[idx + 1];
    if (val === "mdx-ci" || val === "mdx-triage" || val === "mdx-full") {
      return val;
    }
    log("error: --profile requires mdx-ci, mdx-triage, or mdx-full");
    process.exit(2);
  }
  return "mdx-triage";
}

function targetsFromBase(ref: string): string[] {
  let raw: string;
  try {
    raw = execFileSync("git", ["diff", "--name-only", ref], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
  } catch (err: unknown) {
    const msg: string = err instanceof Error ? err.message : String(err);
    log(`error: git diff --name-only ${ref} failed: ${msg}`);
    process.exit(2);
  }
  return raw
    .split("\n")
    .map((s: string): string => s.trim())
    .filter((s: string): boolean => s.length > 0)
    .filter(
      (p: string): boolean =>
        p.startsWith(MDX_PREFIX) && p.endsWith(".mdx"),
    )
    .filter((p: string): boolean => existsSync(resolve(REPO_ROOT, p)));
}

function parseArgs(): Args {
  const argv: string[] = process.argv.slice(2);
  const profile: MdxAuditProfile = parseProfile(argv);
  const jsonOnly: boolean = argv.includes("--json");
  const noVerify: boolean = argv.includes("--skip-verify");
  const baseIdx: number = argv.indexOf("--base");
  const profileIdx: number = argv.indexOf("--profile");
  const baseRef: string | null =
    baseIdx !== -1 ? (argv[baseIdx + 1] ?? null) : null;
  if (baseIdx !== -1 && baseRef === null) {
    log("error: --base requires a git ref");
    process.exit(2);
  }

  const positional: string[] = argv.filter((a: string, i: number): boolean => {
    if (a.startsWith("--")) return false;
    if (baseIdx !== -1 && i === baseIdx + 1) return false;
    if (profileIdx !== -1 && i === profileIdx + 1) return false;
    if (/^--profile=(mdx-ci|mdx-triage|mdx-full)$/.test(a)) return false;
    return true;
  });

  let targets: string[];
  if (baseRef !== null) {
    targets = targetsFromBase(baseRef);
    log(`[args] --base ${baseRef} → ${targets.length} MDX file(s)`);
  } else if (positional.length > 0) {
    targets = positional.map((p: string): string =>
      relative(REPO_ROOT, resolve(REPO_ROOT, p)),
    );
  } else {
    log("error: pass MDX paths or --base <ref>");
    process.exit(2);
  }

  const missing: string[] = targets.filter(
    (p: string): boolean => !existsSync(resolve(REPO_ROOT, p)),
  );
  if (missing.length > 0) {
    log(`error: file(s) not found: ${missing.join(", ")}`);
    process.exit(2);
  }

  return { targets, jsonOnly, profile, noVerify };
}

let JSON_ONLY = false;
let writingFinalJson = false;

function log(msg: string): void {
  if (!JSON_ONLY || msg.startsWith("error:")) console.error(msg);
}

function flatten(report: Report): FlatFinding[] {
  return report.files.flatMap((f) =>
    f.findings.map((finding) => ({ ...finding, path: f.path })),
  );
}

function nestTiered(
  targets: readonly string[],
  flat: Array<FlatFinding & { tier: ConfidenceTier }>,
): TieredReport {
  const byPath: Map<string, TieredFileReport> = new Map();
  for (const t of targets) byPath.set(t, { path: t, findings: [] });
  for (const f of flat) {
    const file = byPath.get(f.path);
    if (file === undefined) continue;
    const { path: _p, ...rest } = f;
    void _p;
    file.findings.push(rest);
  }
  for (const file of byPath.values()) {
    file.findings.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier === "high" ? -1 : 1;
      return a.line - b.line;
    });
  }
  return { files: Array.from(byPath.values()) };
}

function emitReportAndExit(
  targets: readonly string[],
  allTiered: Array<FlatFinding & { tier: ConfidenceTier }>,
): void {
  const finalReport = nestTiered(targets, allTiered);
  if (JSON_ONLY) {
    writingFinalJson = true;
    process.stdout.write(JSON.stringify(finalReport, null, 2) + "\n");
    writingFinalJson = false;
  } else {
    log("\n--- final report ---");
    process.stdout.write(JSON.stringify(finalReport, null, 2) + "\n");
  }
  const totals = finalReport.files.reduce(
    (acc, f) => {
      for (const x of f.findings) {
        if (x.tier === "high") acc.high += 1;
        else acc.advisory += 1;
      }
      return acc;
    },
    { high: 0, advisory: 0 },
  );
  log(`\n[totals] high=${totals.high} advisory=${totals.advisory}`);
  process.exitCode = totals.high > 0 ? 1 : 0;
}

async function streamAssistantText(run: Run): Promise<string> {
  let buf = "";
  for await (const event of run.stream() as AsyncIterable<SDKMessage>) {
    if (event.type === "assistant") {
      for (const block of event.message.content) {
        if (block.type === "text") {
          buf += block.text;
          if (!JSON_ONLY) process.stderr.write(block.text);
        }
      }
    }
  }
  return buf;
}

async function runAgent(prompt: string, label: string): Promise<string> {
  const apiKey = process.env["CURSOR_API_KEY"] ?? "";
  await using agent = await Agent.create({
    apiKey,
    model: { id: "composer-2.5", params: [{ id: "fast", value: "true" }] },
    local: { cwd: REPO_ROOT, settingSources: ["project"] },
  });
  const run = await agent.send(prompt);
  const text = await streamAssistantText(run);
  const result: RunResult = await run.wait();
  if (result.status !== "finished") {
    throw new Error(`${label} failed: status=${result.status}`);
  }
  return text;
}

async function pMap<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next: number = 0;
  async function worker(): Promise<void> {
    while (true) {
      const i: number = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i] as T, i);
    }
  }
  const workers: Promise<void>[] = [];
  for (let i: number = 0; i < Math.min(limit, items.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

function buildMdxAuditorPrompt(
  target: string,
  content: string,
  skillContent: string,
): string {
  return [
    "Use the `kb-mdx-auditor` skill to audit the following Starlight MDX page.",
    "We have provided the skill instructions and target file contents below so you do NOT need to run any tools to fetch them.",
    "",
    "=== SYSTEM SKILL: `kb-mdx-auditor` ===",
    skillContent,
    "",
    `=== TARGET FILE: ${target} ===`,
    "```mdx",
    content,
    "```",
    "",
    "Output a single JSON object matching the skill Report schema. JSON only.",
  ].join("\n");
}

function buildShowDontTellPrompt(
  candidates: readonly ShowDontTellCandidate[],
  skillContent: string,
): string {
  return [
    "Use the `kb-show-dont-tell-judge` skill. For each candidate, decide if the claim",
    "is demonstrated by request+response within `context`.",
    "We have provided the skill instructions below so you do NOT need to run any tools to fetch them.",
    "",
    "=== SYSTEM SKILL: `kb-show-dont-tell-judge` ===",
    skillContent,
    "",
    "Candidates:",
    JSON.stringify(candidates, null, 2),
    "",
    "Output JSON matching the skill Report schema. JSON only.",
  ].join("\n");
}

function buildVerifierPrompt(findings: FlatFinding[], skillContent: string): string {
  return [
    "Use the `kb-verifier` skill to verify these MDX audit findings.",
    "We have provided the skill instructions below so you do NOT need to run any tools to fetch them.",
    "",
    "=== SYSTEM SKILL: `kb-verifier` ===",
    skillContent,
    "",
    "Findings:",
    JSON.stringify(findings, null, 2),
    "",
    "Output JSON matching VerifiedReport. JSON only.",
  ].join("\n");
}

async function runMdxAuditorPass(targets: readonly string[]): Promise<Report> {
  const skillPath = resolve(REPO_ROOT, ".github/skills/kb-mdx-auditor/SKILL.md");
  const skillContent = readFileSync(skillPath, "utf8");

  const results = await pMap(
    targets,
    4,
    async (target: string): Promise<FileReport> => {
      const absPath = resolve(REPO_ROOT, target);
      if (!existsSync(absPath)) return { path: target, findings: [] };
      
      const content = readFileSync(absPath, "utf8");
      const cached = readFromCache<Finding[]>(
        REPO_ROOT,
        "mdx-audit",
        target,
        content,
        skillContent,
      );
      if (cached !== null) {
        log(`[mdx-audit] cache hit: ${target}`);
        return { path: target, findings: cached };
      }
      
      log(`[mdx-audit] cache miss: ${target} (running LLM...)`);
      const prompt = buildMdxAuditorPrompt(target, content, skillContent);
      const text = await runAgent(prompt, `mdx-audit:${target}`);
      const parsed = JSON.parse(extractJson(text)) as Report;
      const fileReport = parsed.files[0] ?? { path: target, findings: [] };
      
      writeToCache(
        REPO_ROOT,
        "mdx-audit",
        target,
        content,
        skillContent,
        fileReport.findings,
      );
      
      return fileReport;
    },
  );
  
  return { files: results };
}

async function runShowDontTellPass(targets: readonly string[]): Promise<FlatFinding[]> {
  const skillPath = resolve(REPO_ROOT, ".github/skills/kb-show-dont-tell-judge/SKILL.md");
  const skillContent = readFileSync(skillPath, "utf8");

  const results = await pMap(
    targets,
    4,
    async (target: string): Promise<FlatFinding[]> => {
      const absPath = resolve(REPO_ROOT, target);
      if (!existsSync(absPath)) return [];
      
      const candidates = findShowDontTellCandidates(REPO_ROOT, target);
      if (candidates.length === 0) return [];
      
      const content = readFileSync(absPath, "utf8");
      const cached = readFromCache<FlatFinding[]>(
        REPO_ROOT,
        "mdx-sdt",
        target,
        content,
        skillContent,
      );
      if (cached !== null) {
        log(`[mdx-sdt] cache hit: ${target}`);
        return cached;
      }
      
      log(`[mdx-sdt] cache miss: ${target} (running LLM...)`);
      const prompt = buildShowDontTellPrompt(candidates, skillContent);
      const text = await runAgent(prompt, `mdx-sdt:${target}`);
      const parsed = JSON.parse(extractJson(text)) as {
        judgments: Array<{
          path: string;
          line: number;
          verdict: "shown" | "missing";
          quote: string;
          rationale: string;
        }>;
      };
      const findings = parsed.judgments
        .filter((j) => j.verdict === "missing")
        .map(
          (j): FlatFinding => ({
            rule: "show-dont-tell",
            path: j.path,
            line: j.line,
            message: `Behavioral claim not shown by request+response. ${j.rationale}`,
            evidence: j.quote.slice(0, 120),
          }),
        );
        
      writeToCache(
        REPO_ROOT,
        "mdx-sdt",
        target,
        content,
        skillContent,
        findings,
      );
      
      return findings;
    },
  );
  
  return results.flat();
}

async function runVerifierPass(findings: FlatFinding[]): Promise<FlatFinding[]> {
  if (findings.length === 0) return [];
  
  const skillPath = resolve(REPO_ROOT, ".github/skills/kb-verifier/SKILL.md");
  const skillContent = readFileSync(skillPath, "utf8");

  const byFile: Map<string, FlatFinding[]> = new Map();
  for (const f of findings) {
    const list = byFile.get(f.path) ?? [];
    list.push(f);
    byFile.set(f.path, list);
  }
  
  const filesWithFindings = Array.from(byFile.keys());
  
  const results = await pMap(
    filesWithFindings,
    4,
    async (target: string): Promise<FlatFinding[]> => {
      const fileFindings = byFile.get(target) ?? [];
      if (fileFindings.length === 0) return [];
      
      const absPath = resolve(REPO_ROOT, target);
      if (!existsSync(absPath)) return [];
      
      const content = readFileSync(absPath, "utf8");
      const cached = readFromCache<FlatFinding[]>(
        REPO_ROOT,
        "mdx-verify",
        target,
        content,
        skillContent,
      );
      if (cached !== null) {
        log(`[mdx-verify] cache hit: ${target}`);
        return cached;
      }
      
      log(`[mdx-verify] cache miss: ${target} (running LLM...)`);
      const prompt = buildVerifierPrompt(fileFindings, skillContent);
      const text = await runAgent(prompt, `mdx-verify:${target}`);
      const verified = JSON.parse(extractJson(text)) as VerifiedReport;
      const verifiedFindings = verified.verifiedFindings
        .filter((v: VerifiedFinding) => v.verdict === "VERIFIED")
        .map(
          (v): FlatFinding => ({
            rule: v.rule,
            line: v.line,
            message: v.message,
            path: v.path,
            ...(v.quote !== undefined ? { evidence: v.quote.slice(0, 120) } : {}),
          }),
        );
        
      writeToCache(
        REPO_ROOT,
        "mdx-verify",
        target,
        content,
        skillContent,
        verifiedFindings,
      );
      
      return verifiedFindings;
    },
  );
  
  return results.flat();
}

async function main(): Promise<void> {
  const args = parseArgs();
  JSON_ONLY = args.jsonOnly;

  if (args.profile !== "mdx-ci" && (process.env["CURSOR_API_KEY"] ?? "") === "") {
    log("error: CURSOR_API_KEY required for mdx-triage and mdx-full");
    process.exit(2);
  }

  if (args.targets.length === 0) {
    log("[mdx-audit] no targets; exiting clean");
    if (JSON_ONLY) {
      process.stdout.write(JSON.stringify({ files: [] }, null, 2) + "\n");
    }
    process.exit(0);
  }

  log(`[mdx-audit] profile=${args.profile} targets=${args.targets.length}`);

  const det: FileReport[] = args.targets.map((p) =>
    runMdxDeterministic(resolve(REPO_ROOT, p), p),
  );
  const detFlat = flatten({ files: det });

  if (args.profile === "mdx-ci") {
    emitReportAndExit(
      args.targets,
      detFlat.map((f) => ({ ...f, tier: "high" as const })),
    );
    return;
  }

  const detAdvisory = args.targets.map((p) =>
    runMdxDeterministicAdvisory(resolve(REPO_ROOT, p), p),
  );
  const detAdvisoryFlat = flatten({ files: detAdvisory });

  if (args.profile === "mdx-triage") {
    const audit = await runMdxAuditorPass(args.targets);
    const auditFlat = flatten(audit);
    const tiered: Array<FlatFinding & { tier: ConfidenceTier }> = [
      ...detFlat.map((f) => ({ ...f, tier: "high" as const })),
      ...auditFlat.map((f) => ({
        ...f,
        tier: OBJECTIVE_MDX_RULES.has(f.rule)
          ? ("high" as const)
          : ("advisory" as const),
      })),
      ...detAdvisoryFlat.map((f) => ({ ...f, tier: "advisory" as const })),
    ];
    emitReportAndExit(args.targets, tiered);
    return;
  }

  const [audit, sdtFindings] = await Promise.all([
    runMdxAuditorPass(args.targets),
    runShowDontTellPass(args.targets),
  ]);
  const auditFlat = flatten(audit);
  const grounded = groundFindings(REPO_ROOT, auditFlat, 10);
  const objective = grounded.kept.filter((f) =>
    OBJECTIVE_MDX_RULES.has(f.rule),
  );
  const subjective = grounded.kept.filter(
    (f) => !OBJECTIVE_MDX_RULES.has(f.rule),
  );
  const { kept: filtered } = postFilter(REPO_ROOT, objective);
  const verified = args.noVerify
    ? filtered
    : await runVerifierPass(filtered);
  const groundedSdt = groundFindings(REPO_ROOT, sdtFindings, 10);

  const tiered: Array<FlatFinding & { tier: ConfidenceTier }> = [
    ...detFlat.map((f) => ({ ...f, tier: "high" as const })),
    ...verified.map((f) => ({ ...f, tier: "high" as const })),
    ...groundedSdt.kept.map((f) => ({ ...f, tier: "high" as const })),
    ...subjective.map((f) => ({ ...f, tier: "advisory" as const })),
    ...detAdvisoryFlat.map((f) => ({ ...f, tier: "advisory" as const })),
  ];
  emitReportAndExit(args.targets, tiered);
}

main().catch((err: unknown) => {
  console.error("mdx-audit failed:", err);
  process.exit(2);
});

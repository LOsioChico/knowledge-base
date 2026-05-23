// Jargon verification pass (audit P: no assumed-knowledge jargon).
//
// For each target note, send the body to the LLM with the
// `kb-jargon-judge` skill. The judge names specific undefined tokens (or
// returns empty). Findings are emitted as `style-jargon` at advisory tier.
//
// Always on when CURSOR_API_KEY is set. No fetch, no cache: judgment surface
// is the note body itself. Existing dismissed.json sig-based suppression
// applies — if a triaged finding's underlying line has not been rewritten,
// the LLM may re-emit it but the dismissal layer drops it.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { FlatFinding } from "./types.js";
import { findSkipLines } from "./skip-zones.js";
import { readVotingConfig, runWithVoting } from "./voting.js";
import { readFromCache, writeToCache } from "./cache-helper.js";

interface JargonFinding {
  line: number;
  quote: string;
  kind: "undefined-acronym" | "undefined-feature" | "misleading-name-tail";
  rationale: string;
  suggestion?: string;
}

interface JargonReport {
  findings: JargonFinding[];
}

interface JargonVerifyArgs {
  repoRoot: string;
  targets: readonly string[];
  runAgent: (prompt: string, label: string) => Promise<string>;
  extractJson: (text: string) => string;
  log: (msg: string) => void;
}

// Cap concurrent LLM sessions in line with source-verify (4). Each call is
// one note; runtime is dominated by token generation.
const JARGON_CONCURRENCY: number = 4;

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

function buildJargonPrompt(notePath: string, noteBody: string, skillContent: string): string {
  const numbered: string = noteBody
    .split("\n")
    .map((l: string, i: number): string => `L${i + 1}: ${l}`)
    .join("\n");
  const input = { path: notePath, body: numbered };
  return [
    "Use the `kb-jargon-judge` skill.",
    "We have provided the skill instructions below so you do NOT need to run any tools to fetch them.",
    "",
    "=== SYSTEM SKILL: `kb-jargon-judge` ===",
    skillContent,
    "",
    "INPUT:",
    JSON.stringify(input, null, 2),
    "",
    "Output a single JSON object matching the skill's `Report` schema. JSON only — no prose, no Markdown, no fenced block.",
  ].join("\n");
}

export async function runJargonVerifyPass(
  args: JargonVerifyArgs,
): Promise<FlatFinding[]> {
  const { repoRoot, targets, runAgent, extractJson, log } = args;
  const voteCfg = readVotingConfig();

  const skillPath = resolve(repoRoot, ".github/skills/kb-jargon-judge/SKILL.md");
  const skillContent = readFileSync(skillPath, "utf8");

  const perFile: FlatFinding[][] = await pMap(
    targets,
    JARGON_CONCURRENCY,
    async (target: string): Promise<FlatFinding[]> => {
      const abs: string = resolve(repoRoot, target);
      if (!existsSync(abs)) {
        log(`[jargon-verify] skip (missing): ${target}`);
        return [];
      }
      const noteText: string = readFileSync(abs, "utf8");
      
      // Check cache first
      const cached = readFromCache<FlatFinding[]>(
        repoRoot,
        "jargon-verify",
        target,
        noteText,
        skillContent,
      );
      if (cached !== null) {
        log(`[jargon-verify] cache hit: ${target}`);
        return cached;
      }

      const totalLines: number = noteText.split("\n").length;
      const lines: string[] = noteText.split("\n");
      const skipLines: Set<number> = findSkipLines(noteText);
      const prompt: string = buildJargonPrompt(target, noteText, skillContent);

      const runOnce = async (sampleIdx: number): Promise<FlatFinding[]> => {
        const label: string =
          voteCfg.n > 1
            ? `jargon-verify:${target}#${sampleIdx + 1}`
            : `jargon-verify:${target}`;
        const text: string = await runAgent(prompt, label);
        let parsed: JargonReport;
        try {
          parsed = JSON.parse(extractJson(text)) as JargonReport;
        } catch (err) {
          log(
            `[jargon-verify] failed to parse response for ${target} (sample ${sampleIdx + 1}): ${err instanceof Error ? err.message : String(err)}`,
          );
          return [];
        }
        const out: FlatFinding[] = [];
        let droppedSkipZone: number = 0;
        for (const f of parsed.findings ?? []) {
          if (f.line < 1 || f.line > totalLines) continue;
          const lineText: string = lines[f.line - 1] ?? "";
          if (!lineText.includes(f.quote)) {
            log(
              `[jargon-verify] dropped (quote not on line) ${target}:${f.line} "${f.quote.slice(0, 40)}"`,
            );
            continue;
          }
          if (skipLines.has(f.line)) {
            droppedSkipZone++;
            continue;
          }
          const tail: string =
            f.suggestion !== undefined ? ` Suggested: ${f.suggestion}` : "";
          out.push({
            rule: "style-jargon",
            path: target,
            line: f.line,
            message: `Assumed-knowledge jargon (${f.kind}): "${f.quote}". ${f.rationale}${tail}`,
            evidence: f.quote.slice(0, 120),
          });
        }
        if (droppedSkipZone > 0) {
          log(
            `[jargon-verify] ${target} sample ${sampleIdx + 1}: dropped ${droppedSkipZone} finding(s) in skip-zone sections`,
          );
        }
        log(
          `[jargon-verify] ${target} sample ${sampleIdx + 1}: ${parsed.findings?.length ?? 0} raw, ${out.length} after grounding`,
        );
        return out;
      };

      const sigOf = (f: FlatFinding): string =>
        `${f.path}|${f.rule}|${f.line}|${f.evidence ?? ""}`;

      const findings = await runWithVoting(voteCfg, runOnce, sigOf, log, target);

      writeToCache(
        repoRoot,
        "jargon-verify",
        target,
        noteText,
        skillContent,
        findings,
      );

      return findings;
    },
  );

  return perFile.flat();
}

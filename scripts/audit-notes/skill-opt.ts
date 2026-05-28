#!/usr/bin/env -S npx tsx
/**
 * scripts/audit-notes/skill-opt.ts
 *
 * SkillOpt v2 — Multi-Skill Text-Space Self-Evolution Optimization Loop.
 * Reflects on the active pair-programming session's logs, extracts lessons
 * and gotchas, proposes micro-rules under a bounded learning rate budget,
 * passes them through a validation gate, and saves them to the repository.
 *
 * Features:
 *   - Universal optimizer prompt (not domain-specific)
 *   - Smart insert-marker detection (## Boundaries, ## Anti-patterns, etc.)
 *   - Multi-target support with --auto mode
 *   - Short skill name resolution (--target kb-enrichment)
 *   - Deduplication guard to prevent duplicate lessons
 *
 * Usage:
 *   bun run skills:opt                               # default: kb-author
 *   bun run skills:opt -- --target kb-enrichment     # specific skill by name
 *   bun run skills:opt -- --target path/to/SKILL.md  # specific skill by path
 *   bun run skills:opt -- --auto                     # detect & optimize all
 *   bun run skills:opt -- --dry-run                  # preview without writing
 *   bun run skills:opt -- --conversation-id <id>     # specific session
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, basename, dirname } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Agent } from "@cursor/sdk";

// --- Configuration & Paths ---
const REPO_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const APP_DATA_DIR = "/Users/lange/.gemini/antigravity";
const BRAIN_DIR = join(APP_DATA_DIR, "brain");
const SKILLS_DIR = join(REPO_ROOT, ".github/skills");
const DEFAULT_SKILL_NAME = "kb-author";

// Terminal section markers — insert new rules BEFORE the first one found
const TERMINAL_MARKERS = [
  "## Boundaries",
  "## Anti-patterns",
  "## Anti-patterns to avoid",
  "## Skip zones",
  "## What this skill does NOT check",
  "## Output schema",
];

// Load .env file manually for Node.js compatibility
const envPath = join(REPO_ROOT, ".env");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const match = /^\s*([\w.-]+)\s*=\s*(.*)?$/.exec(line);
    if (match) {
      const key = match[1];
      let value = match[2]?.trim() || "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

// Command-line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isAutoMode = args.includes("--auto");
const targetArgIndex = args.indexOf("--target");
const targetArgValue = targetArgIndex !== -1 ? args[targetArgIndex + 1] : null;
const idArgIndex = args.indexOf("--conversation-id");
const conversationId = idArgIndex !== -1 ? args[idArgIndex + 1] : null;

// --- Helper Functions ---

function log(msg: string) {
  console.log(`\x1b[36m[SkillOpt]\x1b[0m ${msg}`);
}

function logError(msg: string) {
  console.error(`\x1b[31m[SkillOpt Error]\x1b[0m ${msg}`);
}

function logWarn(msg: string) {
  console.warn(`\x1b[33m[SkillOpt Warn]\x1b[0m ${msg}`);
}

// --- Skill Name Resolution ---

function resolveSkillPath(nameOrPath: string): string {
  // Try as short name first: kb-author → .github/skills/kb-author/SKILL.md
  const shortPath = join(SKILLS_DIR, nameOrPath, "SKILL.md");
  if (existsSync(shortPath)) return shortPath;

  // Try as relative path from repo root
  const relPath = resolve(REPO_ROOT, nameOrPath);
  if (existsSync(relPath)) return relPath;

  // Try as absolute path
  if (existsSync(nameOrPath)) return nameOrPath;

  throw new Error(
    `Cannot resolve skill target "${nameOrPath}". Tried:\n` +
    `  - ${shortPath}\n` +
    `  - ${relPath}\n` +
    `  - ${nameOrPath}`
  );
}

function getSkillDisplayName(skillPath: string): string {
  // .github/skills/kb-author/SKILL.md → kb-author
  const dir = dirname(skillPath);
  const name = basename(dir);
  if (existsSync(join(SKILLS_DIR, name, "SKILL.md"))) return name;
  return skillPath.substring(REPO_ROOT.length + 1);
}

function listAllSkills(): string[] {
  if (!existsSync(SKILLS_DIR)) return [];
  return readdirSync(SKILLS_DIR)
    .filter(name => existsSync(join(SKILLS_DIR, name, "SKILL.md")))
    .map(name => join(SKILLS_DIR, name, "SKILL.md"));
}

// --- Smart Insert-Marker Detection ---

function findInsertMarker(content: string): { marker: string; index: number } | null {
  for (const marker of TERMINAL_MARKERS) {
    const index = content.indexOf(`\n${marker}`);
    if (index !== -1) {
      return { marker, index: index + 1 }; // +1 to skip the \n
    }
  }
  return null;
}

// --- Deduplication Guard ---

function checkDuplication(existingContent: string, newBullets: string): { isDuplicate: boolean; reason: string } {
  // Extract key phrases from the new bullets (bold text between **)
  const newPhrases = [...newBullets.matchAll(/\*\*([^*]+)\*\*/g)].map(m => m[1].toLowerCase().trim());
  if (newPhrases.length === 0) {
    return { isDuplicate: false, reason: "No key phrases found to check" };
  }

  const existingLower = existingContent.toLowerCase();
  const matchCount = newPhrases.filter(phrase => existingLower.includes(phrase)).length;
  const matchRatio = matchCount / newPhrases.length;

  if (matchRatio >= 0.8) {
    return {
      isDuplicate: true,
      reason: `${matchCount}/${newPhrases.length} key phrases already exist (${(matchRatio * 100).toFixed(0)}% overlap)`
    };
  }

  return { isDuplicate: false, reason: `${matchCount}/${newPhrases.length} phrases overlap (${(matchRatio * 100).toFixed(0)}%)` };
}

// --- Conversation Detection ---

function detectLatestConversationId(): string {
  if (conversationId) return conversationId;

  if (!existsSync(BRAIN_DIR)) {
    throw new Error(`Brain App Data directory not found: ${BRAIN_DIR}`);
  }

  const subdirs = readdirSync(BRAIN_DIR)
    .map(name => ({ name, path: join(BRAIN_DIR, name) }))
    .filter(item => {
      try { return statSync(item.path).isDirectory(); } catch { return false; }
    })
    .filter(item => existsSync(join(item.path, ".system_generated/logs/transcript.jsonl")))
    .map(item => ({ ...item, mtime: statSync(item.path).mtime.getTime() }))
    .sort((a, b) => b.mtime - a.mtime);

  if (subdirs.length === 0) {
    throw new Error("No conversation sessions with transcripts detected in brain directory.");
  }

  return subdirs[0].name;
}

// --- Transcript Parsing ---

interface TranscriptStep {
  step_index: number;
  source: string;
  type: string;
  status?: string;
  content?: string;
  tool_calls?: Array<{ name?: string; toolAction?: string; toolSummary?: string; args?: Record<string, string> }>;
}

function parseTranscript(sessionPath: string): { formatted: string; editedFiles: string[]; loadedSkills: string[] } {
  const logPath = join(sessionPath, ".system_generated/logs/transcript.jsonl");
  if (!existsSync(logPath)) {
    throw new Error(`Transcript log not found at: ${logPath}`);
  }

  const lines = readFileSync(logPath, "utf8").split("\n").filter(Boolean);
  const steps: TranscriptStep[] = lines.map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean) as TranscriptStep[];

  const parsedTurns: string[] = [];
  const editedFiles = new Set<string>();
  const loadedSkills = new Set<string>();
  const seenToolActions = new Set<string>();

  for (const step of steps) {
    // User messages
    if (step.source === "USER_EXPLICIT" && step.type === "USER_INPUT" && step.content) {
      const snippet = step.content.length > 200 ? step.content.slice(0, 200) + "..." : step.content;
      parsedTurns.push(`[Step ${step.step_index}] USER: ${snippet}`);
    }

    // Agent reasoning
    else if (step.source === "MODEL" && step.type === "PLANNER_RESPONSE" && step.content) {
      const snippet = step.content.length > 200 ? step.content.slice(0, 200) + "..." : step.content;
      parsedTurns.push(`[Step ${step.step_index}] AGENT: ${snippet}`);
    }

    // Code edits — track which files were modified
    else if (step.type === "CODE_ACTION" && step.content) {
      const fileMatch = step.content.match(/to: ([^\s.]+\.\w+)/);
      if (fileMatch) editedFiles.add(fileMatch[1]);
      const snippet = step.content.length > 200 ? step.content.slice(0, 200) + "..." : step.content;
      parsedTurns.push(`[Step ${step.step_index}] EDIT: ${snippet}`);
    }

    // File views — track skill file loads
    else if (step.type === "VIEW_FILE" && step.content) {
      const pathMatch = step.content.match(/File Path:.*?`file:\/\/\/(.*?)`/);
      if (pathMatch) {
        const filePath = pathMatch[1];
        if (filePath.includes("/skills/") && filePath.endsWith("SKILL.md")) {
          const skillName = filePath.match(/skills\/([^/]+)\/SKILL\.md/)?.[1];
          if (skillName) loadedSkills.add(skillName);
        }
      }
    }

    // Tool calls — deduplicate repetitive polls
    if (step.tool_calls) {
      for (const call of step.tool_calls) {
        const action = call.toolAction || call.toolSummary || "";
        if (action && !seenToolActions.has(action)) {
          seenToolActions.add(action);
          parsedTurns.push(`[Step ${step.step_index}] TOOL: ${action}`);
        }
      }
    }
  }

  // Keep last 30 turns for richer context
  const recentTurns = parsedTurns.slice(-30);

  return {
    formatted: recentTurns.join("\n\n"),
    editedFiles: [...editedFiles],
    loadedSkills: [...loadedSkills]
  };
}

// --- LLM Completion via Cursor SDK ---

async function streamAssistantText(run: any): Promise<string> {
  let buf = "";
  for await (const event of run.stream()) {
    if (event.type === "assistant") {
      for (const block of event.message.content) {
        if (block.type === "text") {
          buf += block.text;
          process.stderr.write(block.text);
        }
      }
    }
  }
  return buf;
}

async function runOptimizer(prompt: string): Promise<string> {
  const apiKey = process.env["CURSOR_API_KEY"] ?? "";
  if (!apiKey) {
    throw new Error("CURSOR_API_KEY environment variable is required.");
  }

  await using agent = await Agent.create({
    apiKey,
    model: { id: "composer-2.5", params: [{ id: "fast", value: "true" }] }
  });

  const run = await agent.send(prompt);
  const text = await streamAssistantText(run);
  const result = await run.wait();
  if (result.status !== "finished") {
    throw new Error(`Optimizer run failed with status: ${result.status}`);
  }
  return text;
}

// --- Validation Gate ---

function runValidationGate(): boolean {
  try {
    log("Running Validation Gate: `bun run lint:wikilinks`...");
    execSync("bun run lint:wikilinks", { cwd: REPO_ROOT, stdio: "inherit" });

    log("Running Validation Gate: `bun run --cwd sites/docs check`...");
    execSync("bun run --cwd sites/docs check", { cwd: REPO_ROOT, stdio: "inherit" });

    return true;
  } catch {
    logError("Validation checks failed. Rejecting proposed patch.");
    return false;
  }
}

// --- Universal Optimizer Prompt ---

function buildOptimizerPrompt(skillName: string, skillContent: string, transcript: string, editedFiles: string[]): string {
  return `
You are the SkillOpt Optimizer Model. Your task is to perform a text-space self-evolution optimization loop on the agent skill file "${skillName}".

Treat the instructions inside this file as trainable parameters. Review the recent session trajectory logs to identify:
1. What went wrong? What bugs, gotchas, misunderstandings, or user corrections occurred?
2. What was the root cause? (e.g., wrong API usage, missing edge case, CSS layout leak, incorrect assumption, fragile pattern)
3. What was the clean, validated solution the agent eventually implemented?
4. Are there any architectural decisions, conventions, or user preferences that should be encoded?

Your goal is to output a precise, localized patch for the skill instructions file.
Follow these constraints STRICTLY to respect a bounded "textual learning rate" and prevent regression:
- Do NOT rewrite the entire file. Only propose highly-targeted additions.
- Propose NO MORE THAN 2-3 new concise entries matching the file's existing formatting.
- Each entry should be a bullet point starting with "- **Bold title** → explanation".
- Keep entries extremely concrete, specific, and verifiable. No vague advice.
- If nothing actionable was learned this session for this skill, output exactly: "NO_LESSONS_DETECTED"

Files edited this session: ${editedFiles.length > 0 ? editedFiles.join(", ") : "none detected"}

=== TARGET SKILL FILE: ${skillName} ===
${skillContent}

=== RECENT SESSION TRAJECTORY LOGS ===
${transcript}

=== TASK ===
1. Analyze the session logs for lessons relevant to this specific skill file's domain.
2. Formulate precise new entries that prevent the same mistakes in future sessions.
3. Present ONLY the new bullet points inside a markdown code block. No preamble, no commentary.
`;
}

// --- Extract Code Block Content ---

function extractMarkdownCodeBlock(text: string): string {
  const match = /```markdown\n([\s\S]*?)\n```/.exec(text) || /```\n([\s\S]*?)\n```/.exec(text);
  return match ? match[1].trim() : text.trim();
}

// --- Core: Optimize a Single Skill ---

async function optimizeSkill(
  skillPath: string,
  transcript: string,
  editedFiles: string[]
): Promise<{ status: "applied" | "skipped" | "no-lessons" | "failed"; reason: string }> {
  const skillName = getSkillDisplayName(skillPath);
  const currentContent = readFileSync(skillPath, "utf8");

  log(`\n${"═".repeat(70)}`);
  log(`  Optimizing: \x1b[35m${skillName}\x1b[0m`);
  log(`${"═".repeat(70)}`);

  // Build and run optimizer
  const prompt = buildOptimizerPrompt(skillName, currentContent, transcript, editedFiles);
  log("Executing Optimizer LLM reflection...");
  const proposal = await runOptimizer(prompt);

  // Check for no-lessons sentinel
  if (proposal.includes("NO_LESSONS_DETECTED")) {
    log(`✅ No new lessons detected for ${skillName} this session.`);
    return { status: "no-lessons", reason: "Optimizer found nothing actionable" };
  }

  // Display proposal
  log("\n\x1b[36m" + "─".repeat(70) + "\x1b[0m");
  log("  OPTIMIZATION PROPOSAL");
  log("\x1b[36m" + "─".repeat(70) + "\x1b[0m");
  console.log(proposal);
  log("\x1b[36m" + "─".repeat(70) + "\x1b[0m\n");

  // Extract clean bullets
  const newBullets = extractMarkdownCodeBlock(proposal);

  // Deduplication guard
  const dupeCheck = checkDuplication(currentContent, newBullets);
  if (dupeCheck.isDuplicate) {
    logWarn(`Skipping ${skillName}: ${dupeCheck.reason}`);
    return { status: "skipped", reason: dupeCheck.reason };
  }
  log(`Dedup check: ${dupeCheck.reason}`);

  if (isDryRun) {
    log(`⚠️  Dry-run: would insert into ${skillName}. Skipping write.`);
    return { status: "skipped", reason: "Dry-run mode" };
  }

  // Find insert point
  const markerResult = findInsertMarker(currentContent);
  const backupPath = `${skillPath}.bak`;
  writeFileSync(backupPath, currentContent, "utf8");

  try {
    let mergedContent: string;

    if (markerResult) {
      log(`Insert point: before "${markerResult.marker}"`);
      const before = currentContent.substring(0, markerResult.index).trimEnd();
      const after = currentContent.substring(markerResult.index);
      mergedContent = `${before}\n\n${newBullets}\n\n${after}`;
    } else {
      log("No terminal marker found — appending at end of file.");
      mergedContent = `${currentContent.trimEnd()}\n\n${newBullets}\n`;
    }

    writeFileSync(skillPath, mergedContent, "utf8");
    log("Successfully merged and saved updated skill instructions.");

    // Validation gate
    const isValid = runValidationGate();
    if (isValid) {
      log(`🎉 Validation Gate PASSED for ${skillName}!`);
      execSync(`rm "${backupPath}"`);

      // Show diff
      log("\n\x1b[32m--- Git Diff ---\x1b[0m");
      try {
        const diff = execSync(`git diff "${skillPath}"`, { encoding: "utf8" });
        console.log(diff || "No structural git changes detected.");
      } catch {
        logError("Failed to run git diff.");
      }

      return { status: "applied", reason: "Validation passed" };
    } else {
      log(`❌ Validation Gate FAILED for ${skillName}. Rolling back.`);
      writeFileSync(skillPath, currentContent, "utf8");
      execSync(`rm "${backupPath}"`);
      return { status: "failed", reason: "Validation gate failed" };
    }
  } catch (err) {
    logError(`Merge crash for ${skillName}: ${err instanceof Error ? err.message : String(err)}`);
    if (existsSync(backupPath)) {
      writeFileSync(skillPath, currentContent, "utf8");
      execSync(`rm "${backupPath}"`);
    }
    return { status: "failed", reason: err instanceof Error ? err.message : String(err) };
  }
}

// --- Main Orchestrator ---

async function main() {
  log("Initializing SkillOpt v2 Self-Evolution training step...");

  // Detect session and parse transcript
  const activeId = detectLatestConversationId();
  const sessionPath = join(BRAIN_DIR, activeId);
  log(`Detected active session: \x1b[32m${activeId}\x1b[0m`);

  const { formatted: transcript, editedFiles, loadedSkills } = parseTranscript(sessionPath);
  log(`Parsed session trajectory (${transcript.split("\n\n").length} turns)`);
  if (editedFiles.length > 0) log(`Edited files: ${editedFiles.join(", ")}`);
  if (loadedSkills.length > 0) log(`Loaded skills: ${loadedSkills.join(", ")}`);

  // Determine which skills to optimize
  let skillTargets: string[];

  if (isAutoMode) {
    // Auto mode: optimize all skills that were loaded during the session
    if (loadedSkills.length === 0) {
      log("Auto mode: no skills detected in transcript. Falling back to default.");
      skillTargets = [resolveSkillPath(DEFAULT_SKILL_NAME)];
    } else {
      skillTargets = loadedSkills.map(name => resolveSkillPath(name));
      log(`Auto mode: will optimize ${skillTargets.length} skill(s): ${loadedSkills.join(", ")}`);
    }
  } else if (targetArgValue) {
    // Explicit target
    skillTargets = [resolveSkillPath(targetArgValue)];
  } else {
    // Default
    skillTargets = [resolveSkillPath(DEFAULT_SKILL_NAME)];
  }

  // Run optimizer for each target
  const results: Array<{ skill: string; status: string; reason: string }> = [];

  for (const skillPath of skillTargets) {
    const skillName = getSkillDisplayName(skillPath);
    try {
      const result = await optimizeSkill(skillPath, transcript, editedFiles);
      results.push({ skill: skillName, ...result });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      logError(`Failed to optimize ${skillName}: ${reason}`);
      results.push({ skill: skillName, status: "failed", reason });
    }
  }

  // Summary
  log("\n" + "═".repeat(70));
  log("  SKILLOPT SESSION SUMMARY");
  log("═".repeat(70));
  for (const r of results) {
    const icon = r.status === "applied" ? "🎉" : r.status === "no-lessons" ? "✅" : r.status === "skipped" ? "⚠️" : "❌";
    log(`  ${icon} ${r.skill}: ${r.status} — ${r.reason}`);
  }
  log("═".repeat(70) + "\n");

  // Exit code
  const failures = results.filter(r => r.status === "failed");
  if (failures.length > 0) process.exitCode = 1;
}

main().catch(err => {
  logError(`SkillOpt execution crash: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

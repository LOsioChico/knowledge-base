#!/usr/bin/env -S npx tsx
/**
 * scripts/skill-opt.ts
 *
 * SkillOpt — Text-Space Self-Evolution Optimization Loop for Agent Skills.
 * Reflects on the active pair-programming session's logs, extracts lessons
 * and gotchas, proposes micro-rules under a bounded learning rate budget,
 * passes them through a validation gate, and saves them to the repository.
 *
 * Usage:
 *   CURSOR_API_KEY=... bun run scripts/skill-opt.ts [--dry-run] [--target <file>] [--conversation-id <id>]
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Agent } from "@cursor/sdk";
import type { SDKMessage } from "@cursor/sdk";

// --- Configuration & Paths ---
const REPO_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const APP_DATA_DIR = "/Users/lange/.gemini/antigravity";
const BRAIN_DIR = join(APP_DATA_DIR, "brain");
const DEFAULT_SKILL_PATH = join(REPO_ROOT, ".github/skills/kb-author/SKILL.md");

// Load .env file manually for Node.js compatibility
const envPath = join(REPO_ROOT, ".env");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const match = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/.exec(line);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

// Command-line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const targetArgIndex = args.indexOf("--target");
const targetPath = targetArgIndex !== -1 && args[targetArgIndex + 1] 
  ? resolve(REPO_ROOT, args[targetArgIndex + 1]) 
  : DEFAULT_SKILL_PATH;

const idArgIndex = args.indexOf("--conversation-id");
let conversationId = idArgIndex !== -1 ? args[idArgIndex + 1] : null;

// --- Helper Functions ---

function log(msg: string) {
  console.log(`\x1b[36m[SkillOpt]\x1b[0m ${msg}`);
}

function logError(msg: string) {
  console.error(`\x1b[31m[SkillOpt Error]\x1b[0m ${msg}`);
}

// 1. Auto-detect most recent conversation ID
function detectLatestConversationId(): string {
  if (conversationId) return conversationId;

  if (!existsSync(BRAIN_DIR)) {
    throw new Error(`Brain App Data directory not found: ${BRAIN_DIR}`);
  }

  const subdirs = readdirSync(BRAIN_DIR)
    .map(name => ({ name, path: join(BRAIN_DIR, name) }))
    .filter(item => statSync(item.path).isDirectory())
    // Ensure it contains a transcript log
    .filter(item => existsSync(join(item.path, ".system_generated/logs/transcript.jsonl")))
    .map(item => ({ ...item, mtime: statSync(item.path).mtime.getTime() }))
    .sort((a, b) => b.mtime - a.mtime);

  if (subdirs.length === 0) {
    throw new Error("No conversation sessions with transcripts detected in brain directory.");
  }

  return subdirs[0].name;
}

// 2. Parse JSONL conversation logs
interface TranscriptStep {
  step_index: number;
  source: string;
  type: string;
  status?: string;
  content?: string;
  tool_calls?: any[];
}

function parseTranscript(sessionPath: string): string {
  const logPath = join(sessionPath, ".system_generated/logs/transcript.jsonl");
  if (!existsSync(logPath)) {
    throw new Error(`Transcript log not found at: ${logPath}`);
  }

  const lines = readFileSync(logPath, "utf8").split("\n").filter(Boolean);
  const steps: TranscriptStep[] = lines.map(line => JSON.parse(line));

  // Extract relevant turns: user inputs, tool outputs (especially linter/compiler failures), and agent responses
  const parsedTurns: string[] = [];

  for (const step of steps) {
    if (step.source === "USER_EXPLICIT" && step.type === "USER_INPUT" && step.content) {
      const snippet = step.content.length > 150 ? step.content.slice(0, 150) + "..." : step.content;
      parsedTurns.push(`[Step ${step.step_index}] USER: ${snippet}`);
    } else if (step.source === "MODEL" && step.type === "PLANNER_RESPONSE" && step.content) {
      // Keep only first 150 chars to avoid prompt bloat
      const snippet = step.content.length > 150 ? step.content.slice(0, 150) + "..." : step.content;
      parsedTurns.push(`[Step ${step.step_index}] AGENT: ${snippet}`);
    } else if (step.tool_calls) {
      for (const call of step.tool_calls) {
        if (call.toolAction || call.toolSummary) {
          parsedTurns.push(`[Step ${step.step_index}] TOOL: ${call.toolAction || call.toolSummary}`);
        }
      }
    }
  }

  // Slice last 10 turns to maintain precision on the active session's context
  const recentTurns = parsedTurns.slice(-10);
  return recentTurns.join("\n\n");
}

// 3. LLM Completion via Cursor SDK
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

// 4. Validation Gate Check
function runValidationGate(): boolean {
  try {
    log("Running Validation Gate: `bun run lint:wikilinks`...");
    execSync("bun run lint:wikilinks", { cwd: REPO_ROOT, stdio: "inherit" });

    log("Running Validation Gate: `bun run --cwd sites/docs check`...");
    execSync("bun run --cwd sites/docs check", { cwd: REPO_ROOT, stdio: "inherit" });

    return true;
  } catch (err) {
    logError("Validation checks failed. Rejecting proposed patch.");
    return false;
  }
}

// --- Main Orchestrator ---
async function main() {
  log("Initializing SkillOpt Self-Evolution training step...");

  // Detect session and parse transcript
  const activeId = detectLatestConversationId();
  const sessionPath = join(BRAIN_DIR, activeId);
  log(`Detected active session: \x1b[32m${activeId}\x1b[0m`);
  
  const formattedTranscript = parseTranscript(sessionPath);
  log(`Successfully parsed recent session trajectory (${formattedTranscript.split("\n\n").length} steps)`);

  // Load target skill instructions file
  if (!existsSync(targetPath)) {
    throw new Error(`Target instructions file not found at: ${targetPath}`);
  }
  const currentSkillContent = readFileSync(targetPath, "utf8");
  log(`Loaded target instructions document: \x1b[35m${targetPath.substring(REPO_ROOT.length + 1)}\x1b[0m`);

  // Build the optimizer prompt
  const optimizerPrompt = `
You are the SkillOpt Optimizer Model. Your task is to perform a text-space self-evolution optimization loop on the agent skill file provided below.

Treat the instructions inside this file as trainable parameters. Review the recent session trajectory logs to identify:
1. What went wrong? What layout alignment, visual, or gotcha issues did the user encounter?
2. What was the root cause? (e.g. Starlight's vertical margin sibling spacing, sub-pixel checkbox center calculations, baseline flex-alignments, or absolute timeline track gaps)
3. What was the clean solution the agent successfully executed? (e.g., adding not-content class to custom wrappers, precise 11px padding-top offsets, matching label and pill heights, or overlapping row-checkbox pseudo-elements)

Your goal is to output a precise, localized patch for the skill instructions file.
Follow these constraints STRICTLY to respect a bounded "textual learning rate" and prevent regression:
- Do NOT rewrite the entire file. Only append or merge highly-targeted additions.
- Propose NO MORE THAN 2-3 new concise warnings, gotchas, or pitfall entries in the exact formatting of the target file's "Common pitfalls" or layout section.
- Keep the new instructions extremely concrete, specific to Starlight / Astro visual systems, and mathematically precise.

=== TARGET INSTRUCTIONS FILE CONTENT ===
${currentSkillContent}

=== RECENT SESSION TRAJECTORY LOGS ===
${formattedTranscript}

=== TASK ===
1. Analyze the logs to identify the "not-content" gotcha and mathematical alignment solutions.
2. Formulate a precise edit: either insert a new item under "Common pitfalls", update the "pre-flight discovery ritual", or refine the existing rules.
3. Write your output by presenting ONLY the modified section or the precise diff/content to merge. Be direct. Present your proposal clearly inside Markdown code blocks.
`;

  log("Executing Optimizer LLM reflection...");
  const optimizerProposal = await runOptimizer(optimizerPrompt);
  
  // Extract proposed modifications from output
  log("\n\x1b[36m========================================================================\x1b[0m");
  log("                      SKILLOPT OPTIMIZATION PROPOSAL                    ");
  log("\x1b[36m========================================================================\x1b[0m");
  console.log(optimizerProposal);
  log("\x1b[36m========================================================================\x1b[0m\n");

  // Helper to extract content from markdown code fence
  function extractMarkdownCodeBlock(text: string): string {
    const match = /```markdown\n([\s\S]*?)\n```/.exec(text) || /```\n([\s\S]*?)\n```/.exec(text);
    return match ? match[1].trim() : text.trim();
  }

  if (isDryRun) {
    log("⚠️ Dry-run mode active. Discarding modifications. Exiting clean.");
    process.exit(0);
  }

  // For safety during script execution, we will create a temporary file backup of our target
  const backupPath = `${targetPath}.bak`;
  writeFileSync(backupPath, currentSkillContent, "utf8");

  try {
    log("Merging proposed edits into target instructions file programmatically...");
    const newBullets = extractMarkdownCodeBlock(optimizerProposal);
    
    const insertMarker = "## Boundaries";
    if (!currentSkillContent.includes(insertMarker)) {
      throw new Error(`Insert marker "${insertMarker}" not found in target file.`);
    }

    const parts = currentSkillContent.split(insertMarker);
    const mergedContent = `${parts[0].trim()}\n\n${newBullets}\n\n${insertMarker}\n${parts[1]}`;
    
    // Write merged content to disk
    writeFileSync(targetPath, mergedContent, "utf8");
    log("Successfully merged and saved updated skill instructions.");

    // Pass the changes through the Validation Gate
    const isValidationSuccess = runValidationGate();
    if (isValidationSuccess) {
      log("🎉 Validation Gate PASSED! Officially integrating evolved rules.");
      
      // Remove backup
      execSync(`rm "${backupPath}"`);

      // Run Git Diff to display changes
      log("\n\x1b[32m--- Git Diff of Evolved Skill Instructions ---\x1b[0m");
      try {
        const diff = execSync(`git diff "${targetPath}"`, { encoding: "utf8" });
        console.log(diff || "No structural git changes detected (file content identical).");
      } catch (err) {
        logError("Failed to run git diff. File has been saved successfully.");
      }
    } else {
      // Rollback
      log("❌ Validation Gate FAILED. Rolling back skill file to original state.");
      writeFileSync(targetPath, currentSkillContent, "utf8");
      execSync(`rm "${backupPath}"`);
      process.exitCode = 1;
    }
  } catch (err) {
    logError(`Merge execution or validation crash: ${err instanceof Error ? err.message : String(err)}`);
    if (existsSync(backupPath)) {
      writeFileSync(targetPath, currentSkillContent, "utf8");
      execSync(`rm "${backupPath}"`);
    }
    process.exitCode = 1;
  }
}

main().catch(err => {
  logError(`SkillOpt execution crash: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

// Pass 0: deterministic checks. No LLM. Rules grep can do correctly:
// - style-em-dash, style-double-hyphen   (blocking, exit-1 in pass0-all.ts)
// - style-hedge                          (advisory, surfaced only via the main audit runner)
// - frontmatter-schema

import { readFileSync } from "node:fs";
import type { FileReport, Finding } from "./types.js";

const REQUIRED_FRONTMATTER_KEYS: readonly string[] = [
  "title",
  "tags",
  "area",
  "status",
  "related",
];

export function runDeterministic(
  absolutePath: string,
  repoRelative: string,
): FileReport {
  const text: string = readFileSync(absolutePath, "utf8");
  const findings: Finding[] = [];

  findings.push(...checkFrontmatter(text));
  findings.push(...checkProseStyle(text));

  findings.sort((a: Finding, b: Finding): number => a.line - b.line);
  return { path: repoRelative, findings };
}

// Advisory deterministic pass: hedge phrases that signal the audit-fix
// anti-pattern (softening a claim instead of citing it). Kept separate from
// `runDeterministic` so the blocking pass-0 lint stays narrow; existing
// hedges in the vault would otherwise wedge CI on first run.
//
// Phrase list is multi-word on purpose. Bare "may" / "often" / "might" /
// "broadly" carry too much false-positive risk in technical prose. The shapes
// below are the ones that bit us in practice (see AGENTS.md "Cite, don't
// hedge"): they're nearly always the result of softening a specific claim
// rather than citing it.
export function runDeterministicAdvisory(
  absolutePath: string,
  repoRelative: string,
): FileReport {
  const text: string = readFileSync(absolutePath, "utf8");
  const findings: Finding[] = checkHedges(text);
  findings.sort((a: Finding, b: Finding): number => a.line - b.line);
  return { path: repoRelative, findings };
}

function checkFrontmatter(text: string): Finding[] {
  const findings: Finding[] = [];
  if (!text.startsWith("---\n")) {
    findings.push({
      rule: "frontmatter-schema",
      line: 1,
      message: "Note does not start with a YAML frontmatter block.",
    });
    return findings;
  }

  const closeIdx: number = text.indexOf("\n---\n", 4);
  if (closeIdx === -1) {
    findings.push({
      rule: "frontmatter-schema",
      line: 1,
      message: "Frontmatter block is not closed with `---`.",
    });
    return findings;
  }

  const frontmatter: string = text.slice(4, closeIdx);
  const lines: string[] = frontmatter.split("\n");

  // Required-field presence: top-level keys only (no leading whitespace).
  for (const key of REQUIRED_FRONTMATTER_KEYS) {
    const re: RegExp = new RegExp(`^${key}:`, "m");
    if (!re.test(frontmatter)) {
      findings.push({
        rule: "frontmatter-schema",
        line: 2,
        message: `Required frontmatter field \`${key}\` is missing.`,
      });
    }
  }

  // `area/*` used as a tag (forbidden — area is a folder + frontmatter field, not a tag).
  let inTagsBlock: boolean = false;
  for (let i = 0; i < lines.length; i++) {
    const line: string | undefined = lines[i];
    if (line === undefined) continue;
    const lineNo: number = i + 2; // +1 for 1-indexed, +1 for opening `---` line.

    if (/^tags:\s*\[/.test(line)) {
      // Inline array form: tags: [type/x, area/y]
      if (/\barea\//.test(line)) {
        findings.push({
          rule: "frontmatter-schema",
          line: lineNo,
          message:
            "`area/*` used as a tag; AGENTS.md forbids it (area is a folder + frontmatter field).",
          evidence: line.trim().slice(0, 120),
        });
      }
      inTagsBlock = false;
      continue;
    }
    if (/^tags:\s*$/.test(line)) {
      inTagsBlock = true;
      continue;
    }
    if (inTagsBlock) {
      // Block list ends when a non-indented, non-empty line appears.
      if (line.length > 0 && !/^\s/.test(line)) {
        inTagsBlock = false;
      } else if (/-\s+area\//.test(line)) {
        findings.push({
          rule: "frontmatter-schema",
          line: lineNo,
          message: "`area/*` used as a tag; AGENTS.md forbids it.",
          evidence: line.trim().slice(0, 120),
        });
      }
    }
  }

  return findings;
}

// Em-dash and double-hyphen detection in body prose only.
// Skips fenced code blocks, inline code, URLs, and frontmatter.
function checkProseStyle(text: string): Finding[] {
  const findings: Finding[] = [];
  const lines: string[] = text.split("\n");

  let inFrontmatter: boolean = false;
  let inFence: boolean = false;
  let frontmatterClosed: boolean = false;

  for (let i = 0; i < lines.length; i++) {
    const raw: string | undefined = lines[i];
    if (raw === undefined) continue;
    const lineNo: number = i + 1;

    // Frontmatter window: first `---`...`---`.
    if (i === 0 && raw === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (raw === "---") {
        inFrontmatter = false;
        frontmatterClosed = true;
      }
      continue;
    }
    void frontmatterClosed;

    // Fenced code blocks (``` or ~~~ at start of line, possibly indented).
    if (/^\s{0,3}(```|~~~)/.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const stripped: string = stripInlineCodeAndUrls(raw);
    if (stripped.includes("\u2014")) {
      findings.push({
        rule: "style-em-dash",
        line: lineNo,
        message:
          "Body contains an em-dash (\u2014); AGENTS.md forbids em-dashes.",
        evidence: excerptAround(raw, "\u2014"),
      });
    }
    if (/[^-]--[^-]/.test(stripped)) {
      findings.push({
        rule: "style-double-hyphen",
        line: lineNo,
        message: "Body contains `--`; AGENTS.md forbids it.",
        evidence: excerptAround(raw, "--"),
      });
    }
  }

  return findings;
}

function stripInlineCodeAndUrls(line: string): string {
  // Drop backtick spans.
  let out: string = line.replace(/`[^`]*`/g, "");
  // Drop bare URLs and markdown link targets.
  out = out.replace(/https?:\/\/\S+/g, "");
  out = out.replace(/\]\([^)]+\)/g, "]");
  return out;
}

function excerptAround(line: string, needle: string): string {
  const idx: number = line.indexOf(needle);
  if (idx === -1) return line.trim().slice(0, 120);
  const start: number = Math.max(0, idx - 30);
  const end: number = Math.min(line.length, idx + 30);
  return line.slice(start, end).trim();
}

// Hedge phrases. Each entry is a case-insensitive regex tested against the
// inline-code/url-stripped line. Multi-word only — bare "may" / "often" are
// too noisy. See AGENTS.md "Cite, don't hedge" for the full rationale.
const HEDGE_PATTERNS: ReadonlyArray<{ re: RegExp; phrase: string }> = [
  { re: /\bmay apply\b/i, phrase: "may apply" },
  { re: /\bin (?:some|many) cases\b/i, phrase: "in some/many cases" },
  { re: /\btends? to\b/i, phrase: "tends to" },
  { re: /\bdepending on\b/i, phrase: "depending on" },
  { re: /\bgenerally speaking\b/i, phrase: "generally speaking" },
  { re: /\bbroadly speaking\b/i, phrase: "broadly speaking" },
  { re: /\bfor the most part\b/i, phrase: "for the most part" },
  { re: /\bmore or less\b/i, phrase: "more or less" },
  { re: /\bin most cases\b/i, phrase: "in most cases" },
  { re: /\bsomewhat\b/i, phrase: "somewhat" },
];

function checkHedges(text: string): Finding[] {
  const findings: Finding[] = [];
  const lines: string[] = text.split("\n");

  let inFrontmatter: boolean = false;
  let inFence: boolean = false;

  for (let i = 0; i < lines.length; i++) {
    const raw: string | undefined = lines[i];
    if (raw === undefined) continue;
    const lineNo: number = i + 1;

    if (i === 0 && raw === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (raw === "---") inFrontmatter = false;
      continue;
    }
    if (/^\s{0,3}(```|~~~)/.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const stripped: string = stripInlineCodeAndUrls(raw);
    for (const { re, phrase } of HEDGE_PATTERNS) {
      const m: RegExpExecArray | null = re.exec(stripped);
      if (m === null) continue;
      findings.push({
        rule: "style-hedge",
        line: lineNo,
        message: `Hedge phrase "${phrase}" — if this softens a previously specific claim, restore the specific and add an inline primary-source citation. See AGENTS.md "Cite, don't hedge". Dismiss if the hedge is the genuinely correct framing.`,
        evidence: excerptAround(raw, m[0]),
      });
      break; // one finding per line is enough
    }
  }

  return findings;
}

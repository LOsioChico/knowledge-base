// Pass 0 for Starlight MDX under sites/docs/src/content/docs/.
// No vault frontmatter; checks prose style + MDX publish hygiene.

import { readFileSync } from "node:fs";
import type { FileReport, Finding } from "./types.js";
import { checkHedges, checkProseStyle } from "./deterministic.js";

const REQUIRED_MDX_KEYS: readonly string[] = ["title", "description"];

/** Obsidian callouts must not appear in published MDX (use `<Aside>`). */
const FORBIDDEN_OBSIDIAN_CALLOUT_RE: RegExp =
  /^>\s*\[!(tip|success|question|failure|danger|bug|quote|note|abstract|cite|warning)\]/i;

/** Starlight Aside: `warning` is invalid; use `caution`. */
const INVALID_ASIDE_TYPE_RE: RegExp =
  /<Aside[^>]*\btype=["']warning["']/i;

const VALID_ASIDE_TYPES: ReadonlySet<string> = new Set([
  "note",
  "tip",
  "caution",
  "danger",
]);

/** MDX hygiene without AGENTS prose style (em-dash, `--`). Prefer `runMdxDeterministic`. */
export function runMdxDeterministicStructural(
  absolutePath: string,
  repoRelative: string,
): FileReport {
  const text: string = readFileSync(absolutePath, "utf8");
  const findings: Finding[] = [];

  findings.push(...checkMdxFrontmatter(text));
  findings.push(...checkMdxTagline(text));
  findings.push(...checkObsidianCalloutsInMdx(text));
  findings.push(...checkAsideTypes(text));
  findings.push(...checkVaultPathWikilinks(text));
  findings.push(...checkMdxPrerequisiteBadge(text, absolutePath.endsWith("index.mdx")));

  findings.sort((a: Finding, b: Finding): number => a.line - b.line);
  return { path: repoRelative, findings };
}

/** Structural + AGENTS prose style (em-dash, `--`). Use for `mdx-audit-notes --profile=mdx-ci`. */
export function runMdxDeterministic(
  absolutePath: string,
  repoRelative: string,
): FileReport {
  const text: string = readFileSync(absolutePath, "utf8");
  const structural: FileReport = runMdxDeterministicStructural(
    absolutePath,
    repoRelative,
  );
  const findings: Finding[] = [
    ...structural.findings,
    ...checkProseStyle(text),
  ];
  findings.sort((a: Finding, b: Finding): number => a.line - b.line);
  return { path: repoRelative, findings };
}

export function runMdxDeterministicAdvisory(
  absolutePath: string,
  repoRelative: string,
): FileReport {
  const text: string = readFileSync(absolutePath, "utf8");
  const findings: Finding[] = checkHedges(text);
  findings.sort((a: Finding, b: Finding): number => a.line - b.line);
  return { path: repoRelative, findings };
}

function checkMdxFrontmatter(text: string): Finding[] {
  const findings: Finding[] = [];
  const lines: string[] = text.split("\n");

  if (lines[0] !== "---") {
    findings.push({
      rule: "frontmatter-schema",
      line: 1,
      message: "MDX must start with YAML frontmatter (`title`, `description`).",
    });
    return findings;
  }

  let end: number = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) {
    findings.push({
      rule: "frontmatter-schema",
      line: 1,
      message: "Frontmatter is not closed with a second `---`.",
    });
    return findings;
  }

  const fm: string = lines.slice(1, end).join("\n");
  for (const key of REQUIRED_MDX_KEYS) {
    const re: RegExp = new RegExp(`^${key}:\\s*.+`, "m");
    if (!re.test(fm)) {
      findings.push({
        rule: "frontmatter-schema",
        line: 2,
        message: `Missing required MDX frontmatter field \`${key}:\`.`,
      });
    }
  }

  return findings;
}

function checkMdxTagline(text: string): Finding[] {
  const findings: Finding[] = [];
  const lines: string[] = text.split("\n");

  let i: number = 0;
  if (lines[0] === "---") {
    for (i = 1; i < lines.length; i++) {
      if (lines[i] === "---") {
        i++;
        break;
      }
    }
  }

  for (; i < lines.length; i++) {
    const raw: string | undefined = lines[i];
    if (raw === undefined) continue;
    const trimmed: string = raw.trim();
    if (trimmed.length === 0) continue;
    if (/^import\s/.test(trimmed)) continue;
    if (trimmed.startsWith(">")) return findings;
    if (trimmed.startsWith("#")) {
      findings.push({
        rule: "frontmatter-schema",
        line: i + 1,
        message:
          "First body content after imports should be a one-line `>` tagline blockquote (kb-author S1).",
        evidence: trimmed.slice(0, 120),
      });
      return findings;
    }
    findings.push({
      rule: "frontmatter-schema",
      line: i + 1,
      message:
        "First body content after imports should be a one-line `>` tagline blockquote.",
      evidence: trimmed.slice(0, 120),
    });
    return findings;
  }

  return findings;
}

function checkObsidianCalloutsInMdx(text: string): Finding[] {
  const findings: Finding[] = [];
  const lines: string[] = text.split("\n");
  let inFence: boolean = false;

  for (let i = 0; i < lines.length; i++) {
    const raw: string | undefined = lines[i];
    if (raw === undefined) continue;
    if (/^\s{0,3}(```|~~~)/.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (FORBIDDEN_OBSIDIAN_CALLOUT_RE.test(raw)) {
      findings.push({
        rule: "callout-placement",
        line: i + 1,
        message:
          "Obsidian callout in MDX; use Starlight `<Aside type=\"caution|note|tip|danger\">` instead.",
        evidence: raw.trim().slice(0, 120),
      });
    }
  }

  return findings;
}

function checkAsideTypes(text: string): Finding[] {
  const findings: Finding[] = [];
  const lines: string[] = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const raw: string | undefined = lines[i];
    if (raw === undefined) continue;
    const lineNo: number = i + 1;

    if (INVALID_ASIDE_TYPE_RE.test(raw)) {
      findings.push({
        rule: "frontmatter-schema",
        line: lineNo,
        message:
          '`<Aside type="warning">` is invalid in Starlight; use `type="caution"`.',
        evidence: raw.trim().slice(0, 120),
      });
      continue;
    }

    const m: RegExpMatchArray | null =
      /<Aside[^>]*\btype=["']([^"']+)["']/.exec(raw);
    if (m !== null && !VALID_ASIDE_TYPES.has(m[1]!)) {
      findings.push({
        rule: "frontmatter-schema",
        line: lineNo,
        message: `Unknown Aside type "${m[1]}"; use note, tip, caution, or danger.`,
        evidence: raw.trim().slice(0, 120),
      });
    }
  }

  return findings;
}

function checkVaultPathWikilinks(text: string): Finding[] {
  const findings: Finding[] = [];
  const lines: string[] = text.split("\n");
  let inFence: boolean = false;

  for (let i = 0; i < lines.length; i++) {
    const raw: string | undefined = lines[i];
    if (raw === undefined) continue;
    if (/^\s{0,3}(```|~~~)/.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (/\[\[content\//.test(raw)) {
      findings.push({
        rule: "frontmatter-schema",
        line: i + 1,
        message:
          "Wikilink targets vault path `content/...`; use published slug `[[area/note|label]]`.",
        evidence: raw.trim().slice(0, 120),
      });
    }
  }

  return findings;
}

/** Enforces that every non-index note-level page has documented prerequisites. */
function checkMdxPrerequisiteBadge(text: string, isIndex: boolean): Finding[] {
  const findings: Finding[] = [];
  if (isIndex) return findings;

  const lines = text.split("\n");
  let hasTaglinePrereq = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw === undefined) continue;
    const trimmed = raw.trim();
    if (trimmed.startsWith(">") && /Prerequisite:/i.test(trimmed)) {
      hasTaglinePrereq = true;
      break;
    }
  }

  const hasAsidePrereq = /<Aside\s+[^>]*type=["']tip["']\s+[^>]*title=["']Prerequisites["']/i.test(text);

  if (!hasTaglinePrereq && !hasAsidePrereq) {
    findings.push({
      rule: "frontmatter-schema",
      line: 1,
      message:
        "Missing prerequisite documentation. Notes must either carry 'Prerequisite: [[link]]' in their tagline quote, or have a standard `<Aside type=\"tip\" title=\"Prerequisites\">` badge block at the top of the body.",
    });
  }

  return findings;
}

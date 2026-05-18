// Shared skip-zone detection for deterministic audit passes and candidate finders.
// Mirrors dismissal patterns in dismissed.json: pending/planned lists, MOC taglines,
// playbook exclusion headings, and (planned) wikilinks.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Headings whose bodies are enumerations, not prose claims. */
const SKIP_SECTION_HEADINGS: readonly string[] = [
  "pending notes",
  "pending",
  "see also",
  "further reading",
  "related",
  "references",
];

/** Substrings in `##` headings that mark planned-recipe / exclusion lists. */
const SKIP_SECTION_HEADING_CONTAINS: readonly string[] = [
  "what's not",
  "whats not",
];

const PLANNED_WIKILINK_RE: RegExp = /\[\[[^\]]+\(planned\)[^\]]*\]\]/i;

function parseFrontmatterEnd(lines: readonly string[]): number {
  if (lines[0]?.trim() !== "---") return 0;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") return i + 1;
  }
  return 0;
}

function headingOpensSkipSection(headingText: string): boolean {
  const text: string = headingText.toLowerCase().trim();
  if (
    SKIP_SECTION_HEADINGS.some(
      (h: string): boolean => text === h || text.startsWith(`${h}:`),
    )
  ) {
    return true;
  }
  return SKIP_SECTION_HEADING_CONTAINS.some((frag: string): boolean =>
    text.includes(frag),
  );
}

function isIndexNote(repoRelPath: string, lines: readonly string[]): boolean {
  if (repoRelPath.endsWith("/index.md") || repoRelPath === "content/index.md") {
    return true;
  }
  // Frontmatter type/moc tag is a secondary signal for non-index filenames.
  if (lines[0]?.trim() !== "---") return false;
  const end: number = parseFrontmatterEnd(lines);
  for (let i = 1; i < end; i++) {
    const line: string = lines[i] ?? "";
    if (/^tags:\s*\[.*type\/moc/.test(line)) return true;
  }
  return false;
}

/** First non-empty body line (1-based), after frontmatter. */
export function findBodyStartLine(lines: readonly string[]): number {
  const frontEnd: number = parseFrontmatterEnd(lines);
  for (let i: number = frontEnd; i < lines.length; i++) {
    const ln: string = lines[i] ?? "";
    if (ln.trim() && ln.trim() !== "---") return i + 1;
  }
  return frontEnd + 1;
}

/**
 * Returns 1-based line numbers that fall inside a skip-zone section body, plus
 * individual lines that match standalone skip patterns (planned wikilinks).
 */
export function findSkipLines(noteText: string): Set<number> {
  const lines: string[] = noteText.split("\n");
  const skip: Set<number> = new Set();
  let inSkipSection: boolean = false;
  let inFrontmatter: boolean = lines[0] === "---";

  for (let i: number = 0; i < lines.length; i++) {
    const line: string = lines[i] ?? "";
    const lineNo: number = i + 1;

    if (inFrontmatter) {
      if (i > 0 && line === "---") inFrontmatter = false;
      continue;
    }

    if (PLANNED_WIKILINK_RE.test(line)) {
      skip.add(lineNo);
    }

    const heading: RegExpExecArray | null = /^##\s+(.+?)\s*$/.exec(line);
    if (heading !== null) {
      inSkipSection = headingOpensSkipSection(heading[1]!);
      continue;
    }

    if (inSkipSection) skip.add(lineNo);
  }

  return skip;
}

export function isLineInSkipZone(noteText: string, line: number): boolean {
  return findSkipLines(noteText).has(line);
}

export interface ShowDontTellSkipContext {
  /** 1-based lines inside skip-zone sections or with (planned) wikilinks. */
  skipLines: ReadonlySet<number>;
  /** MOC/index notes: skip tagline blockquote only (conservative). */
  indexTaglineLines: ReadonlySet<number>;
}

/**
 * Conservative MOC skip: only the first blockquote tagline (through the first
 * blank line after it), not the whole pending/available sections.
 */
function findIndexTaglineLines(lines: readonly string[]): Set<number> {
  const skip: Set<number> = new Set();
  const bodyStart: number = findBodyStartLine(lines);
  let inTagline: boolean = false;
  let seenContent: boolean = false;

  for (let i: number = bodyStart - 1; i < lines.length; i++) {
    const lineNo: number = i + 1;
    const line: string = lines[i] ?? "";
    const trimmed: string = line.trim();

    if (!seenContent) {
      if (trimmed === "") continue;
      if (/^>\s?/.test(line)) {
        inTagline = true;
        seenContent = true;
        skip.add(lineNo);
        continue;
      }
      break;
    }

    if (inTagline) {
      if (trimmed === "") {
        inTagline = false;
        break;
      }
      if (/^>\s?/.test(line)) {
        skip.add(lineNo);
        continue;
      }
      break;
    }
  }

  return skip;
}

export function buildShowDontTellSkipContext(
  repoRelPath: string,
  noteText: string,
): ShowDontTellSkipContext {
  const lines: string[] = noteText.split("\n");
  const skipLines: Set<number> = findSkipLines(noteText);
  const indexTaglineLines: Set<number> = isIndexNote(repoRelPath, lines)
    ? findIndexTaglineLines(lines)
    : new Set();
  return { skipLines, indexTaglineLines };
}

export function readNoteText(repoRoot: string, repoRelPath: string): string {
  return readFileSync(resolve(repoRoot, repoRelPath), "utf8");
}

export function isShowDontTellLineSkipped(
  ctx: ShowDontTellSkipContext,
  lineNo: number,
): boolean {
  if (ctx.skipLines.has(lineNo)) return true;
  if (ctx.indexTaglineLines.has(lineNo)) return true;
  return false;
}

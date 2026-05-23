import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

// Basic styling helpers
const reset = "\x1b[0m";
const bold = "\x1b[1m";
const cyan = "\x1b[36m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
const red = "\x1b[31m";
const gray = "\x1b[90m";

interface Note {
  title: string;
  slug: string;
  absolutePath: string;
  aliases: string[];
  baseName: string;
  content: string;
}

const docsDir = path.resolve(__dirname, "../sites/docs/src/content/docs");
const contentDir = path.resolve(__dirname, "../content");

// Simple frontmatter parser
function parseFrontmatter(content: string): { title: string; aliases: string[]; area: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { title: "", aliases: [], area: "" };
  
  const yaml = match[1];
  let title = "";
  let aliases: string[] = [];
  let area = "";
  
  const titleMatch = yaml.match(/^title:\s*(.*)$/m);
  if (titleMatch) title = titleMatch[1].replace(/['"]/g, "").trim();
  
  const aliasesMatch = yaml.match(/^aliases:\s*\[(.*?)\]$/m);
  if (aliasesMatch) {
    aliases = aliasesMatch[1].split(",").map(a => a.replace(/['"]/g, "").trim()).filter(Boolean);
  }
  
  const areaMatch = yaml.match(/^area:\s*(.*)$/m);
  if (areaMatch) area = areaMatch[1].replace(/['"]/g, "").trim();
  
  return { title, aliases, area };
}

// Map slugs to absolute file paths in priority order
function findFilePathBySlug(slug: string): string | null {
  const paths = [
    path.join(docsDir, `${slug}.mdx`),
    path.join(docsDir, `${slug}.md`),
    path.join(contentDir, `${slug}.md`),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function getSlugFromFilePath(filePath: string): string {
  const normalized = path.resolve(filePath);
  const docsPrefix = path.resolve(docsDir);
  const contentPrefix = path.resolve(contentDir);

  if (normalized.startsWith(docsPrefix)) {
    return path.relative(docsPrefix, normalized).replace(/\.(mdx|md)$/, "");
  } else if (normalized.startsWith(contentPrefix)) {
    return path.relative(contentPrefix, normalized).replace(/\.md$/, "");
  }
  return path.basename(normalized).replace(/\.(mdx|md)$/, "");
}

// Build index of all notes in the knowledge base
function scanAllNotes(): Note[] {
  const notes: Note[] = [];
  
  function scan(dir: string, baseDir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath, baseDir);
      } else if (entry.isFile() && (entry.name.endsWith(".mdx") || entry.name.endsWith(".md"))) {
        if (entry.name === "AGENTS.md" || entry.name === "README.md") continue;
        const content = fs.readFileSync(fullPath, "utf-8");
        const { title, aliases } = parseFrontmatter(content);
        const slug = path.relative(baseDir, fullPath).replace(/\.(mdx|md)$/, "");
        const baseName = path.basename(fullPath).replace(/\.(mdx|md)$/, "");
        
        notes.push({
          title: title || baseName,
          slug,
          absolutePath: fullPath,
          aliases,
          baseName,
          content,
        });
      }
    }
  }
  
  scan(docsDir, docsDir);
  scan(contentDir, contentDir);
  return notes;
}

// Staged file parser using Git
function getStagedFiles(): string[] {
  try {
    const output = execSync("git diff --name-only --cached", { encoding: "utf-8" });
    return output
      .split(/\r?\n/)
      .map(f => f.trim())
      .filter(f => f && (f.endsWith(".mdx") || f.endsWith(".md")))
      .map(f => path.resolve(process.cwd(), f));
  } catch (e) {
    console.error(`${red}Error fetching staged files from Git:${reset}`, e);
    return [];
  }
}

// ---------------------------------------------------------
// Helper for parsing/updating frontmatter lines in-place
// ---------------------------------------------------------
export function getFrontmatterAndBody(content: string): { frontmatterLines: string[], body: string, hasFrontmatter: boolean } {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") return { frontmatterLines: [], body: content, hasFrontmatter: false };
  
  const frontmatterLines: string[] = [];
  let i = 1;
  while (i < lines.length && lines[i] !== "---") {
    frontmatterLines.push(lines[i]);
    i++;
  }
  const body = lines.slice(i + 1).join("\n");
  return { frontmatterLines, body, hasFrontmatter: true };
}

export function parseRelatedLinks(frontmatterLines: string[]): { links: string[], startIndex: number, endIndex: number, format: "inline" | "bullet" } {
  let links: string[] = [];
  let startIndex = -1;
  let endIndex = -1;
  let format: "inline" | "bullet" = "bullet";

  for (let i = 0; i < frontmatterLines.length; i++) {
    const line = frontmatterLines[i];
    if (line.trim().startsWith("related:")) {
      startIndex = i;
      const val = line.slice(line.indexOf(":") + 1).trim();
      if (val.startsWith("[") && val.endsWith("]")) {
        format = "inline";
        endIndex = i;
        const inner = val.slice(1, -1);
        if (inner.trim()) {
          links = inner.split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
        }
      } else {
        format = "bullet";
        endIndex = i;
        let j = i + 1;
        while (j < frontmatterLines.length) {
          const nextLine = frontmatterLines[j];
          if (nextLine.trim().startsWith("-")) {
            const match = nextLine.match(/-\s*["']?\[\[(.*?)\]\]["']?/);
            if (match) {
              links.push(`[[${match[1]}]]`);
            } else {
              const item = nextLine.replace(/^\s*-\s*/, "").replace(/^["']|["']$/g, "").trim();
              if (item) links.push(item);
            }
            endIndex = j;
            j++;
          } else if (nextLine.trim() === "" || nextLine.includes(":")) {
            break;
          } else {
            break;
          }
        }
      }
      break;
    }
  }
  return { links, startIndex, endIndex, format };
}

export function addRelatedLinkToFrontmatter(frontmatterLines: string[], targetLink: string): string[] {
  const { links, startIndex, endIndex, format } = parseRelatedLinks(frontmatterLines);
  
  // Clean clean link check
  const cleanLink = targetLink.replace(/^["']|["']$/g, "");
  const normalizedClean = cleanLink.replace(/^\[\[|\]\]$/g, "");
  const isAlreadyLinked = links.some(l => {
    const n = l.replace(/^\[\[|\]\]$/g, "");
    return n.toLowerCase() === normalizedClean.toLowerCase();
  });

  if (isAlreadyLinked) return frontmatterLines;

  const newLinks = [...links, targetLink];
  const updatedLines = [...frontmatterLines];

  if (startIndex === -1) {
    // If related: is completely missing, append it at the end
    updatedLines.push("related:");
    updatedLines.push(`  - "${targetLink}"`);
  } else {
    if (format === "inline") {
      const updatedVal = `related: [${newLinks.map(l => `"${l}"`).join(", ")}]`;
      updatedLines.splice(startIndex, endIndex - startIndex + 1, updatedVal);
    } else {
      const updatedVal = [
        "related:",
        ...newLinks.map(l => `  - "${l}"`)
      ];
      updatedLines.splice(startIndex, endIndex - startIndex + 1, ...updatedVal);
    }
  }
  return updatedLines;
}

// ---------------------------------------------------------
// 1. Symmetric Link Auto-Fixer
// ---------------------------------------------------------
function fixSymmetricLinks(filePath: string, dryRun: boolean): boolean {
  const content = fs.readFileSync(filePath, "utf-8");
  const { frontmatterLines, body, hasFrontmatter } = getFrontmatterAndBody(content);
  if (!hasFrontmatter) return false;

  const currentSlug = getSlugFromFilePath(filePath);
  const { links } = parseRelatedLinks(frontmatterLines);
  let modifiedAnyTarget = false;

  for (const link of links) {
    const targetSlug = link.replace(/^\[\[|\]\]$/g, "");
    const targetPath = findFilePathBySlug(targetSlug);
    if (!targetPath) continue;

    const targetContent = fs.readFileSync(targetPath, "utf-8");
    const targetFM = getFrontmatterAndBody(targetContent);
    if (!targetFM.hasFrontmatter) continue;

    const targetRelated = parseRelatedLinks(targetFM.frontmatterLines);
    const normalizedCurrent = currentSlug.toLowerCase();
    const targetHasBacklink = targetRelated.links.some(l => {
      const n = l.replace(/^\[\[|\]\]$/g, "");
      return n.toLowerCase() === normalizedCurrent;
    });

    if (!targetHasBacklink) {
      console.log(`  ${yellow}→ Adding symmetric backlink in target: [[${currentSlug}]] in ${path.basename(targetPath)}${reset}`);
      if (!dryRun) {
        const updatedFM = addRelatedLinkToFrontmatter(targetFM.frontmatterLines, `[[${currentSlug}]]`);
        const newTargetContent = `---
${updatedFM.join("\n")}
---
${targetFM.body}`;
        fs.writeFileSync(targetPath, newTargetContent, "utf-8");
        execSync(`git add "${targetPath}"`);
      }
      modifiedAnyTarget = true;
    }
  }

  return modifiedAnyTarget;
}

// ---------------------------------------------------------
// 2. Smart Import Injector
// ---------------------------------------------------------
const IMPORT_MAPS = [
  {
    library: "@nestjs/common",
    tokens: [
      "Controller", "Get", "Post", "Put", "Delete", "Patch", "Injectable", "Inject",
      "UseGuards", "UseInterceptors", "UsePipes", "UseFilters", "Catch", "Req", "Res",
      "Query", "Param", "Body", "Headers", "HttpCode", "Redirect", "Header",
      "NestInterceptor", "PipeTransform", "NestMiddleware", "CanActivate", "ExceptionFilter",
      "ExecutionContext", "CallHandler", "ArgumentsHost", "HttpStatus", "Optional", "ForwardRef",
      "Logger", "INestApplication"
    ]
  },
  {
    library: "@nestjs/core",
    tokens: [
      "NestFactory", "APP_GUARD", "APP_INTERCEPTOR", "APP_PIPE", "APP_FILTER", "Reflector", "ModuleRef"
    ]
  },
  {
    library: "rxjs",
    tokens: [
      "Observable", "of", "from", "map", "tap", "catchError", "throwError", "delay", "mergeMap", "switchMap", "concatMap"
    ]
  }
];

export function injectImportsIntoCodeBlocks(body: string): { updatedBody: string, modified: boolean } {
  let modified = false;
  // Match fenced typescript code blocks
  const regex = /```(ts|typescript|tsx)\b([\s\S]*?)```/g;
  
  const updatedBody = body.replace(regex, (match, lang, code) => {
    // Check if the block explicitly opts out
    if (code.includes("no-inject") || code.includes("no-inject-imports")) {
      return match;
    }

    let injectedLines: string[] = [];

    for (const lib of IMPORT_MAPS) {
      // If code already imports from this library, skip it
      const hasImportRe = new RegExp(`from ['"]${lib.library}['"]`);
      if (hasImportRe.test(code)) continue;

      // Scan for used tokens with exact word boundary
      const matchedTokens: string[] = [];
      for (const token of lib.tokens) {
        const tokenRe = new RegExp(`\\b${token}\\b`);
        if (tokenRe.test(code)) {
          matchedTokens.push(token);
        }
      }

      if (matchedTokens.length > 0) {
        injectedLines.push(`import { ${matchedTokens.sort().join(", ")} } from "${lib.library}";`);
      }
    }

    if (injectedLines.length > 0) {
      modified = true;
      // Prepend imports with a double newline to separate from rest of the block
      const cleanCode = code.trimStart();
      return `\`\`\`${lang}\n${injectedLines.join("\n")}\n\n${cleanCode}\`\`\``;
    }

    return match;
  });

  return { updatedBody, modified };
}

// ---------------------------------------------------------
// 3. First-Mention Wikilink Auto-Fixer
// ---------------------------------------------------------
function buildProseMask(body: string): string {
  const mask = body.split("");

  const blankRange = (start: number, end: number) => {
    for (let i = start; i < end; i++) {
      if (mask[i] !== "\n" && mask[i] !== "\r") {
        mask[i] = " ";
      }
    }
  };

  // 1. Fenced code blocks
  const fenceRe = /```[\s\S]*?```/g;
  let match;
  while ((match = fenceRe.exec(body)) !== null) {
    blankRange(match.index, match.index + match[0].length);
  }

  // 2. Inline code `...`
  const inlineRe = /`[^`\r\n]+`/g;
  while ((match = inlineRe.exec(body)) !== null) {
    blankRange(match.index, match.index + match[0].length);
  }

  // 3. HTML tags <...>
  const htmlRe = /<[^>]+?>/g;
  while ((match = htmlRe.exec(body)) !== null) {
    blankRange(match.index, match.index + match[0].length);
  }

  // 4. Existing wikilinks [[...]]
  const wikiRe = /\[\[[^\]]+?\]\]/g;
  while ((match = wikiRe.exec(body)) !== null) {
    blankRange(match.index, match.index + match[0].length);
  }

  // 5. Standard markdown links [...](...)
  const mdLinkRe = /\[[^\]]+?\]\([^)]+?\)/g;
  while ((match = mdLinkRe.exec(body)) !== null) {
    blankRange(match.index, match.index + match[0].length);
  }

  // 6. Headings (e.g. ## Heading)
  const headingRe = /^##+\s+.*$/gm;
  while ((match = headingRe.exec(body)) !== null) {
    blankRange(match.index, match.index + match[0].length);
  }

  return mask.join("");
}

interface Concept {
  slug: string;
  terms: string[];
}

function buildConceptCatalog(notes: Note[]): Concept[] {
  const GENERIC_BASENAMES = new Set(["cli", "api", "faq", "tldr", "quickstart"]);
  return notes
    .filter(note => {
      // Don't include index MOCs
      return note.baseName !== "index";
    })
    .map(note => {
      const terms: string[] = [];
      const seen = new Set<string>();
      const add = (term: string) => {
        const normalized = term.trim();
        const key = normalized.toLowerCase();
        if (normalized.length < 3 || seen.has(key)) return;
        seen.add(key);
        terms.push(normalized);
      };
      
      const titleTerm = note.title.trim();
      if (titleTerm && !GENERIC_BASENAMES.has(titleTerm.toLowerCase())) {
        add(titleTerm);
      }
      
      for (const alias of note.aliases) {
        add(alias);
      }
      
      const baseTerm = note.baseName.replace(/-/g, " ");
      if (!GENERIC_BASENAMES.has(baseTerm.toLowerCase())) {
        add(baseTerm);
      }
      
      terms.sort((a, b) => b.length - a.length);
      return { slug: note.slug, terms };
    });
}

export function fixFirstMentionWikilinks(
  body: string,
  currentSlug: string,
  concepts: Concept[]
): { updatedBody: string, modified: boolean } {
  let updatedBody = body;
  let modified = false;

  // Gather existing wikilink targets already present in body
  const existingWikiRe = /\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]/g;
  const existingTargets = new Set<string>();
  let wikiMatch;
  while ((wikiMatch = existingWikiRe.exec(body)) !== null) {
    existingTargets.add(wikiMatch[1].trim().toLowerCase());
  }

  // Keep a mask that we update progressively as we do matches
  let proseMask = buildProseMask(body);

  interface Replacement {
    index: number;
    length: number;
    replacementText: string;
  }
  const replacements: Replacement[] = [];

  for (const concept of concepts) {
    // A note never links to itself
    if (concept.slug.toLowerCase() === currentSlug.toLowerCase()) continue;
    // If target note is already linked, skip
    if (existingTargets.has(concept.slug.toLowerCase())) continue;

    // Find all matches for all terms
    const matches: { index: number; length: number; term: string }[] = [];
    for (const term of concept.terms) {
      // Word boundary matching, escape regex special characters
      const escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const re = new RegExp(`\\b${escapedTerm}\\b`, "gi");
      let termMatch;
      while ((termMatch = re.exec(proseMask)) !== null) {
        // Double-check no overlap with already selected replacements
        const index = termMatch.index;
        const length = termMatch[0].length;
        matches.push({ index, length, term: termMatch[0] });
      }
    }

    if (matches.length > 0) {
      // Sort matches by index to find the FIRST occurrence
      matches.sort((a, b) => a.index - b.index);
      const first = matches[0];

      // Add to replacements
      replacements.push({
        index: first.index,
        length: first.length,
        replacementText: `[[${concept.slug}|${first.term}]]`
      });

      // Crucially, add it to existingTargets to prevent any future matches of different terms for this note
      existingTargets.add(concept.slug.toLowerCase());

      // Update proseMask to blank out the replaced region to prevent overlapping matches from other concepts
      const maskChars = proseMask.split("");
      for (let i = first.index; i < first.index + first.length; i++) {
        if (maskChars[i] !== "\n" && maskChars[i] !== "\r") maskChars[i] = " ";
      }
      proseMask = maskChars.join("");
    }
  }

  if (replacements.length > 0) {
    modified = true;
    // Apply replacements from back to front to preserve indices
    replacements.sort((a, b) => b.index - a.index);
    for (const rep of replacements) {
      updatedBody = updatedBody.slice(0, rep.index) + rep.replacementText + updatedBody.slice(rep.index + rep.length);
    }
  }

  return { updatedBody, modified };
}

// ---------------------------------------------------------
// Core Note Processing Runner
// ---------------------------------------------------------
function processNoteFile(filePath: string, concepts: Concept[], dryRun: boolean): boolean {
  console.log(`Processing note: ${cyan}${path.basename(filePath)}${reset}`);
  const content = fs.readFileSync(filePath, "utf-8");
  const { frontmatterLines, body, hasFrontmatter } = getFrontmatterAndBody(content);
  
  if (!hasFrontmatter) {
    console.log(`  ${gray}Skipping: file has no YAML frontmatter.${reset}`);
    return false;
  }

  const currentSlug = getSlugFromFilePath(filePath);
  let currentBody = body;
  let fileModified = false;

  // 1. Smart Import Injector
  const importResult = injectImportsIntoCodeBlocks(currentBody);
  if (importResult.modified) {
    console.log(`  ${green}✓ Injected missing NestJS/RxJS imports into code blocks.${reset}`);
    currentBody = importResult.updatedBody;
    fileModified = true;
  }

  // 2. First-Mention Wikilink Injector
  const fmResult = fixFirstMentionWikilinks(currentBody, currentSlug, concepts);
  if (fmResult.modified) {
    console.log(`  ${green}✓ Converted plain first mentions to body wikilinks.${reset}`);
    currentBody = fmResult.updatedBody;
    fileModified = true;
  }

  if (fileModified) {
    if (!dryRun) {
      const newContent = `---
${frontmatterLines.join("\n")}
---
${currentBody}`;
      fs.writeFileSync(filePath, newContent, "utf-8");
      execSync(`git add "${filePath}"`);
      console.log(`  ${green}⚡ File saved and auto-staged successfully.${reset}`);
    } else {
      console.log(`  ${yellow}⚡ [Dry Run] Changes would be saved and staged.${reset}`);
    }
  } else {
    console.log(`  ${gray}No inline changes required.${reset}`);
  }

  // 3. Symmetric Link Auto-Fixer (operates on other files, so do it separately)
  const symLinksModified = fixSymmetricLinks(filePath, dryRun);
  
  return fileModified || symLinksModified;
}

// CLI Entrypoint
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const allNotesMode = args.includes("--all");

  console.log(`\n${bold}${cyan}========================================================================${reset}`);
  console.log(`${bold}${cyan}        GIT GUARDIAN PRE-COMMIT AUTOFIXER — KNOWLEDGE BASE${reset}`);
  console.log(`${bold}${cyan}========================================================================${reset}`);

  if (dryRun) {
    console.log(`${bold}${yellow}⚠️ DRY-RUN MODE ACTIVE: No files will be modified.${reset}\n`);
  }

  let targets: string[] = [];

  if (allNotesMode) {
    console.log(`${gray}Scanning all notes in workspace...${reset}`);
    const allNotes = scanAllNotes();
    targets = allNotes.map(n => n.absolutePath);
    console.log(`${green}Found ${targets.length} notes in workspace.${reset}\n`);
  } else {
    console.log(`${gray}Querying Git for staged note files...${reset}`);
    targets = getStagedFiles();
    if (targets.length === 0) {
      console.log(`${green}No staged note files (.mdx / .md) detected. Exiting cleanly!${reset}\n`);
      process.exit(0);
    }
    console.log(`${green}Found ${targets.length} staged note file(s) to check.${reset}\n`);
  }

  // Build the global concept catalog once
  console.log(`${gray}Building semantic concept catalog...${reset}`);
  const allNotes = scanAllNotes();
  const concepts = buildConceptCatalog(allNotes);
  console.log(`${green}Semantic index loaded with ${concepts.length} concepts.${reset}\n`);

  let modifiedCount = 0;
  for (const target of targets) {
    const wasModified = processNoteFile(target, concepts, dryRun);
    if (wasModified) modifiedCount++;
  }

  console.log(`\n${bold}${green}Autofixer complete! Modified and staged ${modifiedCount} file(s).${reset}`);
  console.log(`${bold}${cyan}========================================================================${reset}\n`);
}

// If executed directly, run main
if (require.main === module) {
  main();
}

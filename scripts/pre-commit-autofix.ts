import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    path.join(docsDir, slug, "index.mdx"),
    path.join(docsDir, slug, "index.md"),
    path.join(contentDir, `${slug}.md`),
    path.join(contentDir, slug, "index.md"),
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

  let slug = "";
  if (normalized.startsWith(docsPrefix)) {
    slug = path.relative(docsPrefix, normalized).replace(/\.(mdx|md)$/, "");
  } else if (normalized.startsWith(contentPrefix)) {
    slug = path.relative(contentPrefix, normalized).replace(/\.md$/, "");
  } else {
    slug = path.basename(normalized).replace(/\.(mdx|md)$/, "");
  }

  if (slug.endsWith("/index")) {
    slug = slug.slice(0, -6);
  }
  return slug;
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
interface ImportRule {
  library: string;
  imports: {
    token: string;
    triggers: RegExp[];
  }[];
}

const IMPORT_RULES: ImportRule[] = [
  {
    library: "@nestjs/common",
    imports: [
      { token: "Controller", triggers: [/@Controller\b/] },
      { token: "Get", triggers: [/@Get\b/] },
      { token: "Post", triggers: [/@Post\b/] },
      { token: "Put", triggers: [/@Put\b/] },
      { token: "Delete", triggers: [/@Delete\b/] },
      { token: "Patch", triggers: [/@Patch\b/] },
      { token: "Injectable", triggers: [/@Injectable\b/] },
      { token: "Inject", triggers: [/@Inject\b/] },
      { token: "UseGuards", triggers: [/@UseGuards\b/] },
      { token: "UseInterceptors", triggers: [/@UseInterceptors\b/] },
      { token: "UsePipes", triggers: [/@UsePipes\b/] },
      { token: "UseFilters", triggers: [/@UseFilters\b/] },
      { token: "Catch", triggers: [/@Catch\b/] },
      { token: "Req", triggers: [/@Req\b/] },
      { token: "Res", triggers: [/@Res\b/] },
      { token: "Query", triggers: [/@Query\b/] },
      { token: "Param", triggers: [/@Param\b/] },
      { token: "Body", triggers: [/@Body\b/] },
      { token: "Headers", triggers: [/@Headers\b/] },
      { token: "HttpCode", triggers: [/@HttpCode\b/] },
      { token: "Redirect", triggers: [/@Redirect\b/] },
      { token: "Header", triggers: [/@Header\b/] },
      { token: "NestInterceptor", triggers: [/\bNestInterceptor\b/] },
      { token: "PipeTransform", triggers: [/\bPipeTransform\b/] },
      { token: "NestMiddleware", triggers: [/\bNestMiddleware\b/] },
      { token: "CanActivate", triggers: [/\bCanActivate\b/] },
      { token: "ExceptionFilter", triggers: [/\bExceptionFilter\b/] },
      { token: "ExecutionContext", triggers: [/\bExecutionContext\b/] },
      { token: "CallHandler", triggers: [/\bCallHandler\b/] },
      { token: "ArgumentsHost", triggers: [/\bArgumentsHost\b/] },
      { token: "HttpStatus", triggers: [/\bHttpStatus\b/] },
      { token: "Optional", triggers: [/\bOptional\b/] },
      { token: "ForwardRef", triggers: [/\bForwardRef\b/] },
      { token: "Logger", triggers: [/\bLogger\b/] },
      { token: "INestApplication", triggers: [/\bINestApplication\b/] }
    ]
  },
  {
    library: "@nestjs/core",
    imports: [
      { token: "NestFactory", triggers: [/\bNestFactory\b/] },
      { token: "APP_GUARD", triggers: [/\bAPP_GUARD\b/] },
      { token: "APP_INTERCEPTOR", triggers: [/\bAPP_INTERCEPTOR\b/] },
      { token: "APP_PIPE", triggers: [/\bAPP_PIPE\b/] },
      { token: "APP_FILTER", triggers: [/\bAPP_FILTER\b/] },
      { token: "Reflector", triggers: [/\bReflector\b/] },
      { token: "ModuleRef", triggers: [/\bModuleRef\b/] }
    ]
  },
  {
    library: "rxjs",
    imports: [
      { token: "Observable", triggers: [/\bObservable\b/] },
      { token: "of", triggers: [/(?<!\.)\bof\s*\(/] },
      { token: "from", triggers: [/(?<!\.)\bfrom\s*\(/] },
      { token: "throwError", triggers: [/(?<!\.)\bthrowError\s*\(/] },
      { token: "map", triggers: [/(?<!\.)\bmap\s*\(/] },
      { token: "tap", triggers: [/(?<!\.)\btap\s*\(/] },
      { token: "catchError", triggers: [/(?<!\.)\bcatchError\s*\(/] },
      { token: "delay", triggers: [/(?<!\.)\bdelay\s*\(/] },
      { token: "mergeMap", triggers: [/(?<!\.)\bmergeMap\s*\(/] },
      { token: "switchMap", triggers: [/(?<!\.)\bswitchMap\s*\(/] },
      { token: "concatMap", triggers: [/(?<!\.)\bconcatMap\s*\(/] }
    ]
  }
];

function cleanCodeForTokenMatching(code: string): string {
  return code
    // 1. Remove comments
    .replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "")
    // 2. Remove string literals
    .replace(/'[^']*'|"[^"]*"|`[^`]*`/g, "")
    // 3. Remove standard import declarations
    .replace(/^\s*import\s+[\s\S]*?;\r?\n/gm, "")
    .replace(/^\s*import\s+[\s\S]*?$/gm, "");
}

export function injectImportsIntoCodeBlocks(body: string): { updatedBody: string, modified: boolean } {
  let modified = false;
  // Match fenced typescript code blocks with their line attributes
  const regex = /```(ts|typescript|tsx)(.*?)\r?\n([\s\S]*?)```/g;
  
  const updatedBody = body.replace(regex, (match, lang, attrs, code) => {
    // Check if the block is a twoslash block or explicitly opts out
    if (attrs.includes("twoslash") || code.includes("no-inject") || code.includes("no-inject-imports")) {
      return match;
    }

    let injectedLines: string[] = [];
    const cleanedCode = cleanCodeForTokenMatching(code);

    for (const lib of IMPORT_RULES) {
      // If code already imports from this library, skip it
      const hasImportRe = new RegExp(`from ['"]${lib.library}['"]`);
      if (hasImportRe.test(code)) continue;

      // Scan for used tokens with exact trigger regexes on the cleaned code
      const matchedTokens: string[] = [];
      for (const item of lib.imports) {
        const isMatched = item.triggers.some(re => re.test(cleanedCode));
        if (isMatched) {
          matchedTokens.push(item.token);
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
      return `\`\`\`${lang}${attrs}\n${injectedLines.join("\n")}\n\n${cleanCode}\`\`\``;
    }

    return match;
  });

  return { updatedBody, modified };
}

// ---------------------------------------------------------
// 2.5. Effect Twoslash Auto-Converter
// ---------------------------------------------------------
function hasForbiddenImportsForTwoslash(code: string): boolean {
  // Extract all import and export sources
  const importRe = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;

  const allowedPackages = new Set([
    "effect",
    "@effect/platform",
    "@effect/platform-node"
  ]);

  const allowedBuiltins = new Set([
    "fs", "path", "http", "https", "crypto", "os", "url", "events",
    "child_process", "util", "assert", "stream", "dns", "net",
    "tls", "zlib", "readline", "querystring", "punycode"
  ]);

  while ((match = importRe.exec(code)) !== null) {
    const source = match[1];
    if (source.startsWith(".") || source.startsWith("/")) continue;
    if (source.startsWith("node:")) continue;
    if (allowedPackages.has(source)) continue;
    if (allowedBuiltins.has(source)) continue;

    return true;
  }

  return false;
}

export function convertEffectBlocksToTwoslash(body: string): { updatedBody: string, modified: boolean } {
  let modified = false;
  // Match fenced typescript code blocks with their line attributes
  const regex = /```(ts|typescript|tsx)(.*?)\r?\n([\s\S]*?)```/g;

  const updatedBody = body.replace(regex, (match, lang, attrs, code) => {
    // If it's already a twoslash block, or has opt-outs, skip
    if (attrs.includes("twoslash") || code.includes("no-twoslash") || code.includes("no-inject") || code.includes("no-inject-imports")) {
      return match;
    }

    // Check if the block contains an import or export from "effect" or "@effect/..."
    const hasEffectImport = /(?:import|export)\s+[\s\S]*?\s+from\s+['"](?:effect|@effect\/)/.test(code) ||
                            /import\s+['"](?:effect|@effect\/)/.test(code);

    if (hasEffectImport) {
      if (hasForbiddenImportsForTwoslash(code)) {
        return match;
      }

      modified = true;
      const trimmedAttrs = attrs.trim();
      if (trimmedAttrs === "") {
        return `\`\`\`${lang} twoslash\n${code}\`\`\``;
      } else {
        return `\`\`\`${lang} twoslash${attrs}\n${code}\`\`\``;
      }
    }

    return match;
  });

  return { updatedBody, modified };
}


// ---------------------------------------------------------
// 2.7. Expressive Code Title Promoter
// ---------------------------------------------------------
/**
 * Finds code blocks where the first line is `// filename.ext` and moves
 * the filename into a `title="filename.ext"` attribute on the opening fence.
 * This is an autofix — the matching lint is scripts/lint-ec-titles.mjs.
 */
const EC_FILENAME_RE = /^([\w./-]+\.[a-z]{1,5})$/;

export function promoteFileCommentToTitle(body: string): { updatedBody: string, modified: boolean } {
  let modified = false;
  // Match fenced TS/JS code blocks with optional indentation
  const regex = /(^[ \t]*)(```(?:typescript|ts|javascript|js))([ \t]*)\r?\n(\1[ \t]*\/\/\s+(.+))\r?\n/gm;

  const updatedBody = body.replace(regex, (match, indent, fence, trailingSpace, commentLine, rawFilename) => {
    const filename = rawFilename.trim();
    // Must look like a filename (has extension, no spaces, no parens)
    if (!EC_FILENAME_RE.test(filename)) return match;
    // Skip if already has title= (shouldn't happen but safety)
    if (fence.includes('title=')) return match;
    // Skip twoslash
    if (trailingSpace.includes('twoslash')) return match;

    modified = true;
    return `${indent}${fence} title="${filename}"\n`;
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

  // 7. Table lines (any line containing '|')
  const tableRe = /^.*\|.*$/gm;
  while ((match = tableRe.exec(body)) !== null) {
    blankRange(match.index, match.index + match[0].length);
  }

  return mask.join("");
}

interface Concept {
  slug: string;
  area: string;
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
      
      // Derive area from slug (first path segment)
      const area = note.slug.split("/")[0] || "";
      
      terms.sort((a, b) => b.length - a.length);
      return { slug: note.slug, area, terms };
    })
    .sort((a, b) => {
      const aMax = a.terms[0] ? a.terms[0].length : 0;
      const bMax = b.terms[0] ? b.terms[0].length : 0;
      return bMax - aMax;
    });
}

export function fixFirstMentionWikilinks(
  body: string,
  currentSlug: string,
  concepts: Concept[]
): { updatedBody: string, modified: boolean } {
  // Derive the current file's area from its slug
  const currentArea = currentSlug.split("/")[0] || "";
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
    
    // Cross-area guard: in a different area, only allow multi-word terms.
    // Single-word terms like "HTTP", "state", "stream" are too generic to
    // link cross-area — they mean different things in different areas.
    const isCrossArea = concept.area !== currentArea;

    // Find all matches for all terms
    const matches: { index: number; length: number; term: string }[] = [];
    for (const term of concept.terms) {
      // Cross-area guard: skip ALL single-word terms from other areas
      if (isCrossArea && !term.includes(" ")) continue;
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

  // 1.5. Convert Effect Blocks to Twoslash
  const twoslashResult = convertEffectBlocksToTwoslash(currentBody);
  if (twoslashResult.modified) {
    console.log(`  ${green}✓ Converted Effect code blocks to Twoslash.${reset}`);
    currentBody = twoslashResult.updatedBody;
    fileModified = true;
  }

  // 1.7. Expressive Code Title Promoter
  const ecResult = promoteFileCommentToTitle(currentBody);
  if (ecResult.modified) {
    console.log(`  ${green}✓ Promoted // filename comments to title= annotations.${reset}`);
    currentBody = ecResult.updatedBody;
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
const isMain = process.argv[1] && (
  path.resolve(process.argv[1]) === path.resolve(__filename) ||
  path.resolve(process.argv[1]).replace(/\.[jt]s$/, "") === path.resolve(__filename).replace(/\.[jt]s$/, "")
);

if (isMain) {
  main();
}

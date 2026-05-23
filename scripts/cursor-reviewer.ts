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

interface Gotcha {
  title: string;
  type: string;
  lineText: string;
  file: string;
  line: number;
}

interface Note {
  title: string;
  slug: string;
  absolutePath: string;
  aliases: string[];
  keywords: string[];
  gotchas: Gotcha[];
}

const docsDir = path.resolve(__dirname, "../sites/docs/src/content/docs");

// Simple frontmatter parser
function parseFrontmatter(content: string): { title: string; aliases: string[] } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { title: "", aliases: [] };
  
  const yaml = match[1];
  let title = "";
  let aliases: string[] = [];
  
  const titleMatch = yaml.match(/^title:\s*(.*)$/m);
  if (titleMatch) title = titleMatch[1].replace(/['"]/g, "").trim();
  
  const aliasesMatch = yaml.match(/^aliases:\s*\[(.*?)\]$/m);
  if (aliasesMatch) {
    aliases = aliasesMatch[1].split(",").map(a => a.replace(/['"]/g, "").trim()).filter(Boolean);
  }
  
  return { title, aliases };
}

// Build index of all evergreen notes
function buildSemanticIndex(): Note[] {
  const index: Note[] = [];
  
  function scan(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
        const content = fs.readFileSync(fullPath, "utf-8");
        const { title, aliases } = parseFrontmatter(content);
        if (!title) continue;
        
        const slug = path.relative(docsDir, fullPath).replace(/\.mdx$/, "");
        
        // Extract headings as keywords
        const keywords: string[] = [];
        const headingMatches = content.matchAll(/^##{1,3}\s*(.*)$/gm);
        for (const hm of headingMatches) {
          keywords.push(hm[1].replace(/['"]/g, "").trim().toLowerCase());
        }
        
        // Extract Gotchas (<Aside type="caution" ...> or <Aside type="danger" ...>)
        const gotchas: Gotcha[] = [];
        const lines = content.split("\n");
        let insideAside = false;
        let asideType = "";
        let asideTitle = "";
        let asideStartLine = 0;
        let asideTextAccumulator: string[] = [];
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const asideMatch = line.match(/<Aside\s+type=["'](caution|danger)["'](?:\s+title=["'](.*?)["'])?/);
          if (asideMatch) {
            insideAside = true;
            asideType = asideMatch[1];
            asideTitle = asideMatch[2] || "Gotcha";
            asideStartLine = i + 1;
            asideTextAccumulator = [];
            continue;
          }
          
          if (insideAside && line.includes("</Aside>")) {
            insideAside = false;
            gotchas.push({
              title: asideTitle,
              type: asideType,
              lineText: asideTextAccumulator.join(" ").slice(0, 120) + "...",
              file: fullPath,
              line: asideStartLine
            });
            continue;
          }
          
          if (insideAside) {
            asideTextAccumulator.push(line.trim());
          }
        }
        
        index.push({
          title,
          slug,
          absolutePath: fullPath,
          aliases,
          keywords,
          gotchas
        });
      }
    }
  }
  
  if (fs.existsSync(docsDir)) {
    scan(docsDir);
  }
  return index;
}

// Find matches between target file content and the KB index
function reviewFile(targetPath: string, index: Note[]) {
  if (!fs.existsSync(targetPath)) {
    console.log(`${red}Error: Target file not found: ${targetPath}${reset}`);
    return;
  }
  
  const content = fs.readFileSync(targetPath, "utf-8");
  const matchedNotes = new Set<Note>();
  const matchedGotchas: Gotcha[] = [];
  
  // Clean comments from target content for token matching
  const cleanContent = content.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "");
  
  for (const note of index) {
    let matched = false;
    
    // 1. Match title/aliases
    const names = [note.title, ...note.aliases];
    for (const name of names) {
      if (!name) continue;
      // Exact word boundary matching for tags or names
      const esc = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(`\\b${esc}\\b`, "i");
      if (regex.test(cleanContent)) {
        matchedNotes.add(note);
        matched = true;
      }
    }
    
    // 2. Match technology keywords
    const slugParts = note.slug.toLowerCase().split("/");
    for (const part of slugParts) {
      if (part === "index" || part.length < 3) continue;
      const regex = new RegExp(`\\b${part}\\b`, "i");
      if (regex.test(cleanContent)) {
        matchedNotes.add(note);
        matched = true;
      }
    }
    
    // 3. Match gotcha triggers if the note itself is active
    if (matched) {
      matchedGotchas.push(...note.gotchas);
    }
  }
  
  // Render report
  console.clear();
  console.log(`\n${bold}${cyan}========================================================================${reset}`);
  console.log(`${bold}${cyan}    CURSOR LIVING MOC REVIEWER — ACTIVE ARCHITECTURAL INSIGHTS${reset}`);
  console.log(`${bold}${cyan}========================================================================${reset}`);
  console.log(`${gray}Active Target:${reset} ${targetPath}\n`);
  
  if (matchedNotes.size === 0) {
    console.log(`  ${gray}No direct KB recipe matches found for this file. Keep coding!${reset}\n`);
    return;
  }
  
  console.log(`${bold}${green}🎓 MATCHED EVERGREEN RECIPES & CONCEPTS:${reset}`);
  for (const note of matchedNotes) {
    const relativeLink = `/knowledge-base/${note.slug}/`;
    const absoluteLink = `file://${note.absolutePath}`;
    console.log(`  • ${bold}${note.title}${reset} (${cyan}${note.slug}${reset})`);
    console.log(`    ${gray}Doc Link:   ${reset}${relativeLink}`);
    console.log(`    ${gray}Local Path: ${reset}${absoluteLink}\n`);
  }
  
  if (matchedGotchas.length > 0) {
    console.log(`${bold}${yellow}⚠️ RELEVANT ARCHITECTURAL GOTCHAS & WARNINGS:${reset}`);
    for (const gotcha of matchedGotchas) {
      const typeLabel = gotcha.type === "danger" ? `${red}[DANGER]${reset}` : `${yellow}[WARNING]${reset}`;
      console.log(`  • ${typeLabel} ${bold}${gotcha.title}${reset}`);
      console.log(`    ${gotcha.lineText}`);
      console.log(`    ${gray}Trigger Source: file://${gotcha.file}#L${gotcha.line}${reset}\n`);
    }
  }
}

// Watch mode helper
function watchTarget(targetPath: string, index: Note[]) {
  console.log(`${bold}${green}Starting Living MOC Watcher on: ${targetPath}...${reset}`);
  reviewFile(targetPath, index);
  
  let fsTimeout: NodeJS.Timeout | null = null;
  fs.watch(targetPath, (event) => {
    if (event === "change") {
      if (fsTimeout) return;
      fsTimeout = setTimeout(() => {
        fsTimeout = null;
        reviewFile(targetPath, index);
      }, 100);
    }
  });
}

// CLI Entrypoint
function main() {
  const args = process.argv.slice(2);
  const target = args[0];
  const watchMode = args.includes("--watch") || args.includes("-w");
  
  if (!target) {
    console.log(`\n${bold}${red}Error: No target file specified!${reset}`);
    console.log(`Usage: bun run scripts/cursor-reviewer.ts <target_file_path> [--watch]\n`);
    process.exit(1);
  }
  
  const targetPath = path.resolve(process.cwd(), target);
  
  console.log(`${gray}Scanning knowledge base...${reset}`);
  const index = buildSemanticIndex();
  console.log(`${green}Indexed ${index.length} evergreen pages successfully.${reset}`);
  
  if (watchMode) {
    watchTarget(targetPath, index);
  } else {
    reviewFile(targetPath, index);
  }
}

main();

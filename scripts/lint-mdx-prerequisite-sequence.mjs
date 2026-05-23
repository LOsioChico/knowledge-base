#!/usr/bin/env node

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DOCS_ROOT = join(REPO_ROOT, "sites/docs/src/content/docs");

/**
 * Recursively walks a directory and gathers all index.mdx files.
 */
function gatherIndexFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      gatherIndexFiles(fullPath, files);
    } else if (stat.isFile() && entry === "index.mdx") {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Parses nodes and edges from a Mermaid flowchart inside the MOC index file content.
 */
function parseMermaidGraph(indexContent, folderSlug) {
  // Locate a Mermaid code fence containing flowchart instructions
  const mermaidRegex = /```mermaid[\s\S]*?flowchart\s+(?:TD|TB|LR|RL)[\s\S]*?\n([\s\S]+?)```/i;
  const match = mermaidRegex.exec(indexContent);
  if (!match) return null;

  const body = match[1];
  const nodes = new Map(); // id -> slug
  const edges = []; // { source, target }

  // Regex to match: NodeID["Label [[folder/sub-slug|Display Name]]"]
  // Matches both double and single quotes inside brackets
  const nodeRegex = /(\w+)\s*\[\s*["'](?:.*?)\[\[([^|\]"']+)(?:\|[^\]"']*)?\]\](?:.*?)["']\s*\]/g;
  let nodeMatch;
  while ((nodeMatch = nodeRegex.exec(body)) !== null) {
    const id = nodeMatch[1];
    let slug = nodeMatch[2].trim();
    // Strip leading slash if any
    if (slug.startsWith("/")) slug = slug.slice(1);
    nodes.set(id, slug);
  }

  // Regex to match directed edges: ID1 --> ID2
  const edgeRegex = /(\w+)\s*-->\s*(\w+)/g;
  let edgeMatch;
  while ((edgeMatch = edgeRegex.exec(body)) !== null) {
    edges.push({
      source: edgeMatch[1],
      target: edgeMatch[2],
    });
  }

  if (nodes.size === 0) return null;

  return { nodes, edges };
}

/**
 * Extracts wikilinks declared in a note's prerequisite aside or tagline.
 */
function extractPrerequisites(fileContent) {
  const prereqs = new Set();

  // 1. Check for Starlight <Aside type="tip" title="Prerequisites">...</Aside> block
  const asideRegex = /<Aside\s+[^>]*type=["']tip["']\s+[^>]*title=["']Prerequisites["'][^>]*>([\s\S]+?)<\/Aside>/i;
  const asideMatch = asideRegex.exec(fileContent);
  if (asideMatch) {
    const blockContent = asideMatch[1];
    const wikilinkRegex = /\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g;
    let match;
    while ((match = wikilinkRegex.exec(blockContent)) !== null) {
      prereqs.add(match[1].trim());
    }
  }

  // 2. Check for tagline-integrated tagline prerequisite: "> ... Prerequisite: [[slug|label]]"
  const taglineRegex = />\s*[\s\S]*?Prerequisite(?:s)?:\s*([\s\S]+?)(?:\n\n|\n[^>]|$)/i;
  const taglineMatch = taglineRegex.exec(fileContent);
  if (taglineMatch) {
    const blockContent = taglineMatch[1];
    const wikilinkRegex = /\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g;
    let match;
    while ((match = wikilinkRegex.exec(blockContent)) !== null) {
      prereqs.add(match[1].trim());
    }
  }

  return prereqs;
}

function main() {
  console.log("========================================================================");
  console.log("    DETERMINISTIC CURRICULUM PROGRESSION LINTER — KNOWLEDGE BASE        ");
  console.log("========================================================================");

  const indexFiles = gatherIndexFiles(DOCS_ROOT);
  let hasErrors = false;
  let checkedCount = 0;
  
  // Set of folders under sites/docs/src/content/docs/ that undergo strict build-blocking enforcement
  const ENFORCED_AREAS = new Set(["system-design"]);

  for (const indexFile of indexFiles) {
    const indexContent = readFileSync(indexFile, "utf8");
    const folderPath = indexFile.slice(DOCS_ROOT.length + 1, -10); // Extract e.g. "system-design"
    const graph = parseMermaidGraph(indexContent, folderPath);

    if (!graph) continue;

    const isEnforced = ENFORCED_AREAS.has(folderPath);
    console.log(`Auditing pathway sequence graph for area: [[${folderPath}]] (${isEnforced ? "STRICT" : "WARNING MODE"})...`);

    // Map targets to their required predecessor slugs
    const dependencyMap = new Map(); // targetSlug -> Set(sourceSlugs)

    for (const edge of graph.edges) {
      const sourceSlug = graph.nodes.get(edge.source);
      const targetSlug = graph.nodes.get(edge.target);

      if (!sourceSlug || !targetSlug) continue;

      if (!dependencyMap.has(targetSlug)) {
        dependencyMap.set(targetSlug, new Set());
      }
      dependencyMap.get(targetSlug).add(sourceSlug);
    }

    // Validate each target note
    for (const [targetSlug, expectedSources] of dependencyMap.entries()) {
      const notePath = join(DOCS_ROOT, `${targetSlug}.mdx`);

      if (!existsSync(notePath)) {
        console.error(`❌ Error: Linked note file "${targetSlug}.mdx" declared in graph does not exist.`);
        if (isEnforced) hasErrors = true;
        continue;
      }

      const noteContent = readFileSync(notePath, "utf8");
      const actualPrereqs = extractPrerequisites(noteContent);
      checkedCount++;

      // Check if at least one expected source is present in actual prerequisites
      let matched = false;
      const expectedList = Array.from(expectedSources);
      for (const expected of expectedList) {
        if (actualPrereqs.has(expected)) {
          matched = true;
          break;
        }
      }

      if (!matched) {
        console.error(`${isEnforced ? "❌ STRICT" : "⚠ WARNING"} Progression Error in [${targetSlug}.mdx]:`);
        console.error(`   According to the sequence flowchart in [[${folderPath}/index.mdx]], this guide`);
        console.error(`   requires mastering its sequential predecessor node:`);
        console.error(`   👉 Expected at least one of: ${expectedList.map(s => `[[${s}]]`).join(", ")}`);
        console.error(`   👉 But found documented prerequisites: ${actualPrereqs.size > 0 ? Array.from(actualPrereqs).map(s => `[[${s}]]`).join(", ") : "None"}`);
        console.error();
        if (isEnforced) {
          hasErrors = true;
        }
      }
    }
  }

  console.log(`Sequence validation complete! Checked ${checkedCount} prerequisite link(s).`);
  console.log("========================================================================");

  if (hasErrors) {
    console.error("❌ Linter failed: Inconsistent curriculum progression path found in strict area(s).");
    process.exit(1);
  } else {
    console.log("✓ Success: All strict prerequisites are deterministically aligned with curriculum graph!");
    process.exit(0);
  }
}

main();

import { mkdir, rm } from "node:fs/promises";
import { join, dirname } from "node:path";

interface GitHubContent {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
}

interface Config {
  sourceRepo: string;
  branch: string;
  remotePath: string;
  localPath: string;
  sync: string[];
}

// 1. Load Configuration
const configPath = join(process.cwd(), ".github", "skills-config.json");
let config: Config;

try {
  const configFile = await Bun.file(configPath).text();
  config = JSON.parse(configFile);
} catch (error) {
  console.error("\x1b[31mError: Could not load .github/skills-config.json\x1b[0m");
  process.exit(1);
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");

// 2. Setup Headers for GitHub API
const headers: Record<string, string> = {
  "User-Agent": "Bun-skills-syncer-client",
  Accept: "application/vnd.github.v3+json",
};

if (GITHUB_TOKEN) {
  headers["Authorization"] = `Bearer ${GITHUB_TOKEN}`;
}

console.log("\x1b[36m========================================================================\x1b[0m");
console.log("\x1b[36m             AGENT SKILLS SYNCHRONIZER (sync-skills.ts)                 \x1b[0m");
console.log("\x1b[36m========================================================================\x1b[0m");
console.log(`Source Repo: \x1b[33m${config.sourceRepo}\x1b[0m (Branch: \x1b[33m${config.branch}\x1b[0m)`);
console.log(`Local Destination: \x1b[33m${config.localPath}\x1b[0m`);
if (dryRun) console.log("\x1b[35m⚠️ DRY RUN MODE ACTIVE — No files will be modified on disk.\x1b[0m");
if (force) console.log("\x1b[35m🔥 FORCE MODE ACTIVE — Local target folders will be cleared before sync.\x1b[0m");
if (!GITHUB_TOKEN) {
  console.log("\x1b[33m⚠️ No GITHUB_TOKEN detected. Fallback to unauthenticated API requests (60 req/hour limit).\x1b[0m");
}
console.log("");

// 3. Recursive Ingest/Sync Function
async function syncItem(remoteItemPath: string, localDestPath: string): Promise<void> {
  const apiUrl = `https://api.github.com/repos/${config.sourceRepo}/contents/${remoteItemPath}?ref=${config.branch}`;
  
  const response = await fetch(apiUrl, { headers });
  
  if (!response.ok) {
    if (response.status === 403 && !GITHUB_TOKEN) {
      throw new Error("GitHub API rate limit exceeded. Set process.env.GITHUB_TOKEN to authenticate.");
    }
    throw new Error(`GitHub API returned status ${response.status} for path ${remoteItemPath}`);
  }

  const data = await response.json();

  // If the path points to a directory, GitHub returns an array of contents
  if (Array.isArray(data)) {
    for (const item of data as GitHubContent[]) {
      const relativePart = item.path.substring(config.remotePath.length + 1);
      const targetLocalPath = join(process.cwd(), config.localPath, relativePart);

      if (item.type === "file") {
        if (!item.download_url) continue;
        console.log(`  \x1b[34m⬇ Fetching file:\x1b[0m ${relativePart}`);

        // Fetch raw file content
        const fileRes = await fetch(item.download_url, { headers });
        if (!fileRes.ok) {
          throw new Error(`Failed to download raw file content from ${item.download_url}`);
        }
        const text = await fileRes.text();

        if (!dryRun) {
          // Ensure directory exists
          await mkdir(dirname(targetLocalPath), { recursive: true });
          await Bun.write(targetLocalPath, text);
          console.log(`    \x1b[32m✓ Saved:\x1b[0m ${relativePart}`);
        } else {
          console.log(`    \x1b[35m[Dry Run] Would save file to:\x1b[0m ${relativePart}`);
        }
      } else if (item.type === "dir") {
        console.log(`  \x1b[36m📁 Traversing subarea:\x1b[0m ${relativePart}`);
        await syncItem(item.path, targetLocalPath);
      }
    }
  } else {
    // If it points to a single file directly
    const item = data as GitHubContent;
    if (item.type === "file" && item.download_url) {
      const relativePart = item.path.substring(config.remotePath.length + 1);
      const targetLocalPath = join(process.cwd(), config.localPath, relativePart);
      
      console.log(`  \x1b[34m⬇ Fetching single file:\x1b[0m ${relativePart}`);
      const fileRes = await fetch(item.download_url, { headers });
      if (!fileRes.ok) {
        throw new Error(`Failed to download raw file content from ${item.download_url}`);
      }
      const text = await fileRes.text();

      if (!dryRun) {
        await mkdir(dirname(targetLocalPath), { recursive: true });
        await Bun.write(targetLocalPath, text);
        console.log(`    \x1b[32m✓ Saved:\x1b[0m ${relativePart}`);
      } else {
        console.log(`    \x1b[35m[Dry Run] Would save file to:\x1b[0m ${relativePart}`);
      }
    }
  }
}

// 4. Main Sync Loop Orchestrator
async function main() {
  let successCount = 0;
  let failCount = 0;

  for (const skillName of config.sync) {
    console.log(`\x1b[1m⚡ Synchronizing Skill:\x1b[0m \x1b[32;1m${skillName}\x1b[0m`);
    
    const remoteSkillPath = `${config.remotePath}/${skillName}`;
    const localSkillPath = join(process.cwd(), config.localPath, skillName);

    try {
      if (force && !dryRun) {
        console.log(`  \x1b[31m🧹 Cleaning folder:\x1b[0m ${config.localPath}/${skillName}`);
        await rm(localSkillPath, { recursive: true, force: true });
      }

      await syncItem(remoteSkillPath, localSkillPath);
      console.log(`\x1b[32m✓ Completed Sync for:\x1b[0m ${skillName}\n`);
      successCount++;
    } catch (error) {
      console.error(`\x1b[31m✗ Failed to Sync:\x1b[0m ${skillName}`);
      console.error(`  \x1b[31mReason:\x1b[0m ${error instanceof Error ? error.message : String(error)}\n`);
      failCount++;
    }
  }

  console.log("\x1b[36m========================================================================\x1b[0m");
  console.log("                  SYNCHRONIZATION RUN SUMMARY                           ");
  console.log("\x1b[36m========================================================================\x1b[0m");
  console.log(`Total Skills Sync Checked: ${config.sync.length}`);
  console.log(`  \x1b[32mSuccess:\x1b[0m ${successCount}`);
  console.log(`  \x1b[31mFailure:\x1b[0m ${failCount}`);
  console.log("\x1b[36m========================================================================\x1b[0m");
}

await main();

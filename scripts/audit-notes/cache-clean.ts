// Cache pruning: deletes entries under `.cache/sources/` older than 60 days.
//
// The source-verify cache refetches lazily after 30 days but never reclaims
// disk: stale entries accumulate forever. Run this periodically (or wire into
// a cron) to keep the cache bounded.
//
// Usage:
//   yarn cache:clean              # delete entries older than 60 days
//   yarn cache:clean --days 30    # custom TTL
//   yarn cache:clean --dry-run    # report what would be deleted, don't delete

import { readdirSync, statSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT: string = resolve(
  fileURLToPath(new URL("../..", import.meta.url)),
);
const CACHE_DIR: string = resolve(
  REPO_ROOT,
  "scripts/audit-notes/.cache/sources",
);
const DEFAULT_DAYS = 60;

function parseDays(): number {
  const idx: number = process.argv.indexOf("--days");
  if (idx === -1) return DEFAULT_DAYS;
  const raw: string | undefined = process.argv[idx + 1];
  const n: number = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    console.error(`error: --days requires a positive number, got: ${raw}`);
    process.exit(2);
  }
  return n;
}

function main(): void {
  const days: number = parseDays();
  const dryRun: boolean = process.argv.includes("--dry-run");
  const cutoff: number = Date.now() - days * 24 * 60 * 60 * 1000;

  let entries: string[];
  try {
    entries = readdirSync(CACHE_DIR);
  } catch {
    console.log(`[cache:clean] no cache directory at ${CACHE_DIR}; nothing to do`);
    return;
  }

  let deleted = 0;
  let kept = 0;
  let bytes = 0;
  for (const name of entries) {
    const path: string = resolve(CACHE_DIR, name);
    let mtimeMs: number;
    let size: number;
    try {
      const s = statSync(path);
      mtimeMs = s.mtimeMs;
      size = s.size;
    } catch {
      continue;
    }
    if (mtimeMs >= cutoff) {
      kept++;
      continue;
    }
    if (!dryRun) {
      try {
        unlinkSync(path);
      } catch (err: unknown) {
        const msg: string = err instanceof Error ? err.message : String(err);
        console.error(`[cache:clean] failed to delete ${name}: ${msg}`);
        continue;
      }
    }
    deleted++;
    bytes += size;
  }

  const action: string = dryRun ? "would delete" : "deleted";
  const kb: string = (bytes / 1024).toFixed(1);
  console.log(
    `[cache:clean] ${action} ${deleted} entr${deleted === 1 ? "y" : "ies"} (${kb} KB) older than ${days} days; kept ${kept}`,
  );
}

main();

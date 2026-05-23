import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export interface CacheEntry<T> {
  key: string;
  filePath: string;
  passName: string;
  fileHash: string;
  skillHash: string;
  timestamp: number;
  data: T;
}

export function getCacheDir(repoRoot: string): string {
  const dir = resolve(repoRoot, "scripts/audit-notes/.cache/auditor");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function computeHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function readFromCache<T>(
  repoRoot: string,
  passName: string,
  filePath: string,
  fileContent: string,
  skillContent: string
): T | null {
  const fileHash = computeHash(fileContent);
  const skillHash = computeHash(skillContent);
  
  // Use a deterministic key based on the pass, filePath, fileHash, and skillHash.
  const keyInput = `${passName}:${filePath}:${fileHash}:${skillHash}`;
  const key = computeHash(keyInput).slice(0, 24);
  
  const cachePath = resolve(getCacheDir(repoRoot), `${key}.json`);
  if (!existsSync(cachePath)) {
    return null;
  }
  
  try {
    const entry = JSON.parse(readFileSync(cachePath, "utf8")) as CacheEntry<T>;
    if (
      entry.passName === passName &&
      entry.filePath === filePath &&
      entry.fileHash === fileHash &&
      entry.skillHash === skillHash
    ) {
      return entry.data;
    }
  } catch {
    // Ignore error and fall through
  }
  return null;
}

export function writeToCache<T>(
  repoRoot: string,
  passName: string,
  filePath: string,
  fileContent: string,
  skillContent: string,
  data: T
): void {
  const fileHash = computeHash(fileContent);
  const skillHash = computeHash(skillContent);
  
  const keyInput = `${passName}:${filePath}:${fileHash}:${skillHash}`;
  const key = computeHash(keyInput).slice(0, 24);
  
  const cachePath = resolve(getCacheDir(repoRoot), `${key}.json`);
  const entry: CacheEntry<T> = {
    key,
    filePath,
    passName,
    fileHash,
    skillHash,
    timestamp: Date.now(),
    data
  };
  
  writeFileSync(cachePath, JSON.stringify(entry, null, 2), "utf8");
}

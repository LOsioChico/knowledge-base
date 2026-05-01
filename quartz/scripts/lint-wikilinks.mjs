#!/usr/bin/env node

import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { formatHuman, lintVault } from "./lint-wikilinks-core.mjs"

const DEFAULT_REPO = fileURLToPath(new URL("../..", import.meta.url))
const repoRoot = process.env.WIKILINK_LINTER_REPO_ROOT
  ? resolve(process.env.WIKILINK_LINTER_REPO_ROOT)
  : DEFAULT_REPO
const contentRoot = process.env.WIKILINK_LINTER_CONTENT_ROOT
  ? resolve(process.env.WIKILINK_LINTER_CONTENT_ROOT)
  : join(repoRoot, "content")
const json = process.argv.includes("--json")

const result = await lintVault({ contentRoot, repoRoot })

if (json) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} else {
  const output = formatHuman(result)
  if (output.stdout) process.stdout.write(output.stdout)
  if (output.stderr) process.stderr.write(output.stderr)
}

process.exit(result.ok ? 0 : 1)

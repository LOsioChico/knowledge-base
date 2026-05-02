#!/usr/bin/env bash
# Verify every GitHub blob URL in `content/` resolves on raw.githubusercontent.com.
#
# Catches typos like `parse-file-pipe-builder.ts` (real path uses `.builder.ts`)
# that fail silently: the github.com HTML page redirects to a 404 viewer (still
# 200 OK), so a casual click in the browser hides the problem; the audit's
# source-verifier pass quietly skips the URL with no useful signal.
#
# Local-only. Not wired into CI to avoid GitHub's 60 req/hr unauth limit.
# Run on demand after editing `source:` frontmatter or inline citations.
#
# Usage: scripts/check-source-urls.sh [path...]   (defaults to content/)

set -u
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
TARGETS=("${@:-$ROOT/content}")

mapfile -t URLS < <(grep -rohE 'https://github\.com/[^ )"]+\.(ts|tsx|js|jsx|mjs|cjs|json|md|mdx)\b' "${TARGETS[@]}" 2>/dev/null | sort -u)

if [ "${#URLS[@]}" -eq 0 ]; then
  echo "no GitHub blob URLs found"
  exit 0
fi

echo "checking ${#URLS[@]} URLs..."
fail=0
for url in "${URLS[@]}"; do
  raw=${url/github.com/raw.githubusercontent.com}
  raw=${raw/\/blob\//\/}
  status=$(curl -sI --max-time 10 "$raw" -o /dev/null -w '%{http_code}')
  if [ "$status" != "200" ]; then
    echo "  $status  $url"
    fail=$((fail + 1))
  fi
done

if [ "$fail" -gt 0 ]; then
  echo
  echo "$fail broken URL(s)"
  exit 1
fi

echo "all URLs resolve"

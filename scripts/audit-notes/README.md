# audit-notes (spike)

Evaluation script for using the [Cursor TypeScript SDK](https://cursor.com/blog/typescript-sdk)
with **Composer 2** to audit knowledge-base notes against `AGENTS.md`.

The eventual target is a GitHub Actions step that runs on push and reports
violations as PR/check annotations. This script is the smallest thing that
exercises the SDK end-to-end so we can decide before wiring CI.

## Setup

```bash
cd scripts/audit-notes
npm install
export CURSOR_API_KEY=...   # from https://cursor.com/dashboard/integrations
```

## Run

```bash
# audit a single note
npm run audit -- ../../content/nestjs/fundamentals/guards.md

# audit several
npm run audit -- \
  ../../content/nestjs/fundamentals/pipes.md \
  ../../content/nestjs/recipes/file-uploads.md

# no args -> audits a hard-coded sample (smoke test)
npm run audit

# typecheck only
npm run typecheck
```

Script is TypeScript, executed via `tsx`. `tsconfig.json` has `strict` + `noImplicitAny` on; types come from `@cursor/sdk`.

## What it does

1. Spawns a **local** Cursor agent rooted at the repo (so it can read `AGENTS.md` and `content/`).
2. Sends one prompt that lists the target files and the rules to check.
3. Streams assistant text to stdout, tool-call/status lines to stderr.
4. On finish, prints `status` + `duration` so we can ballpark cost/latency.

## Things to evaluate

- **Latency**: composer-2 on a single ~200-line note (target: < ~30s).
- **Signal-to-noise**: does the agent flag real violations or mostly hallucinate?
- **Token cost**: check the usage dashboard after a few runs.
- **Determinism**: run the same file twice; do the findings line up?
- **Tool budget**: does it actually `read` `AGENTS.md` once or thrash on greps?

If the answers look promising, next steps are:
- compute the changed-file list from the push diff
  (`git diff --name-only HEAD^ HEAD -- 'content/**/*.md'`)
- swap the prompt for a stricter "machine-readable JSON output" form
- post results as a check-run via `actions/github-script`

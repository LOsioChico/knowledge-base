---
name: kb-algomaster-intake
description: Extract authorized AlgoMaster system-design course pages into local Markdown for later note planning. Never cite AlgoMaster as primary technical evidence.
---

# kb-algomaster-intake

Use this when the user asks to use AlgoMaster.io material to plan or write system-design notes.

This skill does **not** replace `kb-research-author`. It is a pre-research intake step: fetch or read authorized AlgoMaster content into clean local Markdown, then verify useful claims against primary sources before drafting MDX.

## Safety boundary

- Use only content the user is authorized to access.
- Do not paste, commit, or log cookies, bearer tokens, refresh tokens, or exported paid content.
- Prefer a local environment variable for session cookies:

  ```bash
  export ALGOMASTER_COOKIE='name=value; ...'
  bun run algomaster:intake -- --url https://algomaster.io/learn/system-design/course-introduction
  unset ALGOMASTER_COOKIE
  ```

- If the user pastes a token or cookie into chat, warn them to rotate or invalidate it. Do not replay it from chat.
- Keep generated extracts under `tmp/`; `tmp/` is gitignored.

## Workflow

1. Load `kb-research-author` before authoring any final MDX.
2. Run the intake script on public URLs, authorized URLs, or local HTML/Markdown exports:

   ```bash
   bun run algomaster:intake -- --url https://algomaster.io/learn/system-design/top-30-system-design-concepts
   bun run algomaster:intake -- --input tmp/algomaster/course-introduction.html
   bun run algomaster:intake -- --list tmp/algomaster/urls.txt
   ```

   Or fan out across a whole course by seeding any one lesson page; the script reads the sidebar (`sections[].chapters[]`) and writes every chapter into per-section directories with course/section indexes:

   ```bash
   bun run algomaster:intake -- --course https://algomaster.io/learn/system-design/course-introduction
   # tmp/algomaster-intake/<course-slug>/<NN>-<section-id>/<MM>-<chapter-slug>.md
   # plus _index.md at course root and per section
   ```

   Course-mode flags: `--free-only` (skip premium chapters), `--force` (refetch existing), `--limit N` (test on a slice), `--delay-ms <ms>` (politeness between requests, default 250), `--course-out <dir>` (override output root). Reruns resume by skipping already-written files unless `--force`.

3. Read the generated `tmp/algomaster-intake/*.md` extract.
4. Convert only useful ideas into a short note spec:
   - target slug and page kind;
   - reader problem;
   - AlgoMaster-inspired topic list;
   - claims requiring primary-source verification;
   - primary sources to fetch.
5. Verify every kept claim against official docs, specs, or source code.
6. Draft canonical MDX under `sites/docs/src/content/docs/` only after verification.
7. Credit AlgoMaster only as optional further reading when its framing shaped the note. Do not use it as the source citation for technical claims.

## What the script extracts

`scripts/algomaster-intake.mjs` fetches HTML or reads local exports and writes a clean Markdown extract:

- `# Title` from the lesson title;
- readable lesson paragraphs, callouts, code fences, and Mermaid diagrams (preferring the canonical Markdown payload AlgoMaster ships in React Flight chunks, falling back to rich-text reconstruction);
- a `## Images` section when extractable lesson images are present;
- in `--course` mode, a course `_index.md` listing every section and a per-section `_index.md` listing every chapter.

The sidebar payload (`title`, `sections[]`, `chapters[]` with `link` and `isPremium`) lives in one decoded `self.__next_f.push([1, "…"])` chunk; the script reads it via a bracket-balanced JSON slice rather than a brittle regex.

## Anti-patterns

- Writing final prose directly from AlgoMaster wording.
- Treating course explanations as primary sources.
- Committing generated extracts.
- Building an MCP server before the repo proves this workflow needs reusable live tools.
- Running large authenticated crawls. Keep intake narrow: one lesson or one small URL list per note spec.

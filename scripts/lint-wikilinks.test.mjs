import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import test from "node:test"

const execFileAsync = promisify(execFile)
const scriptPath = fileURLToPath(new URL("./lint-wikilinks.mjs", import.meta.url))

async function createFixture(files) {
  const repoRoot = await mkdtemp(join(tmpdir(), "wikilink-linter-"))
  const allFiles = {
    "AGENTS.md": "agent contract\n",
    ".github/copilot-instructions.md": "agent contract\n",
    ...files,
  }

  for (const [relativePath, content] of Object.entries(allFiles)) {
    const absolutePath = join(repoRoot, relativePath)
    await mkdir(dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, content)
  }

  return repoRoot
}

async function runLinter(repoRoot, args = []) {
  try {
    const result = await execFileAsync(process.execPath, [scriptPath, ...args], {
      cwd: repoRoot,
      env: {
        ...process.env,
        WIKILINK_LINTER_REPO_ROOT: repoRoot,
      },
    })
    return { code: 0, stdout: result.stdout, stderr: result.stderr }
  } catch (error) {
    return {
      code: error.code,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    }
  }
}

function note({ title, related = "", unrelated = "", body = "A focused example." }) {
  return `---
title: ${title}
aliases: []
tags: [type/concept]
area: nestjs
status: evergreen
related:
${related}${unrelated ? `unrelated:\n${unrelated}` : ""}source: []
---

# ${title}

${body}
`
}

function cleanVault(overrides = {}) {
  return {
    "content/index.md": `---
title: Home
aliases: []
tags: [type/moc]
status: evergreen
related:
---

# Home

- [[nestjs/index]]
`,
    "content/nestjs/index.md": `---
title: NestJS
aliases: []
tags: [type/moc]
area: nestjs
status: evergreen
related:
---

# NestJS

- [[nestjs/recipes/alpha]]
`,
    "content/nestjs/recipes/index.md": `---
title: Recipes
aliases: []
tags: [type/moc]
area: nestjs
status: evergreen
related:
---

# Recipes

- [[nestjs/recipes/alpha]]
`,
    "content/nestjs/recipes/alpha.md": note({ title: "Alpha Recipe" }),
    ...overrides,
  }
}

function recipeVault(recipes) {
  const recipeLinks = Object.keys(recipes)
    .map((slug) => `- [[nestjs/recipes/${slug}]]`)
    .join("\n")

  return {
    "content/index.md": `---
title: Home
aliases: []
tags: [type/moc]
status: evergreen
related:
---

# Home

- [[nestjs/index]]
`,
    "content/nestjs/index.md": `---
title: NestJS
aliases: []
tags: [type/moc]
area: nestjs
status: evergreen
related:
---

# NestJS

${recipeLinks}
`,
    "content/nestjs/recipes/index.md": `---
title: Recipes
aliases: []
tags: [type/moc]
area: nestjs
status: evergreen
related:
---

# Recipes

${recipeLinks}
`,
    ...Object.fromEntries(
      Object.entries(recipes).map(([slug, content]) => [
        `content/nestjs/recipes/${slug}.md`,
        content,
      ]),
    ),
  }
}

test("passes on a clean fixture vault", async () => {
  const repoRoot = await createFixture(cleanVault())
  const result = await runLinter(repoRoot)

  assert.equal(result.code, 0)
  assert.match(result.stdout, /wikilink linter: all first mentions are linked/)
  assert.match(result.stdout, /listing-completeness: all recipes surfaced/)
  assert.match(result.stdout, /related: symmetry: all related: links are bidirectional/)
  assert.match(result.stdout, /discoverability: no unlinked semantic neighbors/)
  assert.match(
    result.stdout,
    /agents-mirror: \.github\/copilot-instructions\.md matches AGENTS\.md/,
  )
  assert.equal(result.stderr, "")
})

test("fails when related frontmatter is asymmetric", async () => {
  const repoRoot = await createFixture(
    cleanVault({
      "content/nestjs/index.md": `---
title: NestJS
aliases: []
tags: [type/moc]
area: nestjs
status: evergreen
related:
---

# NestJS

- [[nestjs/recipes/alpha]]
- [[nestjs/recipes/beta]]
`,
      "content/nestjs/recipes/index.md": `---
title: Recipes
aliases: []
tags: [type/moc]
area: nestjs
status: evergreen
related:
---

# Recipes

- [[nestjs/recipes/alpha]]
- [[nestjs/recipes/beta]]
`,
      "content/nestjs/recipes/alpha.md": note({
        title: "Alpha Recipe",
        related: '  - "[[nestjs/recipes/beta]]"\n',
      }),
      "content/nestjs/recipes/beta.md": note({ title: "Beta Recipe" }),
    }),
  )
  const result = await runLinter(repoRoot)

  assert.equal(result.code, 1)
  assert.match(result.stderr, /related: symmetry: 1 asymmetric link/)
  assert.match(result.stderr, /missing back-reference/)
  assert.match(result.stderr, /\[\[nestjs\/recipes\/alpha\]\]/)
})

test("fails when an indexed recipe is missing from surfaced lists", async () => {
  const repoRoot = await createFixture(
    cleanVault({
      "content/nestjs/index.md": `---
title: NestJS
aliases: []
tags: [type/moc]
area: nestjs
status: evergreen
related:
---

# NestJS
`,
    }),
  )
  const result = await runLinter(repoRoot)

  assert.equal(result.code, 1)
  assert.match(result.stderr, /listing-completeness: 1 missing entry/)
  assert.match(result.stderr, /content\/nestjs\/index\.md/)
})

test("fails when AGENTS.md and Copilot instructions drift", async () => {
  const repoRoot = await createFixture({
    ...cleanVault(),
    ".github/copilot-instructions.md": "different contract\n",
  })
  const result = await runLinter(repoRoot)

  assert.equal(result.code, 1)
  assert.match(result.stderr, /agents-mirror: \.github\/copilot-instructions\.md is out of sync/)
})

test("ignores concepts that appear only in code regions", async () => {
  const repoRoot = await createFixture(
    recipeVault({
      "origin-draft": note({
        title: "Origin Draft",
        body: `The prose stays deliberately unrelated.

Inline code: \`Target Widget\`.

\`\`\`typescript
const label = "Target Widget"
\`\`\``,
      }),
      "target-widget": note({
        title: "Target Widget",
        body: "Storage adapters hold binary payloads.",
      }),
    }),
  )
  const result = await runLinter(repoRoot)

  assert.equal(result.code, 0)
  assert.match(result.stdout, /wikilink linter: all first mentions are linked/)
})

test("fails when discoverability finds an unadjudicated pair", async () => {
  const repoRoot = await createFixture(
    recipeVault({
      "alpha-strategy": note({
        title: "Alpha Strategy",
        body: "Multipart upload validator storage limit payload stream adapter policy.",
      }),
      "beta-strategy": note({
        title: "Beta Strategy",
        body: "Multipart upload validator storage limit payload stream adapter policy.",
      }),
    }),
  )
  const result = await runLinter(repoRoot)

  assert.equal(result.code, 1)
  assert.match(result.stderr, /discoverability: 1 unlinked semantic neighbor pair/)
  assert.match(result.stderr, /\[\[nestjs\/recipes\/alpha-strategy\]\]/)
  assert.match(result.stderr, /\[\[nestjs\/recipes\/beta-strategy\]\]/)
})

test("passes when discoverability is adjudicated with unrelated", async () => {
  const repoRoot = await createFixture(
    recipeVault({
      "alpha-strategy": note({
        title: "Alpha Strategy",
        unrelated: '  - "[[nestjs/recipes/beta-strategy]]"\n',
        body: "Multipart upload validator storage limit payload stream adapter policy.",
      }),
      "beta-strategy": note({
        title: "Beta Strategy",
        body: "Multipart upload validator storage limit payload stream adapter policy.",
      }),
    }),
  )
  const result = await runLinter(repoRoot)

  assert.equal(result.code, 0)
  assert.match(result.stdout, /discoverability: no unlinked semantic neighbors/)
})

test("fails when a plain first mention appears before a later wikilink", async () => {
  const repoRoot = await createFixture(
    recipeVault({
      "origin-draft": note({
        title: "Origin Draft",
        body: "Target Widget appears first as plain prose. Later see [[nestjs/recipes/target-widget|Target Widget]].",
      }),
      "target-widget": note({
        title: "Target Widget",
        body: "Storage adapters hold binary payloads.",
      }),
    }),
  )
  const result = await runLinter(repoRoot)

  assert.equal(result.code, 1)
  assert.match(result.stderr, /first-mention violation/)
  assert.match(result.stderr, /Target Widget/)
})

test("reports first-mention line numbers after frontmatter accurately", async () => {
  const repoRoot = await createFixture(
    recipeVault({
      "origin-draft": note({
        title: "Origin Draft",
        body: "Target Widget appears as plain prose.",
      }),
      "target-widget": note({
        title: "Target Widget",
        body: "Storage adapters hold binary payloads.",
      }),
    }),
  )
  const result = await runLinter(repoRoot)

  assert.equal(result.code, 1)
  assert.match(result.stderr, /L13: "Target Widget"/)
})

test("emits structured JSON output", async () => {
  const repoRoot = await createFixture(cleanVault())
  const result = await runLinter(repoRoot, ["--json"])
  const parsed = JSON.parse(result.stdout)

  assert.equal(result.code, 0)
  assert.equal(parsed.ok, true)
  assert.deepEqual(parsed.violations, [])
  assert.equal(parsed.stats.noteCount, 4)
  assert.equal(result.stderr, "")
})

test("fails when required frontmatter fields are invalid", async () => {
  const repoRoot = await createFixture(
    cleanVault({
      "content/nestjs/recipes/alpha.md": `---
title: Alpha Recipe
aliases: []
tags: [type/unknown]
area: nestjs
status: maybe
related:
source: []
---

# Alpha Recipe

A focused example.
`,
    }),
  )
  const result = await runLinter(repoRoot)

  assert.equal(result.code, 1)
  assert.match(result.stderr, /frontmatter schema/)
  assert.match(result.stderr, /unknown tag/)
  assert.match(result.stderr, /status/)
})

test("parses aliases that contain commas as one concept", async () => {
  const repoRoot = await createFixture(
    recipeVault({
      origin: note({
        title: "Origin Note",
        body: "The comma, alias phrase appears as plain prose.",
      }),
      target: `---
title: Target Note
aliases: ["comma, alias"]
tags: [type/concept]
area: nestjs
status: evergreen
related:
source: []
---

# Target Note

A focused example.
`,
    }),
  )
  const result = await runLinter(repoRoot)

  assert.equal(result.code, 1)
  assert.match(result.stderr, /comma, alias/)
  assert.match(result.stderr, /nestjs\/recipes\/target/)
})

test("fails when related links to the current note", async () => {
  const repoRoot = await createFixture(
    cleanVault({
      "content/nestjs/recipes/alpha.md": note({
        title: "Alpha Recipe",
        related: '  - "[[nestjs/recipes/alpha]]"\n',
      }),
    }),
  )
  const result = await runLinter(repoRoot)

  assert.equal(result.code, 1)
  assert.match(result.stderr, /related.*must not link to the note itself/)
})

test("fails when a body wikilink targets a missing note", async () => {
  const repoRoot = await createFixture(
    cleanVault({
      "content/nestjs/recipes/alpha.md": note({
        title: "Alpha Recipe",
        body: "See [[nestjs/recipes/missing-note]].",
      }),
    }),
  )
  const result = await runLinter(repoRoot)

  assert.equal(result.code, 1)
  assert.match(result.stderr, /wikilink targets/)
  assert.match(result.stderr, /does not resolve/)
})

test("fails when a body wikilink contains a backtick", async () => {
  const repoRoot = await createFixture(
    cleanVault({
      "content/nestjs/recipes/alpha.md": note({
        title: "Alpha Recipe",
        body: "See [[nestjs/recipes/alpha|`AlphaThing`]] for details.",
      }),
    }),
  )
  const result = await runLinter(repoRoot)

  assert.equal(result.code, 1)
  assert.match(result.stderr, /wikilink syntax/)
  assert.match(result.stderr, /backtick/)
})

test("fails when a partial wikilink is ambiguous", async () => {
  const repoRoot = await createFixture({
    "content/index.md": `---
title: Home
aliases: []
tags: [type/moc]
status: evergreen
related:
---

# Home

- [[nestjs/index]]
`,
    "content/nestjs/index.md": `---
title: NestJS
aliases: []
tags: [type/moc]
area: nestjs
status: evergreen
related:
---

# NestJS

- [[nestjs/fundamentals/index]]
- [[nestjs/fundamentals/target]]
- [[nestjs/recipes/origin]]
- [[nestjs/recipes/target]]
`,
    "content/nestjs/fundamentals/index.md": `---
title: Fundamentals
aliases: []
tags: [type/moc]
area: nestjs
status: evergreen
related:
---

# Fundamentals

- [[nestjs/fundamentals/target]]
`,
    "content/nestjs/fundamentals/target.md": note({
      title: "Fundamental Target",
      body: "A unique fundamental note.",
    }),
    "content/nestjs/recipes/index.md": `---
title: Recipes
aliases: []
tags: [type/moc]
area: nestjs
status: evergreen
related:
---

# Recipes

- [[nestjs/recipes/origin]]
- [[nestjs/recipes/target]]
`,
    "content/nestjs/recipes/origin.md": note({
      title: "Origin Note",
      body: "See [[target]].",
    }),
    "content/nestjs/recipes/target.md": note({
      title: "Recipe Target",
      body: "A unique recipe note.",
    }),
  })
  const result = await runLinter(repoRoot)

  assert.equal(result.code, 1)
  assert.match(result.stderr, /wikilink targets/)
  assert.match(result.stderr, /ambiguous/)
  assert.match(result.stderr, /nestjs\/fundamentals\/target/)
  assert.match(result.stderr, /nestjs\/recipes\/target/)
})

test("fails when a non-index note is orphaned", async () => {
  const repoRoot = await createFixture({
    ...cleanVault(),
    "content/nestjs/fundamentals/index.md": `---
title: Fundamentals
aliases: []
tags: [type/moc]
area: nestjs
status: evergreen
related:
---

# Fundamentals
`,
    "content/nestjs/fundamentals/orphan.md": note({
      title: "Orphan Concept",
      body: "A lonely concept with no incoming references.",
    }),
  })
  const result = await runLinter(repoRoot)

  assert.equal(result.code, 1)
  assert.match(result.stderr, /orphans/)
  assert.match(result.stderr, /content\/nestjs\/fundamentals\/orphan\.md/)
})

test("fails when a content folder has no index note", async () => {
  const repoRoot = await createFixture({
    ...cleanVault(),
    "content/nestjs/missing-index/topic.md": note({
      title: "Indexed Topic",
      body: "A topic in a folder with no index.",
    }),
  })
  const result = await runLinter(repoRoot)

  assert.equal(result.code, 1)
  assert.match(result.stderr, /folder-indexes/)
  assert.match(result.stderr, /content\/nestjs\/missing-index/)
})

test("keeps a synthetic 250 note vault under the PR budget", async () => {
  const recipes = Object.fromEntries(
    Array.from({ length: 250 }, (_, index) => {
      const slug = `topic-${String(index).padStart(3, "0")}`
      return [
        slug,
        note({
          title: `Topic ${String(index).padStart(3, "0")}`,
          body: `Distinct token alpha${index} beta${index} gamma${index}.`,
        }),
      ]
    }),
  )
  const repoRoot = await createFixture(recipeVault(recipes))
  const started = performance.now()
  const result = await runLinter(repoRoot)
  const elapsedMs = performance.now() - started

  assert.equal(result.code, 0)
  assert.ok(elapsedMs < 5000, `expected under 5000ms, got ${elapsedMs}ms`)
})

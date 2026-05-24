import assert from "node:assert/strict";
import test from "node:test";
import {
  getFrontmatterAndBody,
  parseRelatedLinks,
  addRelatedLinkToFrontmatter,
  injectImportsIntoCodeBlocks,
  fixFirstMentionWikilinks,
  convertEffectBlocksToTwoslash,
  promoteFileCommentToTitle
} from "./pre-commit-autofix";

test("getFrontmatterAndBody correctly splits frontmatter and body", () => {
  const content = `---
title: Sample Note
related:
  - "[[another-note]]"
---
# Main Heading
Some content here.`;

  const { frontmatterLines, body, hasFrontmatter } = getFrontmatterAndBody(content);
  assert.equal(hasFrontmatter, true);
  assert.deepEqual(frontmatterLines, [
    "title: Sample Note",
    "related:",
    '  - "[[another-note]]"'
  ]);
  assert.equal(body, "# Main Heading\nSome content here.");
});

test("parseRelatedLinks extracts links correctly in bullet format", () => {
  const frontmatterLines = [
    "title: Sample Note",
    "related:",
    '  - "[[another-note]]"',
    '  - "[[third-note]]"',
    "area: nestjs"
  ];

  const { links, startIndex, endIndex, format } = parseRelatedLinks(frontmatterLines);
  assert.equal(format, "bullet");
  assert.equal(startIndex, 1);
  assert.equal(endIndex, 3);
  assert.deepEqual(links, ["[[another-note]]", "[[third-note]]"]);
});

test("parseRelatedLinks extracts links correctly in inline array format", () => {
  const frontmatterLines = [
    "title: Sample Note",
    'related: ["[[another-note]]", "[[third-note]]"]',
    "area: nestjs"
  ];

  const { links, startIndex, endIndex, format } = parseRelatedLinks(frontmatterLines);
  assert.equal(format, "inline");
  assert.equal(startIndex, 1);
  assert.equal(endIndex, 1);
  assert.deepEqual(links, ["[[another-note]]", "[[third-note]]"]);
});

test("addRelatedLinkToFrontmatter appends a new link in bullet format", () => {
  const frontmatterLines = [
    "title: Sample Note",
    "related:",
    '  - "[[another-note]]"'
  ];

  const updated = addRelatedLinkToFrontmatter(frontmatterLines, "[[new-note]]");
  assert.deepEqual(updated, [
    "title: Sample Note",
    "related:",
    '  - "[[another-note]]"',
    '  - "[[new-note]]"'
  ]);
});

test("addRelatedLinkToFrontmatter appends a new link in inline format", () => {
  const frontmatterLines = [
    "title: Sample Note",
    'related: ["[[another-note]]"]'
  ];

  const updated = addRelatedLinkToFrontmatter(frontmatterLines, "[[new-note]]");
  assert.deepEqual(updated, [
    "title: Sample Note",
    'related: ["[[another-note]]", "[[new-note]]"]'
  ]);
});

test("addRelatedLinkToFrontmatter ignores existing duplicate link case-insensitively", () => {
  const frontmatterLines = [
    "title: Sample Note",
    "related:",
    '  - "[[another-note]]"'
  ];

  const updated = addRelatedLinkToFrontmatter(frontmatterLines, "[[ANOTHER-NOTE]]");
  assert.deepEqual(updated, frontmatterLines);
});

test("injectImportsIntoCodeBlocks injects missing NestJS decorators/types", () => {
  const body = `Some introduction text.

\`\`\`ts
@Controller("users")
export class UsersController {
  @Get()
  findAll() {
    return of([]);
  }
}
\`\`\`

Conclusion.`;

  const { updatedBody, modified } = injectImportsIntoCodeBlocks(body);
  assert.equal(modified, true);
  assert.match(updatedBody, /import \{ Controller, Get \} from "@nestjs\/common";/);
  assert.match(updatedBody, /import \{ of \} from "rxjs";/);
});

test("injectImportsIntoCodeBlocks skips injection if imports are already present", () => {
  const body = `\`\`\`ts
import { Controller, Get } from "@nestjs/common";
import { of } from "rxjs";

@Controller("users")
export class UsersController {
  @Get()
  findAll() {
    return of([]);
  }
}
\`\`\``;

  const { modified } = injectImportsIntoCodeBlocks(body);
  assert.equal(modified, false);
});

test("injectImportsIntoCodeBlocks respects no-inject opt-out", () => {
  const body = `\`\`\`ts
// no-inject
@Controller("users")
export class UsersController {}
\`\`\``;

  const { modified } = injectImportsIntoCodeBlocks(body);
  assert.equal(modified, false);
});

test("fixFirstMentionWikilinks converts plain first mention of concepts correctly", () => {
  const body = `This note explains the Nest Request Lifecycle. The request lifecycle is a very powerful pipeline. Request lifecycle enables guards, interceptors, and pipes.`;
  const concepts = [
    {
      slug: "nestjs/fundamentals/request-lifecycle",
      terms: ["Request Lifecycle", "request lifecycle"]
    }
  ];

  const { updatedBody, modified } = fixFirstMentionWikilinks(body, "nestjs/recipes/monorepo", concepts);
  assert.equal(modified, true);
  // Only the first one is linked
  assert.equal(
    updatedBody,
    "This note explains the Nest [[nestjs/fundamentals/request-lifecycle|Request Lifecycle]]. The request lifecycle is a very powerful pipeline. Request lifecycle enables guards, interceptors, and pipes."
  );
});

test("fixFirstMentionWikilinks does not link to the note itself", () => {
  const body = `This is monorepos setup with Turborepo.`;
  const concepts = [
    {
      slug: "nestjs/recipes/monorepo",
      terms: ["monorepos", "monorepo"]
    }
  ];

  const { modified } = fixFirstMentionWikilinks(body, "nestjs/recipes/monorepo", concepts);
  assert.equal(modified, false);
});

test("fixFirstMentionWikilinks does not link inside code fences or existing links", () => {
  const body = `We have already linked [[nestjs/fundamentals/request-lifecycle|Request Lifecycle]].
Also we have inline \`Request Lifecycle\` and a block:
\`\`\`ts
// Request Lifecycle check
\`\`\``;

  const concepts = [
    {
      slug: "nestjs/fundamentals/request-lifecycle",
      terms: ["Request Lifecycle"]
    }
  ];

  const { modified } = fixFirstMentionWikilinks(body, "nestjs/recipes/monorepo", concepts);
  assert.equal(modified, false);
});

test("injectImportsIntoCodeBlocks completely ignores twoslash blocks", () => {
  const body = `\`\`\`ts twoslash
@Controller("users")
export class UsersController {
  @Get()
  findAll() {
    return of([]);
  }
}
\`\`\``;

  const { modified } = injectImportsIntoCodeBlocks(body);
  assert.equal(modified, false);
});

test("fixFirstMentionWikilinks completely ignores markdown table rows", () => {
  const body = `| Heading 1 | Heading 2 |
| --- | --- |
| guards | some other text |`;

  const concepts = [
    {
      slug: "nestjs/fundamentals/guards",
      terms: ["guards"]
    }
  ];

  const { modified } = fixFirstMentionWikilinks(body, "nestjs/recipes/monorepo", concepts);
  assert.equal(modified, false);
});

test("injectImportsIntoCodeBlocks does not inject RxJS imports for keywords inside imports, comments, or string literals", () => {
  const body = `\`\`\`ts
import { AsyncLocalStorage } from "node:async_hooks";
// This is a comment containing of and from
const message = "Hello from NestJS";
\`\`\``;

  const { modified } = injectImportsIntoCodeBlocks(body);
  assert.equal(modified, false);
});

test("injectImportsIntoCodeBlocks does not inject RxJS map, of, or from for native method calls like Array.prototype.map, Array.of, Array.from", () => {
  const body = `\`\`\`ts
const mapped = [1, 2, 3].map(x => x * 2);
const arrayFrom = Array.from("hello");
const arrayOf = Array.of(1, 2, 3);
\`\`\``;

  const { modified } = injectImportsIntoCodeBlocks(body);
  assert.equal(modified, false);
});

test("fixFirstMentionWikilinks prioritizes longer concepts over shorter overlapping ones when sorted by term length", () => {
  const body = "I am studying Nest Request Lifecycle in details.";
  // If we pass concepts sorted by length:
  // "Nest Request Lifecycle" has length 22
  // "Request Lifecycle" has length 17
  const concepts = [
    { slug: "nestjs/fundamentals/request-lifecycle-short", terms: ["Request Lifecycle"] },
    { slug: "nestjs/fundamentals/request-lifecycle-long", terms: ["Nest Request Lifecycle"] }
  ];

  // Sort them like we do in buildConceptCatalog:
  concepts.sort((a, b) => b.terms[0].length - a.terms[0].length);

  const { updatedBody } = fixFirstMentionWikilinks(body, "nestjs/recipes/monorepo", concepts);
  // It should match the longer concept first
  assert.equal(updatedBody, "I am studying [[nestjs/fundamentals/request-lifecycle-long|Nest Request Lifecycle]] in details.");
});

test("convertEffectBlocksToTwoslash adds twoslash attribute to ts/typescript code blocks importing effect", () => {
  const body = `Some intro.

\`\`\`ts
import { Effect } from "effect";
const program = Effect.succeed(42);
\`\`\`

\`\`\`typescript
import { Platform } from "@effect/platform";
\`\`\`

\`\`\`ts {1-5}
import "effect";
\`\`\`
`;

  const { updatedBody, modified } = convertEffectBlocksToTwoslash(body);
  assert.equal(modified, true);
  assert.match(updatedBody, /```ts twoslash\nimport \{ Effect \}/);
  assert.match(updatedBody, /```typescript twoslash\nimport \{ Platform \}/);
  assert.match(updatedBody, /```ts twoslash \{1-5\}\nimport "effect";/);
});

test("convertEffectBlocksToTwoslash ignores code blocks that already have twoslash or do not import effect", () => {
  const body = `Some intro.

\`\`\`ts twoslash
import { Effect } from "effect";
\`\`\`

\`\`\`ts
import { Controller } from "@nestjs/common";
\`\`\`
`;

  const { updatedBody, modified } = convertEffectBlocksToTwoslash(body);
  assert.equal(modified, false);
  assert.equal(updatedBody, body);
});

test("convertEffectBlocksToTwoslash ignores blocks with forbidden imports or explicit no-twoslash opt-out", () => {
  const body = `Some intro.

\`\`\`ts
import { Effect } from "effect";
import { NodeSdk } from "@effect/opentelemetry";
\`\`\`

\`\`\`ts
// no-twoslash
import { Effect } from "effect";
\`\`\`
`;

  const { updatedBody, modified } = convertEffectBlocksToTwoslash(body);
  assert.equal(modified, false);
  assert.equal(updatedBody, body);
});

// ---------------------------------------------------------
// promoteFileCommentToTitle tests
// ---------------------------------------------------------

test("promoteFileCommentToTitle moves // filename.ts to title= on fence", () => {
  const body = `Some intro.

\`\`\`typescript
// app.module.ts
import { Module } from "@nestjs/common";
\`\`\`

Conclusion.`;

  const { updatedBody, modified } = promoteFileCommentToTitle(body);
  assert.equal(modified, true);
  assert.match(updatedBody, /```typescript title="app.module.ts"/);
  // The comment line should be removed
  assert.doesNotMatch(updatedBody, /\/\/ app\.module\.ts/);
});

test("promoteFileCommentToTitle skips blocks that already have title=", () => {
  const body = `\`\`\`typescript title="app.module.ts"
// app.module.ts
import { Module } from "@nestjs/common";
\`\`\``;

  const { modified } = promoteFileCommentToTitle(body);
  assert.equal(modified, false);
});

test("promoteFileCommentToTitle skips non-filename comments like // description text", () => {
  const body = `\`\`\`typescript
// This is a description of the code
import { Module } from "@nestjs/common";
\`\`\``;

  const { modified } = promoteFileCommentToTitle(body);
  assert.equal(modified, false);
});

test("promoteFileCommentToTitle handles indented fences inside Steps/Tabs", () => {
  const body = `<Steps>

1. Step one:

   \`\`\`typescript
   // users.service.ts
   import { Injectable } from "@nestjs/common";
   \`\`\`

</Steps>`;

  const { updatedBody, modified } = promoteFileCommentToTitle(body);
  assert.equal(modified, true);
  assert.match(updatedBody, /```typescript title="users.service.ts"/);
  assert.doesNotMatch(updatedBody, /\/\/ users\.service\.ts/);
});

test("promoteFileCommentToTitle handles path-style filenames like dto/user.dto.ts", () => {
  const body = `\`\`\`typescript
// dto/user.dto.ts
import { IsEmail } from "class-validator";
\`\`\``;

  const { updatedBody, modified } = promoteFileCommentToTitle(body);
  assert.equal(modified, true);
  assert.match(updatedBody, /```typescript title="dto\/user.dto.ts"/);
});

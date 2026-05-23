import assert from "node:assert/strict";
import test from "node:test";
import {
  getFrontmatterAndBody,
  parseRelatedLinks,
  addRelatedLinkToFrontmatter,
  injectImportsIntoCodeBlocks,
  fixFirstMentionWikilinks
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

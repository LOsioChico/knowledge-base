#!/usr/bin/env node
/**
 * add-prerequisites.mjs
 * 
 * Deterministic script that adds `prerequisites:` frontmatter to all content notes.
 * Reads a prerequisite map, then injects the field into each note's YAML frontmatter.
 * 
 * Usage: node scripts/add-prerequisites.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const DOCS_ROOT = 'sites/docs/src/content/docs';
const DRY_RUN = process.argv.includes('--dry-run');

// ═══════════════════════════════════════════════════════════════
// PREREQUISITE MAP
// Key: relative path from DOCS_ROOT (without .mdx)
// Value: array of prerequisite paths (wikilink format, no .mdx)
// ═══════════════════════════════════════════════════════════════

const PREREQUISITES = {
  // ── NestJS Fundamentals ──
  'nestjs/fundamentals/request-lifecycle': [],
  'nestjs/fundamentals/middleware': ['nestjs/fundamentals/request-lifecycle'],
  'nestjs/fundamentals/guards': ['nestjs/fundamentals/middleware'],
  'nestjs/fundamentals/interceptors': ['nestjs/fundamentals/guards'],
  'nestjs/fundamentals/pipes': ['nestjs/fundamentals/interceptors'],
  'nestjs/fundamentals/exception-filters': ['nestjs/fundamentals/pipes'],
  'nestjs/fundamentals/global-providers': [
    'nestjs/fundamentals/guards',
    'nestjs/fundamentals/pipes',
    'nestjs/fundamentals/exception-filters',
  ],
  'nestjs/fundamentals/lifecycle-hooks': ['nestjs/fundamentals/request-lifecycle'],

  // ── NestJS Recipes ──
  'nestjs/recipes/configuration': [],
  'nestjs/recipes/validation': ['nestjs/fundamentals/pipes'],
  'nestjs/recipes/dynamic-modules': ['nestjs/recipes/configuration'],
  'nestjs/recipes/testing': ['nestjs/fundamentals/guards', 'nestjs/fundamentals/pipes'],
  'nestjs/recipes/file-uploads': ['nestjs/fundamentals/interceptors', 'nestjs/fundamentals/pipes'],
  'nestjs/recipes/serialization': ['nestjs/fundamentals/interceptors'],
  'nestjs/recipes/trace-id': ['nestjs/fundamentals/middleware'],
  'nestjs/recipes/rate-limiting': ['nestjs/fundamentals/guards'],
  'nestjs/recipes/swc-setup': [],
  'nestjs/recipes/monorepo': [],

  // ── NestJS Data ──
  'nestjs/data/caching': ['nestjs/fundamentals/interceptors'],
  'nestjs/data/typeorm/postgresql-setup': ['nestjs/recipes/configuration'],
  'nestjs/data/typeorm/handle-database-errors': [
    'nestjs/fundamentals/exception-filters',
    'nestjs/data/typeorm/postgresql-setup',
  ],

  // ── NestJS Auth ──
  'nestjs/auth/jwt-strategy': ['nestjs/fundamentals/guards', 'nestjs/recipes/configuration'],

  // ── NestJS Releases ──
  'nestjs/releases/v10': [],
  'nestjs/releases/v11': [],

  // ── Effect-TS ──
  'effect-ts/what-is-effect': [],
  'effect-ts/quickstart': ['effect-ts/what-is-effect'],
  'effect-ts/composition': ['effect-ts/quickstart'],
  'effect-ts/typed-errors': ['effect-ts/composition'],
  'effect-ts/schema': ['effect-ts/typed-errors'],
  'effect-ts/layers-and-di': ['effect-ts/typed-errors'],
  'effect-ts/retry-and-schedule': ['effect-ts/composition'],
  'effect-ts/scoped-resources': ['effect-ts/layers-and-di'],
  'effect-ts/concurrency': ['effect-ts/composition'],
  'effect-ts/streams': ['effect-ts/concurrency'],
  'effect-ts/state': ['effect-ts/typed-errors'],
  'effect-ts/async-result': ['effect-ts/state'],
  'effect-ts/observability': ['effect-ts/layers-and-di'],
  'effect-ts/platform': ['effect-ts/layers-and-di'],
  'effect-ts/fault-tolerant-ingestion': [
    'effect-ts/streams',
    'effect-ts/scoped-resources',
    'effect-ts/schema',
  ],
  'effect-ts/ecosystem-map': [],
  'effect-ts/layers-vs-nestjs-di': ['effect-ts/layers-and-di'],

  // ── AWS CLI ──
  'aws/cli/profiles-and-credentials': [],
  'aws/cli/query-and-output': ['aws/cli/profiles-and-credentials'],

  // ── AWS S3 ──
  'aws/s3/quickstart': ['aws/cli/profiles-and-credentials'],
  'aws/s3/cli': ['aws/s3/quickstart'],
  'aws/s3/storage-classes': ['aws/s3/quickstart'],
  'aws/s3/lifecycle-rules': ['aws/s3/storage-classes'],
  'aws/s3/event-notifications': ['aws/s3/quickstart'],
  'aws/s3/presigned-urls': ['aws/s3/quickstart'],
  'aws/s3/static-website': ['aws/s3/quickstart'],
  'aws/s3/cross-account-migration': ['aws/s3/quickstart', 'aws/iam/policy-evaluation'],

  // ── AWS IAM ──
  'aws/iam/policy-evaluation': ['aws/cli/profiles-and-credentials'],
  'aws/iam/cli': ['aws/iam/policy-evaluation'],

  // ── AWS RDS ──
  'aws/rds/cli': ['aws/cli/profiles-and-credentials'],
  'aws/rds/cross-account-snapshot': ['aws/rds/cli', 'aws/iam/policy-evaluation'],

  // ── AWS CloudFront ──
  'aws/cloudfront/cli': ['aws/cli/profiles-and-credentials'],
  'aws/cloudfront/alternate-domain-claim': ['aws/cloudfront/cli'],

  // ── AWS Amplify ──
  'aws/amplify/cli': ['aws/cli/profiles-and-credentials'],
  'aws/amplify/cross-account-migration': ['aws/amplify/cli', 'aws/iam/policy-evaluation'],

  // ── AWS KMS ──
  'aws/kms/cli': ['aws/cli/profiles-and-credentials'],

  // ── AWS Lambda ──
  'aws/lambda/quickstart': ['aws/cli/profiles-and-credentials', 'aws/iam/policy-evaluation'],
  'aws/lambda/cli': ['aws/lambda/quickstart'],

  // ── AWS EventBridge ──
  'aws/eventbridge/quickstart': ['aws/cli/profiles-and-credentials'],
  'aws/eventbridge/event-driven-decoupling': ['aws/eventbridge/quickstart', 'aws/sqs/quickstart'],

  // ── AWS SQS ──
  'aws/sqs/quickstart': ['aws/cli/profiles-and-credentials'],

  // ── AWS DynamoDB ──
  'aws/dynamodb/quickstart': ['aws/cli/profiles-and-credentials'],

  // ── AWS EC2 ──
  'aws/ec2/snapshot-all-instances': ['aws/cli/profiles-and-credentials'],
  'aws/ec2/ami-cross-account-copy': ['aws/ec2/snapshot-all-instances', 'aws/iam/policy-evaluation'],

  // ── AWS Top-level ──
  'aws/account-migrations': ['aws/cli/profiles-and-credentials', 'aws/iam/policy-evaluation'],
  'aws/lambda-vs-ec2': [],
  'aws/secrets-manager': ['aws/cli/profiles-and-credentials'],
  'aws/recipes/cross-account-role-pattern': ['aws/iam/policy-evaluation'],

  // ── System Design ──
  'system-design/back-of-the-envelope-estimation': [],
  'system-design/distributed-caching': [],
  'system-design/rate-limiting': [],
  'system-design/consistency-models': [],
  'system-design/logical-clocks': ['system-design/consistency-models'],
  'system-design/consistent-hashing': [],
  'system-design/message-queues': [],
  'system-design/messaging-patterns': ['system-design/message-queues'],
  'system-design/delivery-semantics': ['system-design/message-queues'],
  'system-design/dead-letter-queues': ['system-design/delivery-semantics'],
  'system-design/distributed-transactions': [
    'system-design/consistency-models',
    'system-design/message-queues',
  ],
};

// ═══════════════════════════════════════════════════════════════
// LOGIC
// ═══════════════════════════════════════════════════════════════

function findAllMdx(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...findAllMdx(full));
    } else if (entry.endsWith('.mdx') && entry !== 'index.mdx') {
      results.push(full);
    }
  }
  return results;
}

function addPrerequisites(filePath, prereqs) {
  const content = readFileSync(filePath, 'utf8');

  // Already has prerequisites field?
  if (/^prerequisites:/m.test(content)) {
    return { skipped: true, reason: 'already has prerequisites' };
  }

  // Find the frontmatter boundaries
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    return { skipped: true, reason: 'no frontmatter found' };
  }

  const frontmatter = fmMatch[1];
  const afterFrontmatter = content.slice(fmMatch[0].length);

  // Build the prerequisites YAML
  let prereqYaml;
  if (prereqs.length === 0) {
    prereqYaml = 'prerequisites: []';
  } else {
    const lines = prereqs.map(p => `  - "[[${p}]]"`).join('\n');
    prereqYaml = `prerequisites:\n${lines}`;
  }

  // Insert after `related:` block (or after `source:` or at end of frontmatter)
  let newFrontmatter;

  // Find the best insertion point — after related/unrelated/source blocks
  const lines = frontmatter.split('\n');
  let insertAfterIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^(related|unrelated|source):/.test(line)) {
      // Find end of this block (multi-line YAML list)
      let j = i + 1;
      while (j < lines.length && /^\s+-/.test(lines[j])) {
        j++;
      }
      insertAfterIdx = j - 1;
    }
  }

  if (insertAfterIdx === -1) {
    // No related/source found, insert before the last line
    insertAfterIdx = lines.length - 1;
  }

  // Insert
  lines.splice(insertAfterIdx + 1, 0, prereqYaml);
  newFrontmatter = lines.join('\n');

  const newContent = `---\n${newFrontmatter}\n---${afterFrontmatter}`;

  if (!DRY_RUN) {
    writeFileSync(filePath, newContent, 'utf8');
  }

  return { modified: true, prereqCount: prereqs.length };
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

console.log(`\n${'='.repeat(60)}`);
console.log(`  ADD PREREQUISITES TO FRONTMATTER${DRY_RUN ? ' (DRY RUN)' : ''}`);
console.log(`${'='.repeat(60)}\n`);

const allFiles = findAllMdx(DOCS_ROOT);
let modified = 0;
let skipped = 0;
let unmapped = 0;

for (const filePath of allFiles.sort()) {
  const rel = relative(DOCS_ROOT, filePath).replace(/\.mdx$/, '');

  if (!(rel in PREREQUISITES)) {
    console.log(`  ⚠  UNMAPPED: ${rel}`);
    unmapped++;
    continue;
  }

  const prereqs = PREREQUISITES[rel];
  const result = addPrerequisites(filePath, prereqs);

  if (result.skipped) {
    console.log(`  ⊘  ${rel} (${result.reason})`);
    skipped++;
  } else {
    const label = prereqs.length > 0
      ? `← ${prereqs.map(p => p.split('/').pop()).join(', ')}`
      : '(entry point)';
    console.log(`  ✓  ${rel} ${label}`);
    modified++;
  }
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`  Modified: ${modified} | Skipped: ${skipped} | Unmapped: ${unmapped}`);
console.log(`  Total files: ${allFiles.length}`);
console.log(`  Prereq map entries: ${Object.keys(PREREQUISITES).length}`);
if (unmapped > 0) {
  console.log(`\n  ⚠  ${unmapped} files not in prerequisite map — add them!`);
}
console.log(`${'─'.repeat(60)}\n`);

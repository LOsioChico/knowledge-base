# Curated Prompt Pack v2: AWS Notes

> Working artifact derived from the Dia-generated `kb-agent-prompts-aws.md`, rewritten against the current repo standards.
> Source of truth remains: `AGENTS.md`, `docs/PUBLISHING.md`, and `.github/skills/kb-author/SKILL.md`.
> Use these prompts inside the repo root. Do not treat old deployed content or generated gap lists as authoritative.

---

## How to use this pack

Before any agent starts:

1. Read `AGENTS.md`
2. Read `docs/PUBLISHING.md`
3. Read `.github/skills/kb-author/SKILL.md`
4. Treat `content/` as legacy parity material, not a content source
5. Verify every AWS behavior against primary AWS docs or AWS CLI reference
6. New MDX-only pages are allowed; do not create legacy `content/` stubs for parity

This pack intentionally converts broad write prompts into **spec-first** prompts. AWS pages are high-risk because commands can mutate real accounts and cost money.

Dropped or deferred from the generated pack:

- Deferred: bulk “Common mistakes” tables across every CLI page
- Deferred: graduating an entire service to S3-level depth in one pass
- Deferred: writing all DynamoDB deep dives in one batch
- Kept only as audit: account migration checklist enrichment

---

## Prompt 01 — AWS pending-notes and dependency gap audit

> Tags: `discovery`, `no edits`
> Use first.

```text
Read these files fully before analysis:
- AGENTS.md
- docs/PUBLISHING.md
- .github/skills/kb-author/SKILL.md
- sites/docs/src/content/docs/aws/index.mdx
- every `index.mdx` under sites/docs/src/content/docs/aws/

Then inspect the current AWS MDX tree:
find sites/docs/src/content/docs/aws -name "*.mdx" | sort

Collect every planned or pending topic from AWS service index pages and classify it:
- HIGH: existing AWS pages already depend on this topic, link to it, or repeatedly explain around it
- MEDIUM: common AWS concept a mid-level user needs soon
- LOW: advanced/niche or service-sprawl topic

For each HIGH item, provide:
- proposed MDX path
- page type: service index, quickstart, deep dive, recipe, or reference
- why this is high-value now
- existing pages that should link to it
- primary AWS docs that must be verified before writing
- whether the page needs sidebar/MOC updates as an MDX-only slug

Do not edit files. Output only the report.
```

---

## Prompt 02 — AWS quickstart feasibility audit

> Tags: `discovery`, `no edits`
> Finds hands-on gaps without forcing every service into S3 shape.

```text
Read these files fully before analysis:
- AGENTS.md
- docs/PUBLISHING.md
- .github/skills/kb-author/SKILL.md
- sites/docs/src/content/docs/aws/s3/quickstart.mdx
- all AWS service index pages under sites/docs/src/content/docs/aws/*/index.mdx

Inventory service folders and classify quickstart fit:

| Service | Has quickstart? | Has CLI page? | Current depth | Quickstart feasible? | Why / why not |

Decision rules:
- Quickstart should take a beginner from credentials to the service doing one useful thing in about 10 minutes.
- Skip cross-cutting layers where there is no meaningful primitive to stand up, such as IAM.
- Prefer services with safe create/use/inspect/cleanup loops and clear CLI commands.
- Explicitly call out cost or cleanup risks.

Prioritize the top 5 quickstarts to spec next. Do not write pages.
```

---

## Prompt 03 — Spec Lambda and SQS quickstarts

> Tags: `spec-first`, `quickstarts`
> Likely high-value quickstart candidates, but command safety matters.

```text
Read these files fully before analysis:
- AGENTS.md
- docs/PUBLISHING.md
- .github/skills/kb-author/SKILL.md
- sites/docs/src/content/docs/aws/s3/quickstart.mdx
- sites/docs/src/content/docs/aws/lambda/index.mdx
- sites/docs/src/content/docs/aws/lambda/cli.mdx
- sites/docs/src/content/docs/aws/sqs/index.mdx

Do NOT write the pages yet.

Produce page specs for:
- sites/docs/src/content/docs/aws/lambda/quickstart.mdx
- sites/docs/src/content/docs/aws/sqs/quickstart.mdx

For each spec include:
- reader goal
- exact safe create -> use -> inspect -> clean up flow
- exported variable block
- CLI commands to verify against AWS CLI reference
- expected output snippets to show
- cost and cleanup warnings
- where-to-go-next links
- source-verification checklist
- publish-parity implications

Output specs only.
```

---

## Prompt 04 — Spec IAM policy evaluation deep dive

> Tags: `spec-first`, `high priority`
> Strong candidate because IAM knowledge backs every AWS page.

```text
Read these files fully before analysis:
- AGENTS.md
- docs/PUBLISHING.md
- .github/skills/kb-author/SKILL.md
- sites/docs/src/content/docs/aws/iam/index.mdx
- sites/docs/src/content/docs/aws/iam/cli.mdx
- sites/docs/src/content/docs/aws/recipes/cross-account-role-pattern.mdx
- sites/docs/src/content/docs/aws/kms/index.mdx
- sites/docs/src/content/docs/aws/s3/index.mdx

Do NOT write the page yet.

Produce a page spec for:
sites/docs/src/content/docs/aws/iam/policy-evaluation.mdx

The spec must include:
- page goal and target reader
- why this should be a standalone deep dive
- proposed section outline
- one evaluation-flow diagram plan
- 3 concrete policy examples to verify against AWS docs
- where `simulate-principal-policy` belongs and what it cannot simulate
- cross-links to add from existing pages
- risks of oversimplifying IAM evaluation
- source-verification checklist
- publish-parity implications

Output the spec only.
```

---

## Prompt 05 — Spec DynamoDB first expansion

> Tags: `spec-first`, `service expansion`
> Avoid writing all DynamoDB pages in one batch.

```text
Read these files fully before analysis:
- AGENTS.md
- docs/PUBLISHING.md
- .github/skills/kb-author/SKILL.md
- sites/docs/src/content/docs/aws/dynamodb/index.mdx
- sites/docs/src/content/docs/aws/lambda/index.mdx
- sites/docs/src/content/docs/aws/s3/quickstart.mdx

Do NOT write pages yet.

DynamoDB currently has pending topics. Choose the smallest high-value first batch and produce specs for it.

Consider:
- quickstart.mdx: create table -> put item -> query/get item -> clean up
- conditional-writes.mdx: idempotency and optimistic locking
- single-table-design.mdx: access-pattern modeling
- streams-and-ttl.mdx: event patterns and expiration

Return:
- recommended first page or first two pages only
- why the rest should wait
- proposed outline(s)
- CLI/API examples to verify
- request/response or command-output demos to include
- cross-links
- cleanup/cost risks
- publish-parity implications

Output specs only.
```

---

## Prompt 06 — Account migration playbook revalidation

> Tags: `existing page`, `review-only`
> Useful because the current AWS section has several cross-account recipes.

```text
Read these files fully before analysis:
- AGENTS.md
- docs/PUBLISHING.md
- .github/skills/kb-author/SKILL.md
- sites/docs/src/content/docs/aws/account-migrations.mdx
- sites/docs/src/content/docs/aws/s3/cross-account-migration.mdx
- sites/docs/src/content/docs/aws/rds/cross-account-snapshot.mdx
- sites/docs/src/content/docs/aws/ec2/ami-cross-account-copy.mdx
- sites/docs/src/content/docs/aws/amplify/cross-account-migration.mdx
- sites/docs/src/content/docs/aws/cloudfront/alternate-domain-claim.mdx
- sites/docs/src/content/docs/aws/recipes/cross-account-role-pattern.mdx

Review only. Do not edit.

Check whether `account-migrations.mdx`:
- links every existing cross-account recipe
- makes the operation order clear
- names prerequisites before data movement
- includes rollback/cutover safety guidance
- avoids overpromising services that still lack recipes

Return verdict: KEEP as-is, KEEP after fixes, or REWRITE. Provide smallest fixes with file/section references.
```

---

## Prompt 07 — Reusable AWS page prompt

> Tags: `template`, `reusable`
> Use only after the page topic is approved.

```text
Read these files fully before writing:
- AGENTS.md
- docs/PUBLISHING.md
- .github/skills/kb-author/SKILL.md
- a close sibling page under sites/docs/src/content/docs/aws/

Create or edit:
sites/docs/src/content/docs/aws/{PATH}.mdx

Topic: {TOPIC}

Before writing:
1. Search existing AWS MDX pages for the topic and adjacent AWS service names.
2. Read the relevant AWS official docs and AWS CLI reference.
3. Decide whether this should be a slim index, quickstart, deep dive, recipe, or CLI reference.
4. Confirm the new MDX-only slug needs sidebar/MOC updates.

While writing:
- Do not mutate `content/`; new published work is MDX-only.
- Every command must use exported variables where practical.
- Every bash block needs prose above it explaining why to run it and what to verify.
- Include cleanup for anything that can cost money.
- Prefer exact CLI output snippets over prose-only behavior claims.
- Avoid turning service indexes into long deep dives. Put depth in sibling pages.

After writing:
- Update the nearest AWS MOC/sidebar only if the page is meant to be published now.
- Run `bun run lint:docs` and `bun run docs:build`.
- Run `bun run lint:publish-parity` and report the result separately.
- Do not commit until asked.
```

---
title: AWS CLI query and output
aliases: [aws cli jmespath, aws --query, aws --output]
tags: [type/concept, tech/aws, tech/aws-cli]
area: aws
status: evergreen
source:
  - https://docs.aws.amazon.com/cli/latest/userguide/cli-usage-filter.html
  - https://docs.aws.amazon.com/cli/latest/userguide/cli-usage-output-format.html
  - https://jmespath.org/specification.html
related:
  - "[[aws/cli/index]]"
  - "[[aws/cli/profiles-and-credentials]]"
  - "[[aws/cli/s3]]"
---

> Use `--query` (JMESPath, the JSON query language the AWS CLI ships with) to project just the fields you want and `--output table|json|text` to pick a shape your script or eyeballs can read.

## Why it matters

Most AWS API responses are large nested JSON. Without `--query`, you either pipe through `jq` (extra dependency, fragile escaping in shared snippets) or skim the whole blob. Both [`--query`](https://docs.aws.amazon.com/cli/latest/userguide/cli-usage-filter.html) and [`--output`](https://docs.aws.amazon.com/cli/latest/userguide/cli-usage-output-format.html) ship with the CLI, so a one-liner stays portable.

## : query: JMESPath in a flag

[JMESPath](https://jmespath.org/specification.html) is a path-and-filter expression language. The shapes I use most:

```bash
# Pluck one field (returns scalar)
aws sts get-caller-identity --query Arn --output text

# Project an object with renamed keys
aws cloudfront list-distributions \
  --query 'DistributionList.Items[].{Id:Id,Domain:DomainName,Status:Status}' \
  --output table

# Filter a list and project
aws cloudfront list-distributions \
  --query "DistributionList.Items[?Aliases.Items != null && contains(Aliases.Items, 'app.example.com')].{Id:Id,Domain:DomainName}" \
  --output table

# Drill into a single object's nested field
aws amplify get-domain-association \
  --app-id <APP_ID> --domain-name example.com \
  --query 'domainAssociation.{status:domainStatus,reason:statusReason,verified:subDomains[0].verified}' \
  --output json
```

Patterns worth memorizing:

- `Items[?cond]` filters; `cond` uses `==`, `!=`, `&&`, `||`, `contains(haystack, needle)`, `starts_with`, `length`.
- `[].{a:x,b:y}` projects every element to a renamed object.
- `[0]` indexes; `[-1]` is the last element.
- Backticks (`` ` ``) wrap JSON literals inside the expression: `[?Status==`Active`]`.
- Single quotes around the whole `--query` value in bash; double quotes if you need to interpolate a variable.

## : output: pick a shape

| Output  | When to use                                                                              |
| ------- | ---------------------------------------------------------------------------------------- |
| `json`  | Default; pipe to other tools or save for later parsing.                                  |
| `table` | Human-readable for ad-hoc inspection. Auto-aligns columns from the projected shape.      |
| `text`  | Tab-separated; one row per record. Best for `read` loops and `xargs` in shell pipelines. |
| `yaml`  | Same shape as `json`, fewer braces, easier on eyes. CLI v2 only.                         |

`text` output is the one to reach for when you need a value in a shell variable:

```bash
KEY_ID=$(aws kms create-key \
  --description "..." \
  --query KeyMetadata.KeyId --output text)
```

`json` keeps quotes around strings; `text` does not. `text` also strips field names. **Important:** `text` columns are sorted **alphabetically** by the underlying JSON key names regardless of the order you write them in a `{...}` projection ([source](https://docs.aws.amazon.com/cli/latest/userguide/cli-usage-output-format.html#cli-usage-output-format-text)). To pin column order, use the list-projection syntax `[key1, key2, ...]`:

```bash
# Stable column order: NAME first, RUNTIME second, regardless of underlying key names.
aws lambda list-functions \
  --query 'Functions[].[FunctionName, Runtime, LastModified]' \
  --output text
```

## Combining with : max-items and pagination

The CLI auto-paginates by default. To limit how many records come back from large lists, use `--max-items` (CLI-side cap, transparent to the API) or `--page-size` (per-call page, useful when API throttles on large pages):

```bash
aws lambda list-functions \
  --max-items 5 \
  --query 'Functions[].{Name:FunctionName,Runtime:Runtime,Last:LastModified}' \
  --output table
```

For commands that don't auto-paginate, the response includes a `NextToken` you pass back in `--starting-token`.

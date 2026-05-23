import { fileURLToPath } from "node:url";

import { defineConfig } from "astro/config";
import mermaid from "astro-mermaid";
import starlight from "@astrojs/starlight";
import ecTwoSlash from "expressive-code-twoslash";

import { remarkBacklinks } from "./src/plugins/remark-backlinks.mjs";
import { remarkInternalBaseLinks } from "./src/plugins/remark-internal-base-links.mjs";
import { remarkWikilinks } from "./src/plugins/remark-wikilinks.mjs";
import { rehypeKbLinkClasses } from "./src/plugins/rehype-kb-link-classes.mjs";

const SITE = "https://losiochico.github.io";
const BASE = "/knowledge-base";

const docsRoot = fileURLToPath(new URL("./src/content/docs", import.meta.url));

/** @type {import('@astrojs/starlight').StarlightUserConfig['sidebar']} */
const effectTsSidebar = [
  { label: "Overview", slug: "effect-ts" },
  { label: "Quickstart", slug: "effect-ts/quickstart" },
  { label: "What is Effect", slug: "effect-ts/what-is-effect" },
  { label: "Composition", slug: "effect-ts/composition" },
  { label: "Typed errors", slug: "effect-ts/typed-errors" },
  { label: "Schema", slug: "effect-ts/schema" },
  { label: "Layers and DI", slug: "effect-ts/layers-and-di" },
  { label: "Retry and Schedule", slug: "effect-ts/retry-and-schedule" },
  { label: "Scoped resources", slug: "effect-ts/scoped-resources" },
  { label: "Concurrency", slug: "effect-ts/concurrency" },
  { label: "Streams", slug: "effect-ts/streams" },
  { label: "State coordinates", slug: "effect-ts/state" },
  { label: "Observability", slug: "effect-ts/observability" },
  { label: "Platform layers", slug: "effect-ts/platform" },
  {
    label: "Fault-tolerant ingestion",
    slug: "effect-ts/fault-tolerant-ingestion",
  },
  { label: "Ecosystem map", slug: "effect-ts/ecosystem-map" },
  { label: "Layers vs NestJS DI", slug: "effect-ts/layers-vs-nestjs-di" },
];

/** @type {import('@astrojs/starlight').StarlightUserConfig['sidebar']} */
const nestjsSidebar = [
  { label: "Overview", slug: "nestjs" },
  {
    label: "Fundamentals",
    collapsed: true,
    items: [
      { label: "Fundamentals overview", slug: "nestjs/fundamentals" },
      {
        label: "Request lifecycle",
        slug: "nestjs/fundamentals/request-lifecycle",
      },
      { label: "Middleware", slug: "nestjs/fundamentals/middleware" },
      { label: "Guards", slug: "nestjs/fundamentals/guards" },
      { label: "Interceptors", slug: "nestjs/fundamentals/interceptors" },
      { label: "Pipes", slug: "nestjs/fundamentals/pipes" },
      { label: "Exception filters", slug: "nestjs/fundamentals/exception-filters" },
      { label: "Global enhancers", slug: "nestjs/fundamentals/global-providers" },
      { label: "Lifecycle hooks", slug: "nestjs/fundamentals/lifecycle-hooks" },
    ],
  },
  {
    label: "Recipes",
    collapsed: true,
    items: [
      { label: "Recipes overview", slug: "nestjs/recipes" },
      { label: "Configuration", slug: "nestjs/recipes/configuration" },
      { label: "Validation", slug: "nestjs/recipes/validation" },
      { label: "SWC builder", slug: "nestjs/recipes/swc-setup" },
      { label: "Testing", slug: "nestjs/recipes/testing" },
      { label: "File uploads", slug: "nestjs/recipes/file-uploads" },
      { label: "Serialization", slug: "nestjs/recipes/serialization" },
      { label: "Trace IDs", slug: "nestjs/recipes/trace-id" },
      { label: "Rate limiting", slug: "nestjs/recipes/rate-limiting" },
      { label: "Monorepos", slug: "nestjs/recipes/monorepo" },
      { label: "Dynamic modules", slug: "nestjs/recipes/dynamic-modules" },
    ],
  },
  {
    label: "Data",
    collapsed: true,
    items: [
      { label: "Data overview", slug: "nestjs/data" },
      { label: "Caching", slug: "nestjs/data/caching" },
      { label: "TypeORM overview", slug: "nestjs/data/typeorm" },
      {
        label: "PostgreSQL setup",
        slug: "nestjs/data/typeorm/postgresql-setup",
      },
      {
        label: "Database errors",
        slug: "nestjs/data/typeorm/handle-database-errors",
      },
    ],
  },
  {
    label: "Auth",
    collapsed: true,
    items: [
      { label: "Auth overview", slug: "nestjs/auth" },
      { label: "JWT strategy", slug: "nestjs/auth/jwt-strategy" },
    ],
  },
  {
    label: "Releases",
    collapsed: true,
    items: [
      { label: "Releases overview", slug: "nestjs/releases" },
      { label: "NestJS 11", slug: "nestjs/releases/v11" },
      { label: "NestJS 10", slug: "nestjs/releases/v10" },
    ],
  },
];

/** @type {import('@astrojs/starlight').StarlightUserConfig['sidebar']} */
const awsSidebar = [
  { label: "Overview", slug: "aws" },
  { label: "Account migrations", slug: "aws/account-migrations" },
  { label: "Lambda vs EC2 vs Fargate", slug: "aws/lambda-vs-ec2" },
  { label: "Secrets Manager", slug: "aws/secrets-manager" },
  {
    label: "CLI",
    collapsed: true,
    items: [
      { label: "CLI overview", slug: "aws/cli" },
      { label: "Profiles and credentials", slug: "aws/cli/profiles-and-credentials" },
      { label: "Query and output", slug: "aws/cli/query-and-output" },
    ],
  },
  {
    label: "S3",
    collapsed: true,
    items: [
      { label: "S3 overview", slug: "aws/s3" },
      { label: "Quickstart", slug: "aws/s3/quickstart" },
      { label: "CLI cheatsheet", slug: "aws/s3/cli" },
      { label: "Storage classes", slug: "aws/s3/storage-classes" },
      { label: "Lifecycle rules", slug: "aws/s3/lifecycle-rules" },
      { label: "Event notifications", slug: "aws/s3/event-notifications" },
      { label: "Presigned URLs", slug: "aws/s3/presigned-urls" },
      { label: "Static website", slug: "aws/s3/static-website" },
      { label: "Cross-account migration", slug: "aws/s3/cross-account-migration" },
    ],
  },
  {
    label: "IAM",
    collapsed: true,
    items: [
      { label: "IAM overview", slug: "aws/iam" },
      { label: "Policy evaluation", slug: "aws/iam/policy-evaluation" },
      { label: "IAM CLI", slug: "aws/iam/cli" },
    ],
  },
  {
    label: "RDS",
    collapsed: true,
    items: [
      { label: "RDS overview", slug: "aws/rds" },
      { label: "RDS CLI", slug: "aws/rds/cli" },
      { label: "Cross-account snapshot", slug: "aws/rds/cross-account-snapshot" },
    ],
  },
  {
    label: "CloudFront",
    collapsed: true,
    items: [
      { label: "CloudFront overview", slug: "aws/cloudfront" },
      { label: "CloudFront CLI", slug: "aws/cloudfront/cli" },
      {
        label: "Alternate domain claim",
        slug: "aws/cloudfront/alternate-domain-claim",
      },
    ],
  },
  {
    label: "Amplify",
    collapsed: true,
    items: [
      { label: "Amplify overview", slug: "aws/amplify" },
      { label: "Amplify CLI", slug: "aws/amplify/cli" },
      {
        label: "Cross-account migration",
        slug: "aws/amplify/cross-account-migration",
      },
    ],
  },
  {
    label: "KMS",
    collapsed: true,
    items: [
      { label: "KMS overview", slug: "aws/kms" },
      { label: "KMS CLI", slug: "aws/kms/cli" },
    ],
  },
  {
    label: "Lambda",
    collapsed: true,
    items: [
      { label: "Lambda overview", slug: "aws/lambda" },
      { label: "Lambda CLI", slug: "aws/lambda/cli" },
    ],
  },
  {
    label: "EC2",
    collapsed: true,
    items: [
      { label: "EC2 overview", slug: "aws/ec2" },
      { label: "AMI cross-account copy", slug: "aws/ec2/ami-cross-account-copy" },
      { label: "Snapshot all instances", slug: "aws/ec2/snapshot-all-instances" },
    ],
  },
  {
    label: "EventBridge",
    collapsed: true,
    items: [
      { label: "EventBridge overview", slug: "aws/eventbridge" },
      { label: "Quickstart", slug: "aws/eventbridge/quickstart" },
      {
        label: "Event-driven decoupling",
        slug: "aws/eventbridge/event-driven-decoupling",
      },
    ],
  },
  {
    label: "Other services",
    collapsed: true,
    items: [
      { label: "DynamoDB", slug: "aws/dynamodb" },
      { label: "SQS", slug: "aws/sqs" },
      { label: "SNS", slug: "aws/sns" },
      { label: "VPC", slug: "aws/vpc" },
      { label: "ECS and Fargate", slug: "aws/ecs" },
    ],
  },
  {
    label: "Recipes",
    collapsed: true,
    items: [
      { label: "Recipes overview", slug: "aws/recipes" },
      {
        label: "Cross-account role pattern",
        slug: "aws/recipes/cross-account-role-pattern",
      },
    ],
  },
];

/** @type {import('@astrojs/starlight').StarlightUserConfig['sidebar']} */
const systemDesignSidebar = [
  { label: "Overview", slug: "system-design" },
  { label: "Consistent Hashing", slug: "system-design/consistent-hashing" },
  { label: "Consistency Models", slug: "system-design/consistency-models" },
  { label: "Logical Clocks", slug: "system-design/logical-clocks" },
];

export default defineConfig({
  site: SITE,
  base: BASE,
  markdown: {
    remarkPlugins: [
      remarkWikilinks({ docsRoot, base: BASE }),
      remarkInternalBaseLinks({ base: BASE }),
      remarkBacklinks({ docsRoot, base: BASE }),
    ],
    rehypePlugins: [rehypeKbLinkClasses({ siteOrigin: SITE, basePath: BASE })],
  },
  integrations: [
    // Must run before Starlight so ```mermaid fences become diagrams.
    mermaid({ autoTheme: true }),
    starlight({
      title: "Knowledge Base",
      description: "Personal knowledge base on Starlight: Effect-TS, NestJS, and AWS.",
      favicon: "/favicon.svg",
      expressiveCode: {
        plugins: [ecTwoSlash()],
        themes: ["github-light", "github-dark"],
      },
      customCss: ["./src/styles/twoslash.css", "./src/styles/links.css"],
      editLink: {
        baseUrl: "https://github.com/LOsioChico/knowledge-base/edit/main/sites/docs/",
      },
      sidebar: [
        { label: "Home", link: "/" },
        {
          label: "Effect-TS",
          collapsed: true,
          items: effectTsSidebar,
        },
        {
          label: "NestJS",
          collapsed: true,
          items: nestjsSidebar,
        },
        {
          label: "AWS",
          collapsed: true,
          items: awsSidebar,
        },
        {
          label: "System Design",
          collapsed: true,
          items: systemDesignSidebar,
        },
      ],
    }),
  ],
});

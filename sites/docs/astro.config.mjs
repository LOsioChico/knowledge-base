import { fileURLToPath } from "node:url";

import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import ecTwoSlash from "expressive-code-twoslash";

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
  { label: "Layers and DI", slug: "effect-ts/layers-and-di" },
  { label: "Retry and Schedule", slug: "effect-ts/retry-and-schedule" },
  { label: "Scoped resources", slug: "effect-ts/scoped-resources" },
  {
    label: "Fault-tolerant ingestion",
    slug: "effect-ts/fault-tolerant-ingestion",
  },
  { label: "Ecosystem map", slug: "effect-ts/ecosystem-map" },
  { label: "Layers vs NestJS DI", slug: "effect-ts/layers-vs-nestjs-di" },
];

export default defineConfig({
  site: SITE,
  base: BASE,
  markdown: {
    remarkPlugins: [
      remarkWikilinks({ docsRoot, base: BASE }),
      remarkInternalBaseLinks({ base: BASE }),
    ],
    rehypePlugins: [
      rehypeKbLinkClasses({ siteOrigin: SITE, basePath: BASE }),
    ],
  },
  integrations: [
    starlight({
      title: "Knowledge Base",
      description:
        "Personal knowledge base: Effect-TS on Starlight + Twoslash; other areas migrate from Quartz.",
      expressiveCode: {
        plugins: [ecTwoSlash()],
        themes: ["github-light", "github-dark"],
      },
      customCss: ["./src/styles/twoslash.css", "./src/styles/links.css"],
      editLink: {
        baseUrl:
          "https://github.com/LOsioChico/knowledge-base/edit/main/sites/docs/",
      },
      sidebar: [
        { label: "Home", link: "/" },
        {
          label: "Effect-TS",
          collapsed: false,
          items: effectTsSidebar,
        },
        {
          label: "Other areas (Quartz)",
          items: [
            {
              label: "NestJS",
              link: `${SITE}${BASE}/nestjs/`,
            },
            {
              label: "AWS",
              link: `${SITE}${BASE}/aws/`,
            },
          ],
        },
      ],
    }),
  ],
});

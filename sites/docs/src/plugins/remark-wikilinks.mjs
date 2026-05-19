import wikiLinkPlugin from "remark-wiki-link";

import { collectDocSlugs, resolveWikilinkTarget } from "./doc-slugs.mjs";

/**
 * Remark plugin: `[[slug]]` and `[[slug|label]]` → internal doc links.
 * @param {{ docsRoot: string, base?: string }} options
 */
export function remarkWikilinks({ docsRoot, base = "" }) {
  const slugs = collectDocSlugs(docsRoot);
  const basePath = base.replace(/\/$/, "");

  return [
    wikiLinkPlugin,
    {
      aliasDivider: "|",
      hrefTemplate: (permalink) => {
        if (permalink === "__broken__") return `${basePath}/#wikilink-broken`;
        const path = `/${permalink}/`.replace(/\/{2,}/g, "/");
        return basePath ? `${basePath}${path}` : path;
      },
      pageResolver: (name) => {
        const slug = resolveWikilinkTarget(name, slugs);
        return slug ? [slug] : ["__broken__"];
      },
    },
  ];
}

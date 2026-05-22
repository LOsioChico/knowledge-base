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
        const [slug, anchor] = permalink.split("#");
        const path = `/${slug}/`.replace(/\/{2,}/g, "/");
        const hash = anchor ? `#${anchor}` : "";
        return (basePath ? `${basePath}${path}` : path) + hash;
      },
      pageResolver: (name) => {
        const [target, anchor] = name.split("#");
        const slug = resolveWikilinkTarget(target, slugs);
        return slug ? [slug + (anchor ? `#${anchor}` : "")] : ["__broken__"];
      },
    },
  ];
}

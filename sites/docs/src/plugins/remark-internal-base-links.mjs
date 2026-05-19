import { visit } from "unist-util-visit";

/**
 * Prefix root-relative markdown links with Astro `base` (e.g. /knowledge-base).
 * Wikilinks are handled in remark-wikilinks; plain `/effect-ts/...` links are not.
 *
 * Must return a unified **attacher** (factory), not a bare transformer: MDX/Astro
 * call the plugin function to obtain the tree transformer.
 *
 * @param {{ base?: string }} options
 */
export function remarkInternalBaseLinks(options = {}) {
  const basePath = (options.base ?? "").replace(/\/$/, "");

  return function attacher() {
    return function transformer(tree) {
      if (!basePath) return;

      visit(tree, "link", (node) => {
        const url = node.url;
        if (typeof url !== "string") return;
        if (!url.startsWith("/") || url.startsWith("//")) return;
        if (url === basePath || url.startsWith(`${basePath}/`)) return;
        node.url = `${basePath}${url}`;
      });
    };
  };
}

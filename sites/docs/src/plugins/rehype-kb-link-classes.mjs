import { visit } from "unist-util-visit";

import {
  appendClass,
  isKnowledgeBaseHref,
} from "./kb-link-href.mjs";

/**
 * Classify prose links for visual styling:
 * - `kb-link-internal` — this knowledge base (/knowledge-base/… or GitHub Pages deploy URL)
 * - `kb-link-external` — everything else over http(s) (official docs, GitHub blobs, npm)
 *
 * @param {{ siteOrigin?: string, basePath?: string }} [options]
 */
export function rehypeKbLinkClasses(options = {}) {
  return function attacher() {
    return function transformer(tree) {
      visit(tree, "element", (node) => {
        if (node.tagName !== "a") return;

        const href = node.properties?.href;
        if (typeof href !== "string" || href.startsWith("#")) return;

        if (isKnowledgeBaseHref(href, options)) {
          appendClass(node, "kb-link-internal");
          return;
        }

        if (/^https?:/i.test(href)) {
          appendClass(node, "kb-link-external");
          node.properties.target = "_blank";
          node.properties.rel = ["noopener", "noreferrer"];
        }
      });
    };
  };
}

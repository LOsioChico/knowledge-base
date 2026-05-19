const SITE_ORIGIN = "https://losiochico.github.io";
const BASE_PATH = "/knowledge-base";

/**
 * @param {string} href
 * @param {{ siteOrigin?: string, basePath?: string }} [options]
 */
export function isKnowledgeBaseHref(href, options = {}) {
  const siteOrigin = options.siteOrigin ?? SITE_ORIGIN;
  const basePath = options.basePath ?? BASE_PATH;

  if (!href || href.startsWith("#")) return true;

  if (href.startsWith("/")) {
    return href === basePath || href.startsWith(`${basePath}/`);
  }

  if (href.startsWith("mailto:") || href.startsWith("tel:")) return true;

  try {
    const url = new URL(href);
    if (url.origin === siteOrigin && url.pathname.startsWith(basePath)) {
      return true;
    }
    if (
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      url.pathname.startsWith(basePath)
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

/** @param {import('hast').Element} node @param {string} name */
export function appendClass(node, name) {
  const existing = node.properties?.className;
  /** @type {string[]} */
  let list;
  if (Array.isArray(existing)) {
    list = [...existing];
  } else if (typeof existing === "string") {
    list = existing.split(/\s+/).filter(Boolean);
  } else {
    list = [];
  }
  if (!list.includes(name)) list.push(name);
  node.properties.className = list;
}

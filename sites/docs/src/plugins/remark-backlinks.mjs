import { buildBacklinkIndex, filePathToSlug } from "./build-backlinks.mjs";

/**
 * Append a "## Backlinks" section listing inbound wikilinks / internal links.
 * @param {{ docsRoot: string, base?: string }} options
 */
export function remarkBacklinks({ docsRoot, base = "" }) {
  const index = buildBacklinkIndex(docsRoot, base);
  const basePath = base.replace(/\/$/, "");

  return (tree, file) => {
    const filePath = file.history?.[0];
    if (!filePath) return;

    const slug = filePathToSlug(docsRoot, filePath);
    if (slug === null) return;

    const inbound = index[slug];
    if (!inbound?.length) return;

    tree.children.push({
      type: "heading",
      depth: 2,
      children: [{ type: "text", value: "Backlinks" }],
    });

    tree.children.push({
      type: "list",
      ordered: false,
      spread: false,
      children: inbound.map((fromSlug) => ({
        type: "listItem",
        spread: false,
        children: [
          {
            type: "paragraph",
            children: [
              {
                type: "link",
                url: basePath ? `${basePath}/${fromSlug}/` : `/${fromSlug}/`,
                children: [{ type: "text", value: labelFromSlug(fromSlug) }],
              },
            ],
          },
        ],
      })),
    });
  };
}

/** @param {string} slug */
function labelFromSlug(slug) {
  const last = slug.split("/").pop() ?? slug;
  return last
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

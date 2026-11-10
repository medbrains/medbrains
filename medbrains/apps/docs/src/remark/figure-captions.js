/**
 * Turns a paragraph holding only `![alt](src "caption")` into a <figure> with
 * a <figcaption>, so screenshots carry visible captions. Runs before
 * Docusaurus's own image plugin, which still lazy-loads the image inside.
 */
function figureCaptions() {
  return (tree) => walk(tree);
}

/** Replaces captioned image paragraphs throughout the tree, depth first. */
function walk(node) {
  if (!node.children) return;
  node.children = node.children.map((child) => {
    const only = child.type === "paragraph" && child.children.length === 1 && child.children[0];
    if (only && only.type === "image" && only.title) {
      return figure(only);
    }
    walk(child);
    return child;
  });
}

/** Builds the <figure> node: the image without its title, then the caption. */
function figure(image) {
  const caption = image.title;
  return {
    type: "mdxJsxFlowElement",
    name: "figure",
    attributes: [],
    children: [
      { ...image, title: null },
      {
        type: "mdxJsxFlowElement",
        name: "figcaption",
        attributes: [],
        children: [{ type: "text", value: caption }],
      },
    ],
  };
}

module.exports = figureCaptions;

/**
 * Loads a page's first image eagerly with high priority. It is usually the
 * largest thing on screen, so lazy-loading it delays the page's first paint.
 * Runs after Docusaurus has turned images into <img> elements.
 */
function eagerFirstImage() {
  return (tree) => {
    const img = findImg(tree);
    if (!img) return;
    img.attributes.push(
      { type: "mdxJsxAttribute", name: "loading", value: "eager" },
      { type: "mdxJsxAttribute", name: "fetchPriority", value: "high" },
    );
  };
}

/** The first <img> element in document order, or null. */
function findImg(node) {
  if ((node.type === "mdxJsxTextElement" || node.type === "mdxJsxFlowElement") && node.name === "img") return node;
  for (const child of node.children ?? []) {
    const hit = findImg(child);
    if (hit) return hit;
  }
  return null;
}

module.exports.eagerFirstImage = eagerFirstImage;

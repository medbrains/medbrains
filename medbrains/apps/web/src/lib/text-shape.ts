/**
 * String shaping without backtracking regexes (SonarCloud S8786). Each helper is a linear scan
 * or a split on a single character class, so a long run of separators or brackets typed into a
 * field cannot make the screen stall.
 */

/**
 * The runs of characters `keep` accepts, joined by `sep`: no leading, trailing or doubled
 * separator. `joinRuns("A  b!c", "_", /[a-z0-9]/)` on a lower-cased value gives "a_b_c".
 */
export function joinRuns(value: string, sep: string, keep: RegExp): string {
  const parts: string[] = [];
  let run = "";
  for (const ch of value) {
    if (keep.test(ch)) {
      run += ch;
    } else if (run) {
      parts.push(run);
      run = "";
    }
  }
  if (run) parts.push(run);
  return parts.join(sep);
}

/** `value` without every trailing `ch`: "https://x///" → "https://x". */
export function trimTrailing(value: string, ch: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === ch) end -= 1;
  return value.slice(0, end);
}

/** `value` with each "(…)" span replaced by a space; an unclosed "(" runs to the end. */
export function withoutParenthesised(value: string): string {
  let out = "";
  let depth = 0;
  for (const ch of value) {
    if (ch === "(") {
      if (depth === 0) out += " ";
      depth += 1;
    } else if (ch === ")" && depth > 0) {
      depth -= 1;
    } else if (depth === 0) {
      out += ch;
    }
  }
  return out;
}

/** `value` without one trailing " (…)" suffix: "Cardiology (OPD)" → "Cardiology". */
export function withoutTrailingParenthesised(value: string): string {
  const trimmed = value.trimEnd();
  if (!trimmed.endsWith(")")) return value;
  const open = trimmed.lastIndexOf("(");
  if (open <= 0 || trimmed[open - 1]?.trim() !== "") return value;
  return trimmed.slice(0, open).trimEnd();
}

/** Elements whose start and end separate words, as a browser lays them out. */
const BLOCK_TAGS = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "BR",
  "DD",
  "DIV",
  "DL",
  "DT",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "HR",
  "LI",
  "MAIN",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "TABLE",
  "TD",
  "TH",
  "TR",
  "UL",
]);

/**
 * The visible text of rich-text HTML, whitespace collapsed: what a preview should show. Every
 * text node is read, and a line break or block boundary (a list item, a paragraph) becomes a
 * space, so "<li>Fever</li><li>Cough</li>" previews as "Fever Cough", not "FeverCough".
 */
export function htmlToPlainText(html: string): string {
  const body = new DOMParser().parseFromString(html, "text/html").body;
  const parts: string[] = [];
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.nodeValue ?? "");
      return;
    }
    const block = node instanceof Element && BLOCK_TAGS.has(node.tagName);
    if (block) parts.push(" ");
    for (const child of Array.from(node.childNodes)) walk(child);
    if (block) parts.push(" ");
  };
  walk(body);
  return parts.join("").split(/\s/).filter(Boolean).join(" ");
}

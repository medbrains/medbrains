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

/** The visible text of rich-text HTML, whitespace collapsed: what a preview should show. */
export function htmlToPlainText(html: string): string {
  const body = new DOMParser().parseFromString(html, "text/html").body;
  const text = Array.from(body.childNodes, (node) => node.textContent).join(" ");
  return text.split(/\s/).filter(Boolean).join(" ");
}

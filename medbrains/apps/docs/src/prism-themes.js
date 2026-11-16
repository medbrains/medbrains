// Code-block colours from the website theme tokens (design system "Website theme"), so code
// never sits on Prism's navy default and every token passes WCAG 2.2 AA (4.5:1) on its
// background. scripts/check-contrast.mjs fails the build if one does not.

const light = {
  bg: "#f3f5f9",
  plain: "#0b1220",
  comment: "#5d677a",
  punctuation: "#3c4657",
  keyword: "#0043ce",
  string: "#2f6a39",
  number: "#825500",
  function: "#851b7f",
  tag: "#ba1a1a",
};
const dark = {
  bg: "#1c1f23",
  plain: "#e6e8eb",
  comment: "#a9afb7",
  punctuation: "#c4c9cf",
  keyword: "#78a9ff",
  string: "#96d69a",
  number: "#ffb94e",
  function: "#ffabf0",
  tag: "#ffb4ab",
};

/** One Prism theme from a palette: a background, plain text and seven token colours. */
function makeTheme(c) {
  const rule = (types, color, extra = {}) => ({ types, style: { color, ...extra } });
  return {
    plain: { color: c.plain, backgroundColor: c.bg },
    styles: [
      rule(["comment", "prolog", "doctype", "cdata"], c.comment, { fontStyle: "italic" }),
      rule(["punctuation", "operator"], c.punctuation),
      rule(["keyword", "atrule", "selector", "important"], c.keyword),
      rule(["string", "char", "attr-value", "inserted", "url"], c.string),
      rule(["number", "boolean", "constant", "symbol", "regex", "variable"], c.number),
      rule(["function", "function-variable", "class-name", "builtin"], c.function),
      rule(["tag", "deleted", "property", "attr-name"], c.tag),
    ],
  };
}

module.exports = { light, dark, lightTheme: makeTheme(light), darkTheme: makeTheme(dark) };

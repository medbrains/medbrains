// Arithmetic for integration transforms, without eval. The server's CSP has no
// 'unsafe-eval', so `new Function` threw in production and every arithmetic
// transform quietly returned its expression text instead of a number.

/**
 * Evaluates `+ - * /`, unary minus and parentheses over decimal numbers.
 * Returns null when the text is not exactly such an expression, so the caller
 * can keep the text as it is.
 */
export function evaluateArithmetic(text: string): number | null {
  const tokens = text.match(/\d+(?:\.\d+)?|\S/g) ?? [];
  let pos = 0;

  /** Reads a number, a parenthesised expression or a negated factor. */
  const factor = (): number | null => {
    const token = tokens[pos++];
    if (token === "-") {
      const value = factor();
      return value === null ? null : -value;
    }
    if (token === "(") {
      const value = sum();
      return tokens[pos++] === ")" ? value : null;
    }
    return token !== undefined && /^\d/.test(token) ? Number(token) : null;
  };

  /** Reads factors joined by `*` or `/`. */
  const product = (): number | null => {
    let value = factor();
    while (value !== null && (tokens[pos] === "*" || tokens[pos] === "/")) {
      const op = tokens[pos++];
      const right = factor();
      value = right === null ? null : op === "*" ? value * right : value / right;
    }
    return value;
  };

  /** Reads products joined by `+` or `-`. */
  const sum = (): number | null => {
    let value = product();
    while (value !== null && (tokens[pos] === "+" || tokens[pos] === "-")) {
      const op = tokens[pos++];
      const right = product();
      value = right === null ? null : op === "+" ? value + right : value - right;
    }
    return value;
  };

  const value = sum();
  return pos === tokens.length ? value : null;
}

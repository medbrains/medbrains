let apiBase = "/api";

/** Set the API base URL, without trailing slashes (trimmed by a loop, not a /\/+$/ regex, which is quadratic). */
export function setApiBase(base: string): void {
  let end = base.length;
  while (end > 0 && base[end - 1] === "/") end--;
  apiBase = base.slice(0, end);
}

export function getApiBase(): string {
  return apiBase;
}

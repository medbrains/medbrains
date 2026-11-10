import type { Breadcrumb, ErrorEvent } from "@sentry/react";

/**
 * What the browser strips before an error report leaves the page. Shape only:
 * the server tunnel the report goes through runs every message through the
 * same patient-data redactor as the server's own reports, so the patterns are
 * not copied here. This removes what has no reason to leave at all — form
 * values, query strings, cookies, headers, console output, who the user is.
 */

/** Breadcrumb fields that say what kind of request or navigation it was. */
const KEPT_BREADCRUMB_DATA = new Set(["method", "status_code", "url", "from", "to"]);
/** Typed text, clicked-element selectors and console lines can all hold patient data. */
const DROPPED_CATEGORIES = new Set(["console", "ui.input"]);

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_DIGITS = /\d{4,}/;

/** A URL or path with no query or fragment, and record ids replaced. */
export function scrubUrl(raw: string): string {
  const [withoutQuery = ""] = raw.split(/[?#]/);
  const originEnd = withoutQuery.indexOf("://");
  const pathStart = originEnd === -1 ? 0 : withoutQuery.indexOf("/", originEnd + 3);
  if (pathStart === -1) return withoutQuery;
  const origin = withoutQuery.slice(0, pathStart);
  const path = withoutQuery
    .slice(pathStart)
    .split("/")
    .map((segment) => (UUID_SEGMENT.test(segment) || LONG_DIGITS.test(segment) ? ":id" : segment))
    .join("/");
  return origin + path;
}

export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  if (crumb.category && DROPPED_CATEGORIES.has(crumb.category)) return null;
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(crumb.data ?? {})) {
    if (!KEPT_BREADCRUMB_DATA.has(key)) continue;
    data[key] = typeof value === "string" ? scrubUrl(value) : value;
  }
  // A ui.click message is a CSS selector, which carries the element's text.
  const message = crumb.category?.startsWith("ui.") ? undefined : crumb.message;
  return { ...crumb, message, data };
}

/** The request is reduced to its method and scrubbed URL; the user to an id hash. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const request = event.request
    ? { method: event.request.method, url: event.request.url && scrubUrl(event.request.url) }
    : undefined;
  const user = event.user?.id ? { id: String(event.user.id) } : undefined;
  return { ...event, request, user, extra: undefined };
}

/** The id an error report carries for a user — the same hash the server computes. */
export async function hashUserId(userId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(userId));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

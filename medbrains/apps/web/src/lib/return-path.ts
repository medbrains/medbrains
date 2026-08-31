/**
 * The screen to go back to, when a screen can be reached from more than one.
 *
 * The OPD encounter page is reached from the OPD queue and from camp work.
 * Hardcoding "back" to the OPD queue drops a camp clinician into a different
 * module's list, having lost the camp they were working.
 *
 * The parameter is a path this app navigates to, so it is validated rather
 * than trusted: it must be one absolute in-app path. A value beginning "//"
 * or carrying a scheme is an off-site address wearing a path's clothes, and
 * `navigate()` would follow it.
 */
export function safeReturnPath(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  // Must be rooted, and must not be protocol-relative ("//evil.example").
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  // A backslash is normalised to a slash by some browsers, so "/\evil" is
  // the same trick spelled differently.
  if (raw.startsWith("/\\")) return fallback;
  // Anything carrying a scheme is not a path.
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(raw)) return fallback;
  return raw;
}

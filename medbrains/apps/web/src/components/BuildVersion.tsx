import { Text, Tooltip } from "@mantine/core";

/**
 * Which build is this?
 *
 * Nothing in the app answered that — not the UI, not /api/health, not a
 * footer. It is the first question support asks and the last one anybody
 * could answer, and it matters more here than in most systems: the SPA is
 * cached aggressively, so a browser still running last week's bundle looks
 * exactly like one that is current. "Have you reloaded?" is unanswerable
 * without a version on the screen.
 *
 * The commit is the same identity the deploy fingerprints, so what a
 * clinician reads out on the phone and what terraform printed at deploy time
 * are the same string rather than two schemes that drift apart.
 */
export function BuildVersion() {
  const built = new Date(__APP_BUILT__);
  // Date only in the label — a clinician reading this to support needs the
  // day, not the second. The full timestamp is in the tooltip.
  const builtDay = Number.isNaN(built.getTime())
    ? "unknown"
    : built.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  return (
    <Tooltip
      label={`Built ${Number.isNaN(built.getTime()) ? "unknown" : built.toLocaleString()} · commit ${__APP_COMMIT__}`}
      position="right"
      withArrow
    >
      <Text size="xs" c="dimmed" ff="monospace" style={{ cursor: "default" }}>
        v{__APP_VERSION__} · {__APP_COMMIT__.slice(0, 7)} · {builtDay}
      </Text>
    </Tooltip>
  );
}

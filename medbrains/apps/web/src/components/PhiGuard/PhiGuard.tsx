/**
 * Deterrence and traceability for patient data on screen.
 *
 * # What this does not do
 *
 * **It does not prevent screenshots.** No web API can. The browser exposes no
 * hook for the operating system's screenshot key, and even if it did, a phone
 * pointed at the monitor defeats it. Any component claiming otherwise is
 * security theatre, and theatre is worse than nothing here — it tells a
 * hospital its records are protected when they are not, and they staff and
 * train accordingly.
 *
 * **It does not prevent copying.** `user-select: none` and an `oncopy`
 * handler stop an accidental drag-select. They do not stop devtools, "view
 * source", the print dialog, or a script calling the same API the page calls.
 *
 * # What it actually does
 *
 * Three things that hold up:
 *
 * 1. **Traceability.** A tiled watermark carrying the viewer's name and the
 *    time means a leaked screenshot identifies who took it. This is the only
 *    control on this list that survives a determined person, and it is the one
 *    that changes behaviour — deterrence by attribution rather than by
 *    obstacle.
 * 2. **Friction.** Selection is disabled over patient data, so the casual
 *    copy-paste into WhatsApp needs deliberate effort rather than a reflex.
 * 3. **Evidence.** A copy attempt is reported, so an investigation later has
 *    something to work from. Detected, not blocked — blocking teaches people
 *    to find a way around, while a record teaches nothing until it is needed
 *    and is then decisive.
 *
 * On Android, `FLAG_SECURE` genuinely blocks screenshots and blanks the app
 * switcher. That belongs in the React Native surfaces, not here; see
 * `docs/DLP.md`.
 */

import { Box } from "@mantine/core";
import { useAuthStore } from "@medbrains/stores";
import type { ReactNode } from "react";
import { useCallback, useMemo } from "react";
import styles from "./phi-guard.module.scss";

export interface PhiGuardProps {
  children: ReactNode;
  /**
   * What is being shown, for the copy record — a UHID, an encounter id.
   * Without it an audit entry says somebody copied something, which is not
   * worth storing.
   */
  subject?: string;
  /** Called when the viewer copies. Wire to the audit endpoint. */
  onCopyAttempt?: (details: { subject?: string; length: number }) => void;
  /**
   * Turn the watermark off where it would obstruct clinical reading — a
   * radiology viewer, an ECG trace. Selection blocking and copy reporting
   * stay on.
   */
  watermark?: boolean;
}

export function PhiGuard({ children, subject, onCopyAttempt, watermark = true }: PhiGuardProps) {
  const user = useAuthStore((state) => state.user);

  // Recomputed per render on purpose. A watermark stamped once at mount would
  // show the time the screen opened rather than the time of the screenshot,
  // and the gap can be hours on a ward workstation nobody logged out of.
  const label = useMemo(() => {
    if (!user) return null;
    const when = new Date().toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
    return `${user.full_name || user.username} · ${when}`;
  }, [user]);

  const handleCopy = useCallback(() => {
    const selection = window.getSelection()?.toString() ?? "";
    onCopyAttempt?.({ subject, length: selection.length });
    // Deliberately not `event.preventDefault()`. A clinician copying a UHID
    // into a lab form is doing their job, and breaking that pushes them to
    // retype it — which introduces transcription errors into patient
    // identity, the one place they must not be.
  }, [onCopyAttempt, subject]);

  return (
    <Box className={styles.guard} onCopy={handleCopy} data-phi="true">
      {watermark && label ? (
        <Box
          className={styles.watermark}
          aria-hidden="true"
          // Repeated rather than centred: a single mark is cropped out of a
          // screenshot in seconds.
          style={{ "--phi-label": `"${label}"` } as React.CSSProperties}
        >
          {Array.from({ length: 24 }, (_, index) => (
            // Identical positional decoration with no identity of its own; a
            // generated key would remount all 24 on every render for nothing.
            // biome-ignore lint/suspicious/noArrayIndexKey: positional decoration
            <span key={index} className={styles.mark}>
              {label}
            </span>
          ))}
        </Box>
      ) : null}
      <Box className={styles.content}>{children}</Box>
    </Box>
  );
}

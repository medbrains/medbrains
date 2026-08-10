/**
 * Rules for an unattended self-check-in kiosk.
 *
 * A kiosk differs from every other surface here in one way that matters: the
 * next person to stand in front of it is a stranger. Anything left on screen is
 * shown to them, and to everyone queueing behind.
 */

/**
 * How long a result stays up before the screen clears itself.
 *
 * Long enough to read a token number and photograph the QR; short enough that
 * a patient who walks away does not leave their name, their doctor and their
 * token in front of the lobby.
 */
export const RESULT_TIMEOUT_MS = 45_000;

/** An idle input is cleared too — a half-typed UHID is still an identifier. */
export const IDLE_INPUT_TIMEOUT_MS = 90_000;

export type KioskStage = "waiting" | "checking" | "done" | "failed";

/**
 * Whether the screen currently holds anything about a specific person.
 *
 * Used to decide if a timeout must clear it. `failed` counts: the error text
 * can name the appointment date, which says someone with that code was here.
 */
export function holdsPatientDetail(stage: KioskStage): boolean {
  return stage === "done" || stage === "failed";
}

/**
 * A scan is usable if it is non-empty after trimming.
 *
 * Deliberately permissive about format. Hospital kiosks use HID barcode
 * readers that behave like keyboards, and rejecting an unfamiliar shape here
 * would strand a patient in front of a machine that will not explain itself.
 * The server is the authority on whether the code is real.
 */
export function isScannable(raw: string): boolean {
  return raw.trim().length > 0;
}

/**
 * HID scanners send the payload then a newline. Everything before the first
 * newline is the code; anything after is the reader having fired twice, which
 * happens when a patient waves the sheet across the beam.
 */
export function normaliseScan(raw: string): string {
  return raw.split(/[\r\n]/)[0]?.trim() ?? "";
}

/**
 * What to do with camp data that cannot be decrypted.
 *
 * A camp runs offline. Between the registration desk and the next signal there
 * may be a day's patients sitting in an encrypted outbox on one phone. The
 * per-camp key lives in the device keystore, and it can go missing — an app
 * reinstall, an OS restore, a keychain migration.
 *
 * The store used to handle that by deleting the file during a plain read and
 * returning an empty list. The data was unrecoverable either way, but the
 * volunteer was never told: the app showed an empty outbox, which is what it
 * also shows after a clean sync. Forty registrations and a day's work looked
 * exactly like a successful upload.
 *
 * So the rule is: a read never deletes, and unreadable is a state the app can
 * report rather than a silence.
 */

export type CampDataState =
  | "absent"
  | "readable"
  /** On disk, but the envelope is not ours or is corrupt. */
  | "corrupt"
  /** On disk and well-formed, but the key to open it is gone. */
  | "locked";

export interface CampDataFacts {
  fileExists: boolean;
  envelopeValid: boolean;
  keyPresent: boolean;
}

export function campDataState(facts: CampDataFacts): CampDataState {
  if (!facts.fileExists) {
    return "absent";
  }
  if (!facts.envelopeValid) {
    return "corrupt";
  }
  return facts.keyPresent ? "readable" : "locked";
}

/**
 * Whether the app should tell someone.
 *
 * "absent" is normal — no camp downloaded, or everything synced and cleared.
 * The other two mean records may have been on this device and cannot be read,
 * which somebody has to know before they assume the day uploaded cleanly.
 */
export function needsOperatorAttention(state: CampDataState): boolean {
  return state === "corrupt" || state === "locked";
}

/**
 * Whether a read is allowed to remove the file.
 *
 * Never. Deleting during a read destroys the only evidence that the records
 * existed, and it happens on a code path nobody thinks of as a write. Removal
 * belongs to an explicit wipe the operator asks for.
 */
export function readMayDelete(): false {
  return false;
}

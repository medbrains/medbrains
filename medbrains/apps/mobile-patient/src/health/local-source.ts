/**
 * The local record — what the person keeps on their own phone, with no
 * hospital involved.
 *
 * A JSON file rather than a database on purpose. One person's own
 * medications, goals and observations are small, and the history that could
 * grow without limit (steps, sleep) is explicitly capped below. A database is
 * the right answer when a linked chart or a wearable feed arrives; it is not
 * the right answer for the first version, and adding it now would be a
 * dependency and a migration story bought before either is needed.
 *
 * Stored in the app's private document directory, which the OS sandboxes per
 * app. Not encrypted at rest: everything here is self-entered wellness data.
 * **That changes in phase 2** — a linked chart puts real clinical data on the
 * device and wants either the keystore-backed store or an encrypted database.
 * `SecretStore` is deliberately not used for this: it is for credentials, and
 * its own contract says so.
 */

import { Directory, File, Paths } from "expo-file-system";
import type { RecordSource, WritableRecordSource } from "./record-source.js";
import { boundObservations } from "./record-source.js";
import type { HealthRecord } from "./types.js";
import { EMPTY_RECORD } from "./types.js";

const FILE_NAME = "health-record.json";

function recordFile(): File {
  return new File(Paths.document, FILE_NAME);
}

/**
 * A corrupt or half-written file reads as an empty record rather than throwing.
 *
 * That is deliberate and it is the *only* place in this app where swallowing a
 * failure is right: the alternative is an app that will not open. It is safe
 * here because an empty local record claims nothing — the person sees their
 * own empty state, not a false statement about their health. Anywhere a
 * *linked chart* fails to load, that must surface as an error, because "no
 * medications" about a real patient is a lie.
 */
export async function loadLocalRecord(): Promise<HealthRecord> {
  const file = recordFile();
  if (!file.exists) {
    return EMPTY_RECORD;
  }
  try {
    const parsed = JSON.parse(await file.text()) as Partial<HealthRecord>;
    return {
      medications: parsed.medications ?? [],
      adherence: parsed.adherence ?? [],
      observations: boundObservations(parsed.observations ?? []),
      goals: parsed.goals ?? [],
    };
  } catch {
    return EMPTY_RECORD;
  }
}

export async function saveLocalRecord(record: HealthRecord): Promise<void> {
  const directory = new Directory(Paths.document);
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
  const file = recordFile();
  if (!file.exists) {
    file.create({ overwrite: true });
  }
  file.write(JSON.stringify({ ...record, observations: boundObservations(record.observations) }));
}

export const localSource: WritableRecordSource = {
  id: "local",
  label: "Typed by you",
  load: loadLocalRecord,
  save: saveLocalRecord,
};

/** Narrow re-export so callers can hold the read-only shape where that is all they need. */
export const localReadSource: RecordSource = localSource;

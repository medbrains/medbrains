import type { HistoryImportRecord } from "@medbrains/types";

/** The most one batch takes; the server refuses more. */
export const MAX_RECORDS = 2000;

/**
 * Records from an export file: a JSON array of records, or `{ "records": [...] }`.
 * Each needs a `kind` and the `external_id` it had in the old system; the
 * server checks everything else.
 */
export function readRecords(text: string): HistoryImportRecord[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("The file is not valid JSON.");
  }
  const list = Array.isArray(parsed) ? parsed : (parsed as { records?: unknown } | null)?.records;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("The file has no records. Expected a list, or an object with a records list.");
  }
  if (list.length > MAX_RECORDS) {
    throw new Error(
      `The file has ${list.length} records; split it into batches of at most ${MAX_RECORDS}.`,
    );
  }
  const bad = list.findIndex(
    (r) =>
      typeof r !== "object" ||
      r === null ||
      typeof (r as { kind?: unknown }).kind !== "string" ||
      typeof (r as { external_id?: unknown }).external_id !== "string",
  );
  if (bad >= 0) {
    throw new Error(`Record ${bad + 1} needs a kind and an external_id.`);
  }
  return list as HistoryImportRecord[];
}

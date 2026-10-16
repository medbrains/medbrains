import type { RadiologyModality } from "@medbrains/types";
import { searchErrorText } from "@/lib/search-error";

/** Only modalities in service can be ordered; code first so "CT" finds CT. */
export function toModalityOptions(modalities: RadiologyModality[]) {
  return modalities
    .filter((m) => m.is_active)
    .map((m) => ({ value: m.id, label: `${m.code} — ${m.name}` }));
}

/**
 * Why the modality list is empty, said on the field. An empty dropdown with
 * no reason reads as "radiology is broken"; the cause is either a fault or a
 * master nobody has filled in yet.
 */
export function modalityLoadError(
  modalities: RadiologyModality[],
  isLoading: boolean,
  error: unknown,
): string | undefined {
  if (error) return searchErrorText(error, "imaging modalities") ?? undefined;
  if (!isLoading && !modalities.some((m) => m.is_active)) {
    return "No imaging modality is set up yet — add one under Radiology › Modalities.";
  }
  return undefined;
}

/**
 * Maps a prescription item's status to the Signature Spectrum semantic
 * text-decoration class (see styles/signature-spectrum.css): a
 * discontinued drug is struck in critical red, an amended/changed drug
 * in caution amber. Active/held/completed read normally.
 */
export function prescriptionStatusClass(itemStatus: string | null | undefined): string | undefined {
  if (itemStatus === "discontinued") return "ssDiscontinued";
  if (itemStatus === "changed") return "ssAmended";
  return undefined;
}

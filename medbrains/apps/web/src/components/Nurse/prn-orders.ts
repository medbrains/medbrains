/**
 * PRN / SOS / "as needed" orders are given on demand, so each dose records
 * why. Mirrors `is_prn_frequency` in `medbrains-ipd` — the server enforces it.
 */
export function isPrnFrequency(frequency: string | null | undefined): boolean {
  const f = (frequency ?? "").trim().toLowerCase();
  return f === "prn" || f === "sos" || f.startsWith("prn ") || f.includes("as needed");
}

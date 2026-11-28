// Patient identity formatting helpers — shared across patient headers
// (PatientCard, PatientContextBanner, …) so initials + subline logic lives
// in one place rather than inline in each component.

/** Two-letter initials from a display name. */
export function patientInitials(name: string, fallback = "PT"): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return (first.slice(0, 2) || fallback).toUpperCase();
  const last = parts[parts.length - 1] ?? "";
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || fallback;
}

/** "UHID · 34y · M" identity subline (skips missing parts). */
export function patientIdentitySubline(opts: {
  uhid: string;
  ageYears?: number | null;
  gender?: string | null;
  /** The hospital OPD number and its register date, when it keeps one. */
  opd?: { opd_number?: string | null; opd_date?: string | null };
}): string {
  const age = opts.ageYears != null ? ` · ${opts.ageYears}y` : "";
  const gender = opts.gender ? ` · ${opts.gender}` : "";
  return `${opts.uhid}${age}${gender}${opdLabel(opts.opd)}`;
}

/** " · OPD 1043 (20 Nov 2026)", or nothing when the patient has no OPD number. */
export function opdLabel(opd?: { opd_number?: string | null; opd_date?: string | null }): string {
  if (!opd?.opd_number) return "";
  const date = opd.opd_date
    ? new Date(`${opd.opd_date}T00:00:00`).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";
  return ` · OPD ${opd.opd_number}${date ? ` (${date})` : ""}`;
}

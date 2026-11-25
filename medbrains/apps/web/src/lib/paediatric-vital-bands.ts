/**
 * Age-banded ranges for heart rate, respiratory rate and systolic pressure.
 *
 * Source: Health Quality & Safety Commission New Zealand, *Paediatric vital
 * signs chart: user guide* (2023), Table 1 "PEWS score matrix" — the same
 * four age charts the server scores PEWS from
 * (`crates/medbrains-clinical-scores/src/ews/pews_table.rs`). "Normal" is the
 * chart's white zone; "borderline" adds the yellow zone; anything outside is
 * orange, red or blue, which the recorder shows as critical. The chart covers
 * children under 16 (`AgeBand::for_months`, 0–191 months); from 16 the
 * recorder's adult ranges apply.
 *
 * Copied, not shared, because the web has no route to the Rust table: if the
 * chart changes, change both files (pews_table.rs names this one).
 */

/** An inclusive [low, high] range. */
export type Range = [number, number];

/** The white zone, and the white plus yellow zones, for one parameter. */
export interface BandedRange {
  normal: Range;
  borderline: Range;
}

/** The three age-dependent parameters of one chart. */
export interface PaediatricRanges {
  pulse: BandedRange;
  respiratory_rate: BandedRange;
  systolic_bp: BandedRange;
}

/** Age at which the adult ranges take over (PEWS is for under 16). */
export const ADULT_FROM_YEARS = 16;

/** HQSC chart 0–11 months. RR white 30–49, yellow 25–29 / 50–54; HR 110–159, 90–109 / 160–169; SBP 75–99, 65–74 / 100–119. */
const INFANT: PaediatricRanges = {
  respiratory_rate: { normal: [30, 49], borderline: [25, 54] },
  pulse: { normal: [110, 159], borderline: [90, 169] },
  systolic_bp: { normal: [75, 99], borderline: [65, 119] },
};

/** HQSC chart 1–4 years. RR 20–39, 18–19 / 40–44; HR 90–139, 80–89 / 140–149; SBP 90–109, 75–89 / 110–124. */
const TODDLER: PaediatricRanges = {
  respiratory_rate: { normal: [20, 39], borderline: [18, 44] },
  pulse: { normal: [90, 139], borderline: [80, 149] },
  systolic_bp: { normal: [90, 109], borderline: [75, 124] },
};

/** HQSC chart 5–11 years. RR 20–29, 15–19 / 30–34; HR 80–129, 70–79 / 130–139; SBP 90–119, 80–89 / 120–139. */
const CHILD: PaediatricRanges = {
  respiratory_rate: { normal: [20, 29], borderline: [15, 34] },
  pulse: { normal: [80, 129], borderline: [70, 139] },
  systolic_bp: { normal: [90, 119], borderline: [80, 139] },
};

/** HQSC chart 12+ years. RR 15–24, 12–14 / 25–29; HR 65–109, 60–64 / 110–119; SBP 100–134, 85–99 / 135–149. */
const ADOLESCENT: PaediatricRanges = {
  respiratory_rate: { normal: [15, 24], borderline: [12, 29] },
  pulse: { normal: [65, 109], borderline: [60, 119] },
  systolic_bp: { normal: [100, 134], borderline: [85, 149] },
};

/** The chart for a child of `ageYears` completed years; `null` from 16 (adult). */
export function paediatricRanges(ageYears: number): PaediatricRanges | null {
  if (ageYears < 1) return INFANT;
  if (ageYears < 5) return TODDLER;
  if (ageYears < 12) return CHILD;
  if (ageYears < ADULT_FROM_YEARS) return ADOLESCENT;
  return null;
}

/** Today's date ("YYYY-MM-DD") in the hospital's time zone, not the browser's or UTC. */
export function hospitalToday(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

/** Year, month and day of a "YYYY-MM-DD…" string, or `null` if it is not one. */
function ymd(value: string | null | undefined): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/**
 * Completed years between a date of birth and `today` (both "YYYY-MM-DD"):
 * the birthday has to have come round. `null` for a missing or unreadable
 * date, or one after `today`.
 */
export function completedYears(
  dateOfBirth: string | null | undefined,
  today: string,
): number | null {
  const birth = ymd(dateOfBirth);
  const now = ymd(today);
  if (!birth || !now) return null;
  const beforeBirthday = now.m < birth.m || (now.m === birth.m && now.d < birth.d);
  const years = now.y - birth.y - (beforeBirthday ? 1 : 0);
  return years < 0 ? null : years;
}

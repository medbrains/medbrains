// Mirror of `crates/medbrains-server/src/services/simulator/calendar.rs` +
// `seasonality.rs`. Used only for the preview line in the schedule editor;
// runtime decisions stay server-side.
//
// Keep this file in sync with the Rust source. The Python diff script
// `scripts/check_simulator_calendar.py` is the canonical drift gate.

export type HolidayKind = "PublicHoliday" | "Festival" | "Observance";

export interface HolidayInfo {
  kind: HolidayKind;
  name: string;
  icd_boost: readonly string[];
}

const FIXED: ReadonlyArray<[[number, number], HolidayInfo]> = [
  [[1, 14], { kind: "Festival", name: "Pongal / Makar Sankranti", icd_boost: ["T20", "V01"] }],
  [[1, 26], { kind: "PublicHoliday", name: "Republic Day", icd_boost: [] }],
  [[8, 15], { kind: "PublicHoliday", name: "Independence Day", icd_boost: [] }],
  [[10, 2], { kind: "PublicHoliday", name: "Gandhi Jayanti", icd_boost: [] }],
  [[12, 25], { kind: "Festival", name: "Christmas", icd_boost: ["F10"] }],
  [[12, 31], { kind: "Festival", name: "New Year's Eve", icd_boost: ["F10", "V01"] }],
];

const VARIABLE: ReadonlyArray<[[number, number, number], HolidayInfo]> = [
  // 2025
  [[2025, 3, 14], { kind: "Festival", name: "Holi", icd_boost: ["H10", "L23", "T20"] }],
  [[2025, 3, 31], { kind: "Festival", name: "Eid-ul-Fitr", icd_boost: [] }],
  [[2025, 6, 7], { kind: "Festival", name: "Eid-ul-Adha", icd_boost: [] }],
  [[2025, 8, 16], { kind: "Festival", name: "Janmashtami", icd_boost: [] }],
  [[2025, 8, 27], { kind: "Festival", name: "Ganesh Chaturthi", icd_boost: [] }],
  [[2025, 10, 2], { kind: "Festival", name: "Dussehra", icd_boost: ["T20"] }],
  [[2025, 10, 20], { kind: "Festival", name: "Diwali", icd_boost: ["T20", "J45", "V01"] }],
  // 2026
  [[2026, 3, 4], { kind: "Festival", name: "Holi", icd_boost: ["H10", "L23", "T20"] }],
  [[2026, 3, 21], { kind: "Festival", name: "Eid-ul-Fitr", icd_boost: [] }],
  [[2026, 5, 27], { kind: "Festival", name: "Eid-ul-Adha", icd_boost: [] }],
  [[2026, 9, 5], { kind: "Festival", name: "Janmashtami", icd_boost: [] }],
  [[2026, 9, 14], { kind: "Festival", name: "Ganesh Chaturthi", icd_boost: [] }],
  [[2026, 10, 20], { kind: "Festival", name: "Dussehra", icd_boost: ["T20"] }],
  [[2026, 11, 8], { kind: "Festival", name: "Diwali", icd_boost: ["T20", "J45", "V01"] }],
  // 2027
  [[2027, 3, 22], { kind: "Festival", name: "Holi", icd_boost: ["H10", "L23", "T20"] }],
  [[2027, 3, 10], { kind: "Festival", name: "Eid-ul-Fitr", icd_boost: [] }],
  [[2027, 5, 17], { kind: "Festival", name: "Eid-ul-Adha", icd_boost: [] }],
  [[2027, 8, 25], { kind: "Festival", name: "Janmashtami", icd_boost: [] }],
  [[2027, 9, 4], { kind: "Festival", name: "Ganesh Chaturthi", icd_boost: [] }],
  [[2027, 10, 9], { kind: "Festival", name: "Dussehra", icd_boost: ["T20"] }],
  [[2027, 10, 29], { kind: "Festival", name: "Diwali", icd_boost: ["T20", "J45", "V01"] }],
];

export function holidayLookup(date: Date): HolidayInfo | null {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const y = date.getFullYear();
  for (const [[fm, fd], info] of FIXED) {
    if (fm === m && fd === d) return info;
  }
  for (const [[ly, lm, ld], info] of VARIABLE) {
    if (ly === y && lm === m && ld === d) return info;
  }
  return null;
}

export function seasonFor(date: Date): "summer" | "monsoon" | "post_monsoon" | "winter" {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 6) return "summer";
  if (m >= 7 && m <= 9) return "monsoon";
  if (m >= 10 && m <= 11) return "post_monsoon";
  return "winter";
}

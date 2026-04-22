import type { FoodTiming, MedicationTiming, TimeOfDay } from "@medbrains/types";

// ── Parse / Serialize ────────────────────────────────────────

/** Parse the instructions field — returns structured timing, free text, or null */
export function parseInstructions(
  raw: string | null | undefined,
): MedicationTiming | { text: string } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed._v === 1) return parsed as MedicationTiming;
  } catch {
    // not JSON — treat as free text
  }
  return { text: raw };
}

/** Serialize structured timing into the instructions field */
export function serializeTiming(timing: Omit<MedicationTiming, "_v">): string {
  return JSON.stringify({ _v: 1, ...timing });
}

// ── Frequency → Default Time Slots ──────────────────────────

const FREQ_SLOT_MAP: Record<string, TimeOfDay[]> = {
  OD: ["morning"],
  BD: ["morning", "evening"],
  TDS: ["morning", "afternoon", "evening"],
  QID: ["morning", "afternoon", "evening", "bedtime"],
  HS: ["bedtime"],
  STAT: [],
  SOS: [],
  PRN: [],
};

/** Map a frequency code to default time-of-day slots */
export function frequencyToDefaultSlots(freq: string): TimeOfDay[] {
  return FREQ_SLOT_MAP[freq.toUpperCase()] ?? [];
}

// ── Display Labels ──────────────────────────────────────────

const FOOD_LABELS: Record<FoodTiming, string> = {
  before_food: "Before food (30 min)",
  with_food: "With food",
  after_food: "After food (30 min)",
  empty_stomach: "Empty stomach",
  any: "Any time",
};

const FOOD_LABELS_SHORT: Record<FoodTiming, string> = {
  before_food: "Before food",
  with_food: "With food",
  after_food: "After food",
  empty_stomach: "Empty stomach",
  any: "Any time",
};

const TIME_LABELS: Record<TimeOfDay, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  bedtime: "Bedtime",
};

const TIME_HOURS: Record<TimeOfDay, string> = {
  morning: "8 AM",
  afternoon: "2 PM",
  evening: "6 PM",
  bedtime: "10 PM",
};

export function foodTimingLabel(ft: FoodTiming, short = false): string {
  return (short ? FOOD_LABELS_SHORT[ft] : FOOD_LABELS[ft]) ?? ft;
}

export function timeSlotLabel(ts: TimeOfDay): string {
  return TIME_LABELS[ts] ?? ts;
}

export function timeSlotHour(ts: TimeOfDay): string {
  return TIME_HOURS[ts] ?? "";
}

/** Convert structured timing to a human-readable string */
export function timingToHumanReadable(timing: MedicationTiming): string {
  const parts: string[] = [];

  if (timing.time_slots && timing.time_slots.length > 0) {
    parts.push(timing.time_slots.map(timeSlotLabel).join(" & "));
  }

  if (timing.food_timing && timing.food_timing !== "any") {
    parts.push(foodTimingLabel(timing.food_timing, true).toLowerCase());
  }

  if (timing.custom_instruction) {
    parts.push(timing.custom_instruction);
  }

  return parts.join(", ") || "No specific timing";
}

/** Get display string from raw instructions field */
export function instructionsDisplayText(raw: string | null | undefined): string | null {
  const parsed = parseInstructions(raw);
  if (!parsed) return null;
  if ("text" in parsed) return parsed.text;
  return timingToHumanReadable(parsed);
}

// ── Schedule Grid Helpers ───────────────────────────────────

export interface ScheduleSlot {
  time: TimeOfDay;
  hour: string;
  drugs: Array<{
    drug_name: string;
    dosage: string;
    route: string | null;
    food_timing?: FoodTiming;
    custom_instruction?: string;
  }>;
}

/** All time columns for the schedule grid */
export const SCHEDULE_COLUMNS: Array<{ slot: TimeOfDay; hour: string }> = [
  { slot: "morning", hour: "8 AM" },
  { slot: "afternoon", hour: "2 PM" },
  { slot: "evening", hour: "6 PM" },
  { slot: "bedtime", hour: "10 PM" },
];

/** Route → color mapping for visual distinction */
export const ROUTE_COLORS: Record<string, string> = {
  Oral: "primary",
  IV: "danger",
  IM: "orange",
  SC: "warning",
  Topical: "teal",
  Inhalation: "info",
  Sublingual: "violet",
  Rectal: "slate",
};

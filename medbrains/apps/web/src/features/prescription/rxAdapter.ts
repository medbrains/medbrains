// Adapter between the rx-suite model (rich dosing UI) and the backend
// prescription contract (`PrescriptionItemInput` + `MedicationTiming` JSON).
// Lossy fields (cadence: alternate/weekly/monthly) fold into the timing's
// `custom_instruction`. Keeps the rx-suite standalone-friendly while letting
// `RxSuiteWriter` save through the existing OPD prescription backend.

import type {
  FoodTiming,
  MedicationTiming,
  PharmacyCatalog,
  PrescriptionItemInput,
  TimeOfDay,
} from "@medbrains/types";

/** The fields needed to rebuild an rx-suite row — satisfied by both a stored
 *  `PrescriptionItem` and a template `PrescriptionItemInput`. */
interface RxLikeItem {
  id?: string;
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route?: string | null;
  instructions?: string | null;
  catalog_item_id?: string | null;
}

import { parseInstructions, serializeTiming } from "@/lib/medication-timing-utils";
import {
  type AwareClass,
  type Dose,
  type DrugSchedule,
  dosesFreqCode,
  type FormularyDrug,
  type Repeat,
  type Route,
  type RxItem,
  repeatLabel,
} from "./rxModel";

// ── enum maps (rx-suite ⇄ backend) ──────────────────────────

/** rx-suite day-part key → backend time-of-day slot. */
const SLOT_TO_TOD: Record<string, TimeOfDay> = {
  m: "morning",
  a: "afternoon",
  e: "evening",
  n: "bedtime",
};
const TOD_TO_SLOT: Record<TimeOfDay, { key: string; label: string; time: string }> = {
  morning: { key: "m", label: "Morning", time: "09:00" },
  afternoon: { key: "a", label: "Noon", time: "14:00" },
  evening: { key: "e", label: "Evening", time: "18:00" },
  bedtime: { key: "n", label: "Night", time: "21:00" },
};

/** rx-suite frequency code → backend code (TID→TDS). */
const FREQ_TO_BACKEND: Record<string, string> = { OD: "OD", BD: "BD", TID: "TDS", QID: "QID" };

const ROUTE_TO_BACKEND: Record<Route, string> = {
  oral: "Oral",
  iv: "IV",
  im: "IM",
  sc: "SC",
  topical: "Topical",
  inhaled: "Inhalation",
  rectal: "Rectal",
};
const BACKEND_TO_ROUTE: Record<string, Route> = {
  Oral: "oral",
  IV: "iv",
  IM: "im",
  SC: "sc",
  Topical: "topical",
  Inhalation: "inhaled",
  Sublingual: "oral",
  Rectal: "rectal",
};

/** rx-suite food label → backend FoodTiming (bedtime/empty handled separately). */
const FOOD_TO_FT: Record<string, FoodTiming> = {
  "after food": "after_food",
  "before food": "before_food",
  "with food": "with_food",
  "empty stomach": "empty_stomach",
};
const FT_TO_FOOD: Record<FoodTiming, string> = {
  after_food: "after food",
  before_food: "before food",
  with_food: "with food",
  empty_stomach: "empty stomach",
  any: "",
};

const AWARE_FROM_CATALOG: Record<string, AwareClass> = {
  access: "Access",
  watch: "Watch",
  reserve: "Reserve",
};

// ── catalog → rx-suite formulary ────────────────────────────

/** Map the live pharmacy catalog into rx-suite formulary drugs. One catalog
 *  row = one SKU (single strength/brand). Regulatory signals come straight
 *  from the catalog columns. */
export function catalogToFormulary(catalog: PharmacyCatalog[]): FormularyDrug[] {
  return catalog.map((c) => {
    const ndps = c.drug_schedule === "NDPS";
    const schedule: DrugSchedule =
      c.drug_schedule === "OTC" || c.drug_schedule == null
        ? null
        : ndps
          ? "X"
          : (c.drug_schedule as DrugSchedule);
    return {
      id: c.id,
      name: c.name,
      salt: c.inn_name ?? c.generic_name ?? c.name,
      form: c.unit ?? "",
      cls: c.category ?? "",
      brands: [c.name],
      strengths: c.unit ? [c.unit] : [],
      kind: c.drug_schedule === "OTC" ? "otc" : "rx",
      schedule,
      controlled: c.is_controlled || ndps,
      atc: c.atc_code ?? undefined,
      aware: c.aware_category ? (AWARE_FROM_CATALOG[c.aware_category] ?? null) : null,
      lasa: c.is_lasa,
    } satisfies FormularyDrug;
  });
}

// ── rx-suite items → backend input ──────────────────────────

function backendFreq(item: RxItem): string {
  if (item.sos) return "SOS";
  const code = dosesFreqCode(item.doses, false);
  return FREQ_TO_BACKEND[code] ?? code;
}

function backendDuration(item: RxItem): string {
  if (item.ongoing) return "Continue";
  if (item.sos) return "PRN";
  return `${item.days} day${item.days === 1 ? "" : "s"}`;
}

function buildInstructions(item: RxItem): string | undefined {
  const time_slots: TimeOfDay[] = [];
  const specific_times: string[] = [];
  for (const d of item.doses) {
    const slot = SLOT_TO_TOD[d.key];
    if (slot) time_slots.push(slot);
    else if (d.time) specific_times.push(d.time);
  }
  const custom: string[] = [];
  if (item.repeat && item.repeat.type !== "daily") custom.push(repeatLabel(item.repeat));
  if (item.food === "at bedtime") custom.push("at bedtime");
  if (item.note) custom.push(item.note);

  const food_timing = FOOD_TO_FT[item.food];
  const timing: Omit<MedicationTiming, "_v"> = {
    ...(food_timing ? { food_timing } : {}),
    ...(time_slots.length ? { time_slots } : {}),
    ...(specific_times.length ? { specific_times } : {}),
    ...(custom.length ? { custom_instruction: custom.join(" · ") } : {}),
  };
  if (Object.keys(timing).length === 0) return undefined;
  return serializeTiming(timing);
}

export function rxItemToInput(item: RxItem): PrescriptionItemInput {
  return {
    drug_name: item.name,
    dosage: item.strength,
    frequency: backendFreq(item),
    duration: backendDuration(item),
    route: item.route ? ROUTE_TO_BACKEND[item.route] : undefined,
    instructions: buildInstructions(item),
    catalog_item_id: item.id,
  };
}

export function rxItemsToInput(items: RxItem[]): PrescriptionItemInput[] {
  return items.map(rxItemToInput);
}

// ── backend items → rx-suite (for editing an existing Rx) ───

function parseDuration(duration: string): { days: number; ongoing: boolean; sos: boolean } {
  const d = duration.trim().toLowerCase();
  if (d === "continue" || d === "ongoing") return { days: 0, ongoing: true, sos: false };
  if (d === "prn") return { days: 0, ongoing: false, sos: true };
  const n = Number.parseInt(d, 10);
  return { days: Number.isFinite(n) && n > 0 ? n : 5, ongoing: false, sos: false };
}

function dosesFromTiming(timing: MedicationTiming): Dose[] {
  const doses: Dose[] = [];
  for (const ts of timing.time_slots ?? []) {
    const slot = TOD_TO_SLOT[ts];
    if (slot) doses.push({ key: slot.key, label: slot.label, time: slot.time });
  }
  let custom = 0;
  for (const t of timing.specific_times ?? []) {
    custom += 1;
    doses.push({ key: `c${custom}`, label: "Custom", time: t });
  }
  return doses;
}

/** Reverse-map saved prescription items into rx-suite items so an existing Rx
 *  can be loaded back into the composer for editing. Best-effort: cadence that
 *  was folded into `custom_instruction` returns as the note. */
export function prescriptionItemsToRx(
  items: RxLikeItem[],
  formularyById: Record<string, FormularyDrug>,
): RxItem[] {
  return items.map((item, i) => {
    const drug = item.catalog_item_id ? formularyById[item.catalog_item_id] : undefined;
    const parsed = parseInstructions(item.instructions);
    const timing = parsed && !("text" in parsed) ? parsed : null;
    const freeText = parsed && "text" in parsed ? parsed.text : "";
    const isSos = item.frequency.toUpperCase() === "SOS" || item.frequency.toUpperCase() === "PRN";
    const dur = parseDuration(item.duration);
    const repeat: Repeat = { type: "daily" };
    return {
      uid: i + 1,
      id: item.catalog_item_id ?? item.id ?? `unmatched-${i}`,
      name: item.drug_name,
      form: drug?.form ?? "",
      strength: item.dosage,
      brand: drug?.brands[0] ?? item.drug_name,
      doses: isSos || !timing ? [] : dosesFromTiming(timing),
      sos: isSos,
      repeat,
      days: dur.days || 5,
      ongoing: dur.ongoing,
      food: timing?.food_timing ? (FT_TO_FOOD[timing.food_timing] ?? "") : "",
      route: item.route ? (BACKEND_TO_ROUTE[item.route] ?? "oral") : undefined,
      note: timing?.custom_instruction ?? freeText,
    } satisfies RxItem;
  });
}

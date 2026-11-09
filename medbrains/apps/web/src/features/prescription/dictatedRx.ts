import type { ModelMedicine } from "@medbrains/types";
import {
  type Dose,
  type FormularyDrug,
  quickRxDefaults,
  ROUTES,
  type Route,
  type RxItem,
  SLOTS,
} from "./rxModel";

/** A dictated medicine the formulary could not name on its own: the doctor picks. */
export interface DictatedPick {
  /** Position in the dictated list, so a pick lands on the right medicine. */
  index: number;
  medicine: ModelMedicine;
  /** How many formulary drugs it could be (0: none, 2+: ambiguous). */
  candidates: number;
}

export interface DictatedRx {
  /** Lines matched to exactly one formulary drug, with what was said. */
  items: RxItem[];
  /** Medicines the doctor must pick a drug for before they are loaded. */
  picks: DictatedPick[];
}

/** "5 days" → 5; anything else leaves the writer's default. */
function spokenDays(duration: string): number | null {
  const match = /(\d{1,3})\s*day/i.exec(duration);
  return match ? Number(match[1]) : null;
}

const slot = (key: (typeof SLOTS)[number]["key"]): Dose => {
  const s = SLOTS.find((x) => x.key === key) ?? SLOTS[0];
  return { key: s.key, label: s.label, time: s.def };
};

/**
 * Frequency words a doctor says, as the day parts they mean. Checked in this
 * order, so "three times a day" is read before "a day" and "twice, at night"
 * as twice.
 */
const FREQUENCIES: { pattern: RegExp; slots: (typeof SLOTS)[number]["key"][] }[] = [
  { pattern: /\b(four times|qid|qds)\b/i, slots: ["m", "a", "e", "n"] },
  { pattern: /\b(thrice|three times|tds|tid)\b/i, slots: ["m", "a", "n"] },
  { pattern: /\b(twice|two times|bd|bid)\b/i, slots: ["m", "n"] },
  { pattern: /\b(at night|bedtime|hs|every night)\b/i, slots: ["n"] },
  { pattern: /\b(once|od|daily|every morning|in the morning)\b/i, slots: ["m"] },
];

/**
 * The day parts a spoken frequency names; `null` when none was said. A
 * frequency this does not understand fills no slot (the doctor sets it): a
 * default must never stand in for what was said.
 */
export function spokenDoses(frequency: string): Dose[] | null {
  if (!frequency.trim()) return null;
  const hit = FREQUENCIES.find((f) => f.pattern.test(frequency));
  return hit ? hit.slots.map(slot) : [];
}

/** The route as the writer names it, when what was said is one. */
function spokenRoute(route: string): Route | null {
  const said = route.trim().toLowerCase();
  return ROUTES.find((r) => r.v === said || r.label.toLowerCase() === said)?.v ?? null;
}

/**
 * The formulary drugs a spoken name can mean: by its name, generic (salt) or
 * brand — never its class, which names many drugs.
 */
export function formularyMatches(name: string, formulary: FormularyDrug[]): FormularyDrug[] {
  const q = name.trim().toLowerCase();
  if (!q) return [];
  return formulary.filter(
    (d) =>
      d.name.toLowerCase().includes(q) ||
      d.salt.toLowerCase() === q ||
      d.brands.some((b) => b.toLowerCase() === q),
  );
}

/**
 * One dictated medicine as a prescription-pad line for `drug`. What the
 * doctor said wins over the writer's defaults: the dose as the strength, the
 * frequency as the day parts (none when it could not be read), the days and
 * the route. The spoken words stay in the line's note.
 */
export function dictatedLine(m: ModelMedicine, drug: FormularyDrug): RxItem {
  const base = quickRxDefaults(drug);
  const said = [m.name, m.dose, m.frequency, m.duration, m.route].filter(Boolean).join(", ");
  return {
    ...base,
    uid: 0,
    strength: m.dose.trim() || base.strength,
    doses: spokenDoses(m.frequency) ?? base.doses,
    days: spokenDays(m.duration) ?? base.days,
    route: spokenRoute(m.route) ?? base.route,
    note: `Dictated: ${said}`,
  };
}

/**
 * Dictated medicines as prescription-pad lines, each matched to exactly one
 * formulary drug; a name that matches none or several is left for the doctor
 * to pick. `chosen` holds the doctor's picks by position.
 */
export function dictatedToRx(
  medicines: ModelMedicine[],
  formulary: FormularyDrug[],
  chosen: Record<number, FormularyDrug> = {},
): DictatedRx {
  const items: RxItem[] = [];
  const picks: DictatedPick[] = [];
  medicines.forEach((medicine, index) => {
    const matches = formularyMatches(medicine.name, formulary);
    const drug = chosen[index] ?? (matches.length === 1 ? matches[0] : undefined);
    if (drug) items.push(dictatedLine(medicine, drug));
    else picks.push({ index, medicine, candidates: matches.length });
  });
  return { items, picks };
}

import type { ModelMedicine } from "@medbrains/types";
import { type FormularyDrug, quickRxDefaults, type RxItem, searchFormulary } from "./rxModel";

export interface DictatedRx {
  /** Lines matched to the formulary, with what was said kept in the note. */
  items: RxItem[];
  /** Medicines with no formulary match: the doctor prescribes them by hand. */
  unmatched: string[];
}

/** "5 days" → 5; anything else leaves the writer's default. */
function spokenDays(duration: string): number | null {
  const match = /(\d{1,3})\s*day/i.exec(duration);
  return match ? Number(match[1]) : null;
}

/**
 * Dictated medicines as prescription-pad lines. Each is matched to the
 * formulary by name and starts from the writer's usual defaults, with what
 * the doctor said in its note to set the dose from: the doctor still edits,
 * the safety rail still runs, the server still re-checks at save.
 */
export function dictatedToRx(medicines: ModelMedicine[], formulary: FormularyDrug[]): DictatedRx {
  const items: RxItem[] = [];
  const unmatched: string[] = [];
  for (const m of medicines) {
    const drug = searchFormulary(formulary, m.name, 1)[0];
    if (!drug) {
      unmatched.push(m.name);
      continue;
    }
    const said = [m.dose, m.frequency, m.duration, m.route].filter(Boolean).join(", ");
    const base = quickRxDefaults(drug);
    items.push({
      ...base,
      uid: 0,
      days: spokenDays(m.duration) ?? base.days,
      note: said ? `Dictated: ${said}` : base.note,
    });
  }
  return { items, unmatched };
}

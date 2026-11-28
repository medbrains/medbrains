/**
 * Drug–allergy matching with cross-reactivity classes — the client-side mirror
 * of `medbrains-core::allergy` (keep the class lists in sync). Lets the
 * prescribe / dispense / counter-sale UIs prompt for an override before the
 * server's 400 backstop, including class matches (e.g. penicillin → cephalosporin).
 */

import type { AllergyConflict } from "@medbrains/types";

const CLASSES: Record<string, string[]> = {
  "beta-lactam": [
    "penicillin",
    "amoxicillin",
    "amoxycillin",
    "ampicillin",
    "augmentin",
    "cloxacillin",
    "dicloxacillin",
    "piperacillin",
    "carbenicillin",
    "cef",
    "cephalexin",
    "cephalosporin",
    "ceftriaxone",
    "cefuroxime",
    "cefixime",
    "cefpodoxime",
    "cefotaxime",
  ],
  sulfonamide: [
    "sulfa",
    "sulpha",
    "sulfamethoxazole",
    "sulphamethoxazole",
    "sulfadiazine",
    "cotrimoxazole",
    "co-trimoxazole",
    "septran",
    "bactrim",
  ],
  nsaid: [
    "aspirin",
    "acetylsalicylic",
    "ibuprofen",
    "diclofenac",
    "aceclofenac",
    "naproxen",
    "ketorolac",
    "indomethacin",
    "piroxicam",
    "mefenamic",
  ],
};

function classOf(name: string): string | null {
  for (const [label, fragments] of Object.entries(CLASSES)) {
    if (fragments.some((frag) => name.includes(frag))) return label;
  }
  return null;
}

/** Match a drug name against an allergen name; null if no conflict. */
export function matchDrugAllergy(
  drug: string,
  allergen: string,
): { cross: boolean; class: string | null } | null {
  const d = drug.trim().toLowerCase();
  const a = allergen.trim().toLowerCase();
  if (d.length === 0 || a.length === 0) return null;
  if (d.includes(a) || a.includes(d)) return { cross: false, class: null };
  const dc = classOf(d);
  const ac = classOf(a);
  if (dc && ac && dc === ac) return { cross: true, class: dc };
  return null;
}

export interface AllergyConflictView {
  drug: string;
  allergen: string;
  cross: boolean;
}

/** First conflicting allergen per drug, across the patient's allergen list. */
export function findAllergyConflicts(drugs: string[], allergens: string[]): AllergyConflictView[] {
  const out: AllergyConflictView[] = [];
  for (const drug of drugs) {
    for (const allergen of allergens) {
      const hit = matchDrugAllergy(drug, allergen);
      if (hit) {
        out.push({ drug, allergen, cross: hit.cross });
        break;
      }
    }
  }
  return out;
}

/** "Amoxicillin × Penicillin (cross-reactive beta-lactam)" for a CDS-rail conflict. */
export function allergyConflictLabel(c: AllergyConflict): string {
  const cross = c.cross_reactive_class ? ` (cross-reactive ${c.cross_reactive_class})` : "";
  return `${c.drug_name} × ${c.allergen_name}${cross}`;
}

/** The "Allergy screen" row: the conflicts, else what the order was screened against. */
export function allergyScreenDetail(conflicts: AllergyConflict[], onFile: string[]): string {
  if (conflicts.length) return conflicts.map(allergyConflictLabel).join(", ");
  if (onFile.length) return `On file: ${onFile.join(", ")} · no conflict in order`;
  return "No allergies on file";
}

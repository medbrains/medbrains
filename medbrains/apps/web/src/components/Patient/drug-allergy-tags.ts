// Drug-allergy tags as the registration form types and shows them.

import type { PharmacyCatalog } from "@medbrains/types";

/** The tags in a comma, semicolon or line separated allergy list. */
export function splitDrugAllergyTags(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/** The tags joined back into the stored list. */
export function joinDrugAllergyTags(values: string[]): string {
  return values
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

/** A formulary drug as the allergy picker lists it, with its schedule. */
export function drugAllergyOptionLabel(item: PharmacyCatalog): string {
  return [
    item.name,
    item.generic_name,
    item.drug_schedule ? `Schedule ${item.drug_schedule}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

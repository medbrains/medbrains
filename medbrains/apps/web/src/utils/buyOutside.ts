import type { PharmacyOrderItem } from "@medbrains/types";

/** What the pharmacy shows on a line it does not dispense. */
export const BUY_OUTSIDE_LABEL = "Buy outside, not dispensed here";

/** What the MAR shows on a dose of a medicine bought outside. */
export const PATIENTS_OWN_LABEL = "Patient's own, brought from outside";

type Line = Pick<PharmacyOrderItem, "buy_outside" | "catalog_item_id" | "quantity_dispensed">;

/** A line sold here: a catalogue item not marked bought outside. */
export function isSoldHere(line: Line): boolean {
  return Boolean(line.catalog_item_id) && !line.buy_outside;
}

/**
 * A line the patient buys outside: marked so (by the prescriber or the
 * reviewing pharmacist), or an old typed line nothing was ever handed out
 * against. A typed line dispensed before the rule is history, not outside.
 */
export function isBoughtOutside(line: Line): boolean {
  return line.buy_outside || (!line.catalog_item_id && line.quantity_dispensed === 0);
}

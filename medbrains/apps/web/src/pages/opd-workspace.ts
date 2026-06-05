export type OpdOrderBasketTab = "drug" | "lab" | "radiology";

export function opdEncounterTabForOrderBasket(
  tab: OpdOrderBasketTab,
): "prescriptions" | "investigations" {
  return tab === "drug" ? "prescriptions" : "investigations";
}

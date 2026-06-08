import type { PrescriptionWithItems } from "@medbrains/types";

export type OpdOrderBasketTab = "drug" | "lab" | "radiology";

export const OPD_ENCOUNTER_TAB_VALUES = [
  "vitals",
  "consultation",
  "history",
  "ros",
  "physical-exam",
  "diagnoses",
  "investigations",
  "procedures",
  "prescriptions",
  "referrals",
  "rx-history",
  "charts",
  "timeline",
  "certificates",
  "followup",
  "reminders",
  "feedback",
  "consents",
  "pre-auth",
  "docket",
  "pharmacy-dispatch",
] as const;

export type OpdEncounterTabValue = (typeof OPD_ENCOUNTER_TAB_VALUES)[number];

export function isOpdEncounterTabValue(value: string | null): value is OpdEncounterTabValue {
  return OPD_ENCOUNTER_TAB_VALUES.some((tab) => tab === value);
}

export function opdEncounterTabForOrderBasket(
  tab: OpdOrderBasketTab,
): "prescriptions" | "investigations" {
  return tab === "drug" ? "prescriptions" : "investigations";
}

export function opdOrderBasketTabFromSearchParams(
  searchParams: URLSearchParams,
): OpdOrderBasketTab | null {
  const value = searchParams.get("order");
  if (value === "drug" || value === "lab" || value === "radiology") return value;
  return null;
}

export function opdEncounterWorkspaceTabRoute(
  encounterId: string,
  tab: OpdEncounterTabValue,
): string {
  return `/opd/encounters/${encounterId}#${tab}`;
}

export function opdEncounterOrderBasketRoute(encounterId: string, tab: OpdOrderBasketTab): string {
  return `/opd/encounters/${encounterId}?order=${tab}#${opdEncounterTabForOrderBasket(tab)}`;
}

export function activeOpdPharmacyOrderIdForJourney(
  prescriptions: readonly PrescriptionWithItems[],
): string | null {
  return (
    prescriptions.find(
      (prescription) =>
        prescription.pharmacy_order_id &&
        prescription.items.some((item) => item.item_status !== "discontinued"),
    )?.pharmacy_order_id ??
    prescriptions.find((prescription) => prescription.pharmacy_order_id)?.pharmacy_order_id ??
    null
  );
}

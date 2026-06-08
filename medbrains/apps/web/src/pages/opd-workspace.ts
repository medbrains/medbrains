import type {
  ClinicalEventName,
  LabOrder,
  MrdCaseSheetPacket,
  PrescriptionWithItems,
} from "@medbrains/types";
import { hasReviewedPatientPharmacyPrescriptionForJourney } from "@medbrains/types";

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

export function activeOpdPharmacyRxQueueIdForJourney(
  prescriptions: readonly PrescriptionWithItems[],
): string | null {
  return (
    prescriptions.find(
      (prescription) =>
        !prescription.pharmacy_order_id &&
        prescription.pharmacy_rx_queue_id &&
        prescription.items.some((item) => item.item_status !== "discontinued"),
    )?.pharmacy_rx_queue_id ??
    prescriptions.find(
      (prescription) => !prescription.pharmacy_order_id && prescription.pharmacy_rx_queue_id,
    )?.pharmacy_rx_queue_id ??
    null
  );
}

export function deriveOpdJourneyCompletedEvents(
  prescriptions: readonly PrescriptionWithItems[],
  labOrders: readonly LabOrder[],
  mrdCaseSheetPackets: readonly MrdCaseSheetPacket[],
): readonly ClinicalEventName[] {
  const events: ClinicalEventName[] = [];
  if (prescriptions.length > 0 || labOrders.length > 0) {
    events.push("order.created");
  }
  if (hasReviewedPatientPharmacyPrescriptionForJourney(prescriptions)) {
    events.push("pharmacy.prescription.reviewed");
  }
  if (mrdCaseSheetPackets.length > 0) {
    events.push("mrd.case_sheet.generated");
  }
  if (
    mrdCaseSheetPackets.some((packet) => packet.status === "printed" || packet.printed_at !== null)
  ) {
    events.push("mrd.case_sheet.printed");
  }
  return events;
}

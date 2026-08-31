import type { PatientFlowContextInput, PrescriptionHistoryItem } from "@medbrains/types";
import {
  activePatientPharmacyOrderIdForJourney,
  activePatientPharmacyRxQueueIdForJourney,
  patientFlowJourneyContext,
} from "@medbrains/types";

export type PatientDetailOrderBasketTab = "drug" | "lab" | "radiology";

export interface PatientDetailJourneyContextInput
  extends Omit<PatientFlowContextInput, "activePharmacyOrderId" | "activePharmacyRxQueueId"> {
  prescriptions: readonly PrescriptionHistoryItem[];
}

export const PATIENT_DETAIL_TAB_VALUES = [
  "overview",
  "allergies",
  "timeline",
  "visits",
  "prescriptions",
  "lab",
  "imaging",
  "billing",
  "appointments",
  "camps",
  "family",
  "documents",
  "chronic",
  "packages",
  "notes",
  "merge",
] as const;

export type PatientDetailTabValue = (typeof PATIENT_DETAIL_TAB_VALUES)[number];

export function isPatientDetailTabValue(value: string | null): value is PatientDetailTabValue {
  return PATIENT_DETAIL_TAB_VALUES.some((tab) => tab === value);
}

export function patientDetailTabForOrderBasket(
  tab: PatientDetailOrderBasketTab,
): "prescriptions" | "lab" | "imaging" {
  if (tab === "drug") return "prescriptions";
  return tab === "lab" ? "lab" : "imaging";
}

export function patientDetailOrderBasketTabFromSearchParams(
  searchParams: URLSearchParams,
): PatientDetailOrderBasketTab | null {
  const value = searchParams.get("order");
  if (value === "drug" || value === "lab" || value === "radiology") return value;
  return null;
}

export function patientDetailWorkspaceTabRoute(
  patientId: string,
  tab: PatientDetailTabValue,
): string {
  return `/patients/${patientId}#${tab}`;
}

export function patientDetailOrderBasketRoute(
  patientId: string,
  tab: PatientDetailOrderBasketTab,
): string {
  return `/patients/${patientId}?order=${tab}#${patientDetailTabForOrderBasket(tab)}`;
}

export function patientDetailJourneyContext(input: PatientDetailJourneyContextInput) {
  const { prescriptions, ...context } = input;

  return patientFlowJourneyContext({
    ...context,
    activePharmacyOrderId: activePatientPharmacyOrderIdForJourney(prescriptions),
    activePharmacyRxQueueId: activePatientPharmacyRxQueueIdForJourney(prescriptions),
  });
}

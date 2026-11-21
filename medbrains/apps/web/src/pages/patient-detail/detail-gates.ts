import { useHasPermission, useModuleStore } from "@medbrains/stores";
import { P } from "@medbrains/types";

/**
 * What the patient record may show and read, for this user in this hospital.
 *
 * A brick the hospital switched off has no tab, badge or button on the record,
 * and its reads are not sent (the server refuses them): the same
 * `disabled_modules` set the launcher and side panel hide apps by, loaded with
 * the permissions from `/auth/me`, so it cannot be missing while they are there.
 * `reads` says which of the record's lists to fetch for `patientId`.
 */
export function usePatientDetailGates(patientId: string) {
  const disabledModules = useModuleStore((s) => s.disabledModules);
  /** A tab with no brick is always on; otherwise its brick must be switched on. */
  const isBrickOn = (brick?: string) => !brick || !disabledModules.has(brick);
  const hasId = patientId.length > 0;
  /** Fetch a section only for a real patient, a permitted caller and a live brick. */
  const read = (allowed: boolean, brick?: string) => hasId && allowed && isBrickOn(brick);
  // Admissions and radiology reports are read only by those who may list
  // them; the front desk opening a record sent both and was refused.
  const reads = {
    labOrders: read(useHasPermission(P.LAB.ORDERS_LIST), "lab"),
    radiology: read(useHasPermission(P.RADIOLOGY.ORDERS_LIST), "radiology"),
    pharmacyOrders: read(useHasPermission(P.PHARMACY.PRESCRIPTIONS_LIST), "pharmacy"),
    admissions: read(useHasPermission(P.IPD.ADMISSIONS_LIST), "ipd"),
    erVisits: read(useHasPermission(P.EMERGENCY.VISITS_LIST), "emergency"),
    campRegistrations: read(useHasPermission(P.CAMP.REGISTRATIONS_LIST), "camp"),
    prescriptions: read(true, "opd"),
    invoices: read(true, "billing"),
  };
  return {
    isBrickOn,
    emergencyOn: isBrickOn("emergency"),
    reads,
    canListPatients: useHasPermission(P.PATIENTS.LIST),
    canViewBillingLedger: useHasPermission(P.BILLING.INVOICES_LIST) && isBrickOn("billing"),
    canViewNotes: useHasPermission(P.CLINICAL_NOTES.VIEW) && isBrickOn("opd"),
    canViewGrowth: useHasPermission(P.PATIENTS.GROWTH.VIEW),
  };
}

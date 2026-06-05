import type { ClinicalJourneyActionId, ClinicalJourneyContext } from "@medbrains/types";

export function patientJourneyActionRoute(
  actionId: ClinicalJourneyActionId,
  context: ClinicalJourneyContext,
): string | null {
  switch (actionId) {
    case "patient.edit":
      return `/patients/${context.patientId}/edit`;
    case "opd.open_visit":
      return context.activeEncounterId
        ? `/opd/encounters/${context.activeEncounterId}#consultation`
        : `/opd/new?patient_id=${context.patientId}`;
    case "orders.medication":
      if (context.activeOrderContext === "ipd" && context.activeAdmissionId) {
        return `/ipd/admissions/${context.activeAdmissionId}#prescriptions`;
      }
      if (context.activeOrderContext === "opd" && context.activeEncounterId) {
        return `/opd/encounters/${context.activeEncounterId}#prescriptions`;
      }
      return null;
    case "orders.lab":
    case "orders.radiology":
      if (context.activeOrderContext === "ipd" && context.activeAdmissionId) {
        return `/ipd/admissions/${context.activeAdmissionId}#investigations`;
      }
      if (context.activeOrderContext === "opd" && context.activeEncounterId) {
        return `/opd/encounters/${context.activeEncounterId}#investigations`;
      }
      return null;
    case "ipd.open_admission":
      return context.activeAdmissionId
        ? `/ipd/admissions/${context.activeAdmissionId}#overview`
        : null;
    case "ipd.admit":
      return `/ipd/new?patient_id=${context.patientId}`;
    case "emergency.open_visit":
      return context.activeEmergencyVisitId
        ? `/emergency/visits/${context.activeEmergencyVisitId}`
        : `/emergency/visits/new?patient_id=${context.patientId}`;
    case "emergency.open_mlc":
      return context.activeEmergencyVisitId
        ? `/emergency/visits/${context.activeEmergencyVisitId}#mlc`
        : `/emergency?tab=mlc&patient_id=${context.patientId}`;
    case "camp.open_context":
      return `/camp?patient_id=${context.patientId}`;
    case "billing.open_ledger":
      return `/billing?tab=invoices&patient_id=${context.patientId}`;
    case "billing.prepare_discharge_bill":
      return `/billing?tab=invoices&patient_id=${context.patientId}&source=ipd_discharge`;
    case "billing.collect_payment":
      return `/billing?tab=invoices&patient_id=${context.patientId}&action=payment`;
    case "pharmacy.open_patient_queue":
      return `/pharmacy?tab=orders&patient_id=${context.patientId}`;
    case "pharmacy.dispense_order":
      return `/pharmacy?tab=orders&patient_id=${context.patientId}&action=dispense`;
    case "mrd.open_case_sheet":
      if (context.activeAdmissionId) {
        return `/mrd?packet_type=ipd&admission_id=${context.activeAdmissionId}#case-sheets`;
      }
      if (context.activeEncounterId) {
        return `/mrd?packet_type=opd&encounter_id=${context.activeEncounterId}#case-sheets`;
      }
      return `/mrd?patient_id=${context.patientId}#case-sheets`;
    case "patient.share":
    case "patient.print_card":
      return null;
  }
}

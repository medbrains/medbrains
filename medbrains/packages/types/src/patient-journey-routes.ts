import type { ClinicalJourneyActionId, ClinicalJourneyContext } from "./event-actions.js";

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
        return `/ipd/admissions/${context.activeAdmissionId}?order=drug#prescriptions`;
      }
      if (context.activeOrderContext === "opd" && context.activeEncounterId) {
        return `/opd/encounters/${context.activeEncounterId}?order=drug#prescriptions`;
      }
      return null;
    case "orders.lab":
      if (context.activeOrderContext === "ipd" && context.activeAdmissionId) {
        return `/ipd/admissions/${context.activeAdmissionId}?order=lab#investigations`;
      }
      if (context.activeOrderContext === "opd" && context.activeEncounterId) {
        return `/opd/encounters/${context.activeEncounterId}?order=lab#investigations`;
      }
      return null;
    case "orders.radiology":
      if (context.activeOrderContext === "ipd" && context.activeAdmissionId) {
        return `/ipd/admissions/${context.activeAdmissionId}?order=radiology#investigations`;
      }
      if (context.activeOrderContext === "opd" && context.activeEncounterId) {
        return `/opd/encounters/${context.activeEncounterId}?order=radiology#investigations`;
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
        : null;
    case "camp.open_context":
      if (context.activeCampId && context.activeCampRegistrationId) {
        return `/camp/${context.activeCampId}/work/registrations/${context.activeCampRegistrationId}/clinical-route?patient_id=${context.patientId}#screenings`;
      }
      if (context.activeCampId) {
        return `/camp/${context.activeCampId}/work?patient_id=${context.patientId}#registrations`;
      }
      return `/camp?patient_id=${context.patientId}#camps`;
    case "billing.open_ledger":
      if (context.activeInvoiceId) {
        return `/billing/invoices/${context.activeInvoiceId}`;
      }
      return `/billing?tab=invoices&patient_id=${context.patientId}`;
    case "billing.prepare_discharge_bill":
      if (context.activeAdmissionId) {
        return `/billing?tab=invoices&patient_id=${context.patientId}&admission_id=${context.activeAdmissionId}&source=ipd_discharge`;
      }
      return `/billing?tab=invoices&patient_id=${context.patientId}&source=ipd_discharge`;
    case "billing.collect_payment":
      if (context.activeInvoiceId) {
        return `/billing/invoices/${context.activeInvoiceId}?action=payment`;
      }
      return `/billing?tab=invoices&patient_id=${context.patientId}&action=payment`;
    case "pharmacy.open_patient_queue":
      if (context.activePharmacyOrderId) {
        return `/pharmacy/orders/${context.activePharmacyOrderId}`;
      }
      if (context.activePharmacyRxQueueId) {
        return `/pharmacy?tab=rx-queue&rx_queue_id=${context.activePharmacyRxQueueId}&patient_id=${context.patientId}`;
      }
      return `/pharmacy?tab=rx-queue&patient_id=${context.patientId}`;
    case "pharmacy.dispense_order":
      if (context.activePharmacyOrderId) {
        return `/pharmacy/orders/${context.activePharmacyOrderId}?action=dispense`;
      }
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

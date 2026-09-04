import type { ClinicalJourneyActionId, ClinicalJourneyContext } from "./event-actions.js";

function billingInvoiceListRoute(context: ClinicalJourneyContext, action?: string): string {
  const params = [`tab=invoices`, `patient_id=${context.patientId}`];
  if (context.activeAdmissionId) {
    params.push(`admission_id=${context.activeAdmissionId}`);
  } else if (context.activeEncounterId) {
    params.push(`encounter_id=${context.activeEncounterId}`);
  }
  if (action) {
    params.push(`action=${action}`);
  }
  return `/billing?${params.join("&")}`;
}

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
    case "lab.open_order":
      // The order record, not the tenant-wide lab worklist. Without this the
      // only way back to an order was to find the patient again in a list they
      // had just come from.
      return context.activeLabOrderId ? `/lab/orders/${context.activeLabOrderId}` : null;
    case "lab.record_result":
      // `?action=` is the convention pharmacy already established for "open
      // this record with that panel expanded" — see pharmacy.dispense_order.
      return context.activeLabOrderId
        ? `/lab/orders/${context.activeLabOrderId}?action=record_result`
        : null;
    case "consent.verify":
      // Lands on the verification tab with the patient already named. The tab
      // is a UUID search box; arriving unscoped meant retyping the id of the
      // patient whose chart you just left.
      return `/consent?tab=verification&patient_id=${context.patientId}`;
    case "imaging.open_study":
      // Radiology has no per-study route — the module is tabs over a drawer —
      // so this addresses the tab and names the order the drawer should open.
      // Inventing /radiology/studies/:id would 404.
      return context.activeRadiologyOrderId
        ? `/radiology?tab=orders&order_id=${context.activeRadiologyOrderId}`
        : null;
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
      return billingInvoiceListRoute(context);
    case "billing.prepare_discharge_bill":
      if (context.activeAdmissionId) {
        return `/billing?tab=invoices&patient_id=${context.patientId}&admission_id=${context.activeAdmissionId}&source=ipd_discharge`;
      }
      return `/billing?tab=invoices&patient_id=${context.patientId}&source=ipd_discharge`;
    case "billing.collect_payment":
      if (context.activeInvoiceId) {
        return `/billing/invoices/${context.activeInvoiceId}?action=payment`;
      }
      return billingInvoiceListRoute(context, "payment");
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

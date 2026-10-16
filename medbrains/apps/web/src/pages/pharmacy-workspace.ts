import type {
  ClinicalEventName,
  ClinicalJourneyContext,
  PharmacyOrderDetailResponse,
} from "@medbrains/types";

/** The patient journey an order belongs to; none for a walk-in counter sale. */
export function pharmacyOrderJourneyContext(
  detail: PharmacyOrderDetailResponse,
): ClinicalJourneyContext | null {
  const patientId = detail.order.patient_id;
  if (!patientId) return null;
  const completedEvents: ClinicalEventName[] = ["order.created"];
  if (detail.billing_invoice_id) {
    completedEvents.push("billing.invoice.created");
  }
  if (detail.order.status === "dispensed" || detail.order.dispensed_at) {
    completedEvents.push("pharmacy.order.dispensed");
  }

  return {
    patientId,
    activeEncounterId: detail.order.encounter_id,
    activeAdmissionId: detail.admission_id,
    activeAdmissionStatus: detail.admission_id ? "admitted" : null,
    activeInvoiceId: detail.billing_invoice_id,
    activePharmacyOrderId: detail.order.id,
    activeOrderContext: detail.admission_id ? "ipd" : detail.order.encounter_id ? "opd" : null,
    completedEvents,
  };
}

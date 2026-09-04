import type { ClinicalJourneyActionId, ClinicalJourneyContext } from "./event-actions.js";
import type { PatientFlowModule } from "./patient-flow.js";

export type PatientJourneyMobileBillingParams = {
  admissionId?: string;
  encounterId?: string;
  filter?: "all" | "paid" | "pending";
  handoff?: "discharge_bill" | "payment";
  patientId?: string;
};

export type PatientJourneyMobileCareContextModule = "camp" | "emergency" | "ipd";

export type PatientJourneyMobileCareContextParams = {
  admissionId?: string;
  campId?: string;
  campRegistrationId?: string;
  erVisitId?: string;
  handoff?: "admit" | "open_admission" | "open_context" | "open_mlc" | "open_visit";
  module: PatientJourneyMobileCareContextModule;
  patientId: string;
} & Record<string, unknown>;

export type PatientJourneyMobileOrderParams = {
  admissionId?: string;
  encounterId?: string;
  orderContext?: "ipd" | "opd";
  patientId: string;
};

export type PatientJourneyMobilePharmacyParams = {
  handoff?: "dispense" | "queue";
  patientId: string;
  pharmacyOrderId?: string;
  pharmacyRxQueueId?: string;
};

export type PatientJourneyMobileTarget =
  | { screen: "BillDetail"; params: { invoiceId: string } }
  | { screen: "Billing"; params: PatientJourneyMobileBillingParams }
  | { screen: "ConsultationNotes"; params: { encounterId: string; patientId: string } }
  | { screen: "LabOrder"; params: PatientJourneyMobileOrderParams }
  | { screen: "PatientCareContext"; params: PatientJourneyMobileCareContextParams }
  | { screen: "PatientDetail"; params: { patientId: string } }
  | { screen: "PatientPharmacy"; params: PatientJourneyMobilePharmacyParams }
  | { screen: "Payment"; params: { invoiceId: string } }
  | { screen: "Prescription"; params: PatientJourneyMobileOrderParams }
  | { screen: "RadiologyOrder"; params: PatientJourneyMobileOrderParams };

function mobileOrderParams(context: ClinicalJourneyContext): PatientJourneyMobileOrderParams {
  return {
    admissionId: context.activeAdmissionId ?? undefined,
    encounterId: context.activeEncounterId ?? undefined,
    orderContext: context.activeOrderContext ?? undefined,
    patientId: context.patientId,
  };
}

function mobileBillingParams(
  context: ClinicalJourneyContext,
  params: {
    filter: "all" | "paid" | "pending";
    handoff?: "discharge_bill" | "payment";
  },
): PatientJourneyMobileBillingParams {
  return {
    admissionId: context.activeAdmissionId ?? undefined,
    encounterId: context.activeAdmissionId ? undefined : (context.activeEncounterId ?? undefined),
    filter: params.filter,
    handoff: params.handoff,
    patientId: context.patientId,
  };
}

function mobileCareContextParams(
  context: ClinicalJourneyContext,
  module: PatientJourneyMobileCareContextModule,
  handoff: PatientJourneyMobileCareContextParams["handoff"],
): PatientJourneyMobileCareContextParams {
  return {
    admissionId: module === "ipd" ? (context.activeAdmissionId ?? undefined) : undefined,
    campId: module === "camp" ? (context.activeCampId ?? undefined) : undefined,
    campRegistrationId:
      module === "camp" ? (context.activeCampRegistrationId ?? undefined) : undefined,
    erVisitId: module === "emergency" ? (context.activeEmergencyVisitId ?? undefined) : undefined,
    handoff,
    module,
    patientId: context.patientId,
  };
}

function mobilePharmacyParams(
  context: ClinicalJourneyContext,
  handoff: PatientJourneyMobilePharmacyParams["handoff"],
): PatientJourneyMobilePharmacyParams {
  return {
    handoff,
    patientId: context.patientId,
    pharmacyOrderId: context.activePharmacyOrderId ?? undefined,
    pharmacyRxQueueId: context.activePharmacyRxQueueId ?? undefined,
  };
}

export function patientJourneyMobileActionTarget(
  actionId: ClinicalJourneyActionId,
  context: ClinicalJourneyContext,
): PatientJourneyMobileTarget | null {
  switch (actionId) {
    case "billing.collect_payment":
      return context.activeInvoiceId
        ? { screen: "Payment", params: { invoiceId: context.activeInvoiceId } }
        : {
            screen: "Billing",
            params: mobileBillingParams(context, { filter: "pending", handoff: "payment" }),
          };
    case "billing.open_ledger":
      return context.activeInvoiceId
        ? { screen: "BillDetail", params: { invoiceId: context.activeInvoiceId } }
        : { screen: "Billing", params: mobileBillingParams(context, { filter: "all" }) };
    case "billing.prepare_discharge_bill":
      return {
        screen: "Billing",
        params: mobileBillingParams(context, { filter: "pending", handoff: "discharge_bill" }),
      };
    case "camp.open_context":
      return {
        screen: "PatientCareContext",
        params: mobileCareContextParams(context, "camp", "open_context"),
      };
    case "emergency.open_mlc":
      return {
        screen: "PatientCareContext",
        params: mobileCareContextParams(context, "emergency", "open_mlc"),
      };
    case "emergency.open_visit":
      return {
        screen: "PatientCareContext",
        params: mobileCareContextParams(context, "emergency", "open_visit"),
      };
    case "lab.open_order":
    case "lab.record_result":
      // No lab order screen on mobile. Returning null keeps the action off the
      // phone rather than routing it somewhere that cannot show an order.
      return null;
    case "ipd.admit":
      return {
        screen: "PatientCareContext",
        params: mobileCareContextParams(context, "ipd", "admit"),
      };
    case "ipd.open_admission":
      return {
        screen: "PatientCareContext",
        params: mobileCareContextParams(context, "ipd", "open_admission"),
      };
    case "opd.open_visit":
      return {
        screen: "ConsultationNotes",
        params: { encounterId: context.activeEncounterId ?? "", patientId: context.patientId },
      };
    case "orders.medication":
      return { screen: "Prescription", params: mobileOrderParams(context) };
    case "orders.lab":
      return { screen: "LabOrder", params: mobileOrderParams(context) };
    case "orders.radiology":
      return { screen: "RadiologyOrder", params: mobileOrderParams(context) };
    case "pharmacy.dispense_order":
      return { screen: "PatientPharmacy", params: mobilePharmacyParams(context, "dispense") };
    case "pharmacy.open_patient_queue":
      return { screen: "PatientPharmacy", params: mobilePharmacyParams(context, "queue") };
    case "patient.edit":
    case "patient.print_card":
    case "patient.share":
    case "mrd.open_case_sheet":
      return null;
  }
}

export function patientFlowMobileTarget(
  module: PatientFlowModule,
  context: ClinicalJourneyContext,
): PatientJourneyMobileTarget {
  switch (module) {
    case "patient":
      return { screen: "PatientDetail", params: { patientId: context.patientId } };
    case "opd":
      return {
        screen: "ConsultationNotes",
        params: { encounterId: context.activeEncounterId ?? "", patientId: context.patientId },
      };
    case "ipd":
      return {
        screen: "PatientCareContext",
        params: mobileCareContextParams(
          context,
          "ipd",
          context.activeAdmissionId ? "open_admission" : "admit",
        ),
      };
    case "emergency":
      return {
        screen: "PatientCareContext",
        params: mobileCareContextParams(context, "emergency", "open_visit"),
      };
    case "camp":
      return {
        screen: "PatientCareContext",
        params: mobileCareContextParams(context, "camp", "open_context"),
      };
    case "pharmacy":
      return { screen: "PatientPharmacy", params: mobilePharmacyParams(context, "queue") };
    case "billing":
      return context.activeInvoiceId
        ? { screen: "BillDetail", params: { invoiceId: context.activeInvoiceId } }
        : { screen: "Billing", params: mobileBillingParams(context, { filter: "all" }) };
  }
}

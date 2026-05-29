import type { logicalPrinterProfileValues, printCopyModeValues } from "@medbrains/schemas";

export type PrintCopyType = (typeof printCopyModeValues)[number];
export type LogicalPrinterProfile = (typeof logicalPrinterProfileValues)[number];

export interface PrintCopyRoute {
  label: string;
  copyType: PrintCopyType;
  printerProfile: LogicalPrinterProfile;
  printerLabel: string;
}

export interface PrintCopyPacketPolicy {
  requiredCopies: readonly PrintCopyType[];
  customerOfficeRequired: boolean;
  exemptionReason?: string;
}

export const PRINT_COPY_ROUTES = {
  billingInvoiceCustomer: {
    label: "Customer copy",
    copyType: "customer",
    printerProfile: "billing-a4",
    printerLabel: "Billing A4 / receipt counter",
  },
  billingInvoiceOffice: {
    label: "Office copy",
    copyType: "office",
    printerProfile: "billing-a4",
    printerLabel: "Billing A4 / accounts printer",
  },
  billingReceiptCustomer: {
    label: "Customer copy",
    copyType: "customer",
    printerProfile: "billing-receipt-80mm",
    printerLabel: "Billing receipt 80mm",
  },
  billingReceiptOffice: {
    label: "Office copy",
    copyType: "office",
    printerProfile: "billing-a4",
    printerLabel: "Billing A4 / accounts printer",
  },
  ipdAdmissionCustomer: {
    label: "Customer / attender copy",
    copyType: "customer",
    printerProfile: "ipd-a4",
    printerLabel: "IPD A4 / admission desk printer",
  },
  ipdAdmissionOffice: {
    label: "Office copy",
    copyType: "office",
    printerProfile: "ipd-a4",
    printerLabel: "IPD A4 / admission desk printer",
  },
  ipdAdmissionClinical: {
    label: "Clinical copy",
    copyType: "clinical",
    printerProfile: "ipd-a4",
    printerLabel: "IPD A4 / ward printer",
  },
  ipdAdmissionMrd: {
    label: "MRD copy",
    copyType: "mrd",
    printerProfile: "mrd-record-room",
    printerLabel: "MRD record room printer",
  },
  labCustomer: {
    label: "Customer lab report copy",
    copyType: "customer",
    printerProfile: "lab-report-a4",
    printerLabel: "Lab report A4",
  },
  labOffice: {
    label: "Office copy",
    copyType: "office",
    printerProfile: "lab-report-a4",
    printerLabel: "Lab report A4",
  },
  labArchive: {
    label: "Lab copy",
    copyType: "lab",
    printerProfile: "lab-report-a4",
    printerLabel: "Lab report A4",
  },
  mlcOffice: {
    label: "Office copy",
    copyType: "office",
    printerProfile: "emergency-a4",
    printerLabel: "Emergency A4",
  },
  mlcClinical: {
    label: "Clinical copy",
    copyType: "clinical",
    printerProfile: "emergency-a4",
    printerLabel: "Emergency A4",
  },
  mlcPolice: {
    label: "Police copy",
    copyType: "police",
    printerProfile: "mlc-secure-printer",
    printerLabel: "MLC secure printer",
  },
  mlcMrd: {
    label: "MRD copy",
    copyType: "mrd",
    printerProfile: "mrd-record-room",
    printerLabel: "MRD record room printer",
  },
  mlcDuplicate: {
    label: "Duplicate / reprint copy",
    copyType: "duplicate",
    printerProfile: "mlc-secure-printer",
    printerLabel: "MLC secure printer",
  },
  mrdPacket: {
    label: "MRD copy",
    copyType: "mrd",
    printerProfile: "mrd-a4",
    printerLabel: "MRD A4",
  },
  mrdOffice: {
    label: "Office tracking copy",
    copyType: "office",
    printerProfile: "mrd-record-room",
    printerLabel: "MRD record room printer",
  },
  mrdClinical: {
    label: "Clinical copy",
    copyType: "clinical",
    printerProfile: "mrd-a4",
    printerLabel: "MRD A4",
  },
  mrdDuplicate: {
    label: "Duplicate / reprint copy",
    copyType: "duplicate",
    printerProfile: "mrd-record-room",
    printerLabel: "MRD record room printer",
  },
  patientCardCustomer: {
    label: "Customer patient card copy",
    copyType: "customer",
    printerProfile: "patient-card",
    printerLabel: "Patient card",
  },
  patientCardOffice: {
    label: "Office registration copy",
    copyType: "office",
    printerProfile: "registration-a4",
    printerLabel: "Registration A4",
  },
  pharmacyLabelCustomer: {
    label: "Customer medicine-label copy",
    copyType: "customer",
    printerProfile: "pharmacy-drug-label",
    printerLabel: "Pharmacy drug label printer",
  },
  pharmacyLabelAudit: {
    label: "Pharmacy copy",
    copyType: "pharmacy",
    printerProfile: "pharmacy-drug-label",
    printerLabel: "Pharmacy drug label printer",
  },
  pharmacyLabelOffice: {
    label: "Office copy",
    copyType: "office",
    printerProfile: "pharmacy-receipt-80mm",
    printerLabel: "Pharmacy receipt / dispensing printer",
  },
  prescriptionCustomer: {
    label: "Customer copy",
    copyType: "customer",
    printerProfile: "opd-a4",
    printerLabel: "OPD A4 / prescription printer",
  },
  prescriptionOffice: {
    label: "Office copy",
    copyType: "office",
    printerProfile: "opd-a4",
    printerLabel: "OPD A4 / office printer",
  },
  prescriptionPharmacy: {
    label: "Pharmacy copy",
    copyType: "pharmacy",
    printerProfile: "pharmacy-drug-label",
    printerLabel: "Pharmacy label or dispensing printer",
  },
  radiologyCustomer: {
    label: "Customer radiology report copy",
    copyType: "customer",
    printerProfile: "radiology-report-a4",
    printerLabel: "Radiology report A4",
  },
  radiologyOffice: {
    label: "Office copy",
    copyType: "office",
    printerProfile: "radiology-report-a4",
    printerLabel: "Radiology report A4",
  },
  radiologyClinical: {
    label: "Clinical copy",
    copyType: "clinical",
    printerProfile: "radiology-report-a4",
    printerLabel: "Radiology report A4",
  },
  visitSummaryCustomer: {
    label: "Customer copy",
    copyType: "customer",
    printerProfile: "opd-summary",
    printerLabel: "OPD summary A4",
  },
  visitSummaryOffice: {
    label: "Office copy",
    copyType: "office",
    printerProfile: "opd-a4",
    printerLabel: "OPD A4 / office printer",
  },
  visitSummaryClinical: {
    label: "Clinical copy",
    copyType: "clinical",
    printerProfile: "opd-summary",
    printerLabel: "OPD summary A4",
  },
  visitSummaryMrd: {
    label: "MRD copy",
    copyType: "mrd",
    printerProfile: "mrd-record-room",
    printerLabel: "MRD record room printer",
  },
  wristbandClinical: {
    label: "Clinical copy",
    copyType: "clinical",
    printerProfile: "wristband-label",
    printerLabel: "Wristband label printer",
  },
} as const satisfies Record<string, PrintCopyRoute>;

export const PRINT_COPY_PACKETS = {
  billingInvoice: [
    PRINT_COPY_ROUTES.billingInvoiceCustomer,
    PRINT_COPY_ROUTES.billingInvoiceOffice,
  ],
  billingReceipt: [
    PRINT_COPY_ROUTES.billingReceiptCustomer,
    PRINT_COPY_ROUTES.billingReceiptOffice,
  ],
  ipdAdmission: [
    PRINT_COPY_ROUTES.ipdAdmissionCustomer,
    PRINT_COPY_ROUTES.ipdAdmissionOffice,
    PRINT_COPY_ROUTES.ipdAdmissionClinical,
    PRINT_COPY_ROUTES.ipdAdmissionMrd,
  ],
  labReport: [
    PRINT_COPY_ROUTES.labCustomer,
    PRINT_COPY_ROUTES.labOffice,
    PRINT_COPY_ROUTES.labArchive,
  ],
  mlcPacket: [
    PRINT_COPY_ROUTES.mlcOffice,
    PRINT_COPY_ROUTES.mlcClinical,
    PRINT_COPY_ROUTES.mlcPolice,
    PRINT_COPY_ROUTES.mlcMrd,
  ],
  mlcPoliceIntimation: [
    PRINT_COPY_ROUTES.mlcPolice,
    PRINT_COPY_ROUTES.mlcOffice,
    PRINT_COPY_ROUTES.mlcMrd,
  ],
  mlcReprint: [PRINT_COPY_ROUTES.mlcDuplicate],
  mrdCaseSheet: [
    PRINT_COPY_ROUTES.mrdPacket,
    PRINT_COPY_ROUTES.mrdOffice,
    PRINT_COPY_ROUTES.mrdClinical,
  ],
  mrdCaseSheetReprint: [PRINT_COPY_ROUTES.mrdDuplicate],
  patientCard: [PRINT_COPY_ROUTES.patientCardCustomer, PRINT_COPY_ROUTES.patientCardOffice],
  pharmacyLabel: [
    PRINT_COPY_ROUTES.pharmacyLabelCustomer,
    PRINT_COPY_ROUTES.pharmacyLabelOffice,
    PRINT_COPY_ROUTES.pharmacyLabelAudit,
  ],
  prescription: [
    PRINT_COPY_ROUTES.prescriptionCustomer,
    PRINT_COPY_ROUTES.prescriptionOffice,
    PRINT_COPY_ROUTES.prescriptionPharmacy,
  ],
  radiologyReport: [
    PRINT_COPY_ROUTES.radiologyCustomer,
    PRINT_COPY_ROUTES.radiologyOffice,
    PRINT_COPY_ROUTES.radiologyClinical,
  ],
  visitSummary: [
    PRINT_COPY_ROUTES.visitSummaryCustomer,
    PRINT_COPY_ROUTES.visitSummaryOffice,
    PRINT_COPY_ROUTES.visitSummaryClinical,
    PRINT_COPY_ROUTES.visitSummaryMrd,
  ],
  wristband: [PRINT_COPY_ROUTES.wristbandClinical],
} as const satisfies Record<string, readonly PrintCopyRoute[]>;

export type PrintCopyPacketName = keyof typeof PRINT_COPY_PACKETS;

export const PRINT_COPY_PACKET_POLICIES: Record<PrintCopyPacketName, PrintCopyPacketPolicy> = {
  billingInvoice: {
    requiredCopies: ["customer", "office"],
    customerOfficeRequired: true,
  },
  billingReceipt: {
    requiredCopies: ["customer", "office"],
    customerOfficeRequired: true,
  },
  ipdAdmission: {
    requiredCopies: ["customer", "office", "clinical", "mrd"],
    customerOfficeRequired: true,
  },
  labReport: {
    requiredCopies: ["customer", "office", "lab"],
    customerOfficeRequired: true,
  },
  mlcPacket: {
    requiredCopies: ["office", "clinical", "police", "mrd"],
    customerOfficeRequired: false,
    exemptionReason:
      "Medico-legal packets route to office, clinical, police, and MRD custody; patient copies use records-release control.",
  },
  mlcPoliceIntimation: {
    requiredCopies: ["police", "office", "mrd"],
    customerOfficeRequired: false,
    exemptionReason: "Police intimation is a legal dispatch record and is not a customer copy.",
  },
  mlcReprint: {
    requiredCopies: ["duplicate"],
    customerOfficeRequired: false,
    exemptionReason: "Audited reprints are duplicate-only with a reason.",
  },
  mrdCaseSheet: {
    requiredCopies: ["mrd", "office", "clinical"],
    customerOfficeRequired: false,
    exemptionReason:
      "MRD case sheets are custody-controlled clinical records; patient copies use records-release control.",
  },
  mrdCaseSheetReprint: {
    requiredCopies: ["duplicate"],
    customerOfficeRequired: false,
    exemptionReason: "Audited MRD reprints are duplicate-only with a reason.",
  },
  patientCard: {
    requiredCopies: ["customer", "office"],
    customerOfficeRequired: true,
  },
  pharmacyLabel: {
    requiredCopies: ["customer", "office", "pharmacy"],
    customerOfficeRequired: true,
  },
  prescription: {
    requiredCopies: ["customer", "office", "pharmacy"],
    customerOfficeRequired: true,
  },
  radiologyReport: {
    requiredCopies: ["customer", "office", "clinical"],
    customerOfficeRequired: true,
  },
  visitSummary: {
    requiredCopies: ["customer", "office", "clinical", "mrd"],
    customerOfficeRequired: true,
  },
  wristband: {
    requiredCopies: ["clinical"],
    customerOfficeRequired: false,
    exemptionReason: "Wristbands are care-team identity labels, not customer-facing documents.",
  },
};

export function printCopyRouteLabel(copy: PrintCopyRoute) {
  return `${copy.label} · ${copy.printerLabel}`;
}

export function printCopyPrinterLabel(copy: PrintCopyRoute) {
  return `${copy.printerLabel} (${copy.printerProfile})`;
}

export function getPrintCopyPacketGaps(packetName: PrintCopyPacketName) {
  const policy = PRINT_COPY_PACKET_POLICIES[packetName];
  const copies = PRINT_COPY_PACKETS[packetName];
  const copyTypes = new Set(copies.map((copy) => copy.copyType));
  const missingCopies = policy.requiredCopies.filter((copyType) => !copyTypes.has(copyType));
  const missingPrinterProfiles = copies
    .filter((copy) => copy.printerProfile.length === 0 || copy.printerLabel.length === 0)
    .map((copy) => copy.label);
  const missingCustomerOffice =
    policy.customerOfficeRequired && (!copyTypes.has("customer") || !copyTypes.has("office"));

  return {
    missingCopies,
    missingPrinterProfiles,
    missingCustomerOffice,
  };
}

function escapePrintHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char] ?? char;
  });
}

export function copyPrintStyles() {
  return `
    .copy-page { page-break-after: always; }
    .copy-page:last-child { page-break-after: auto; }
    .copy-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid #999;
      border-radius: 4px;
      padding: 6px 10px;
      margin-bottom: 10px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .copy-printer {
      color: #555;
      font-weight: 600;
      text-transform: none;
      letter-spacing: 0;
    }
  `;
}

export function buildCopyPrintHtml(contentHtml: string, copies: readonly PrintCopyRoute[]) {
  return copies
    .map(
      (copy) => `
        <section class="copy-page">
          <div class="copy-meta">
            <span>${escapePrintHtml(copy.label)}</span>
            <span class="copy-printer">${escapePrintHtml(printCopyPrinterLabel(copy))}</span>
          </div>
          ${contentHtml}
        </section>
      `,
    )
    .join("");
}

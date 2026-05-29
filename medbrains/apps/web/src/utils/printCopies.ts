export interface PrintCopyRoute {
  label: string;
  printerProfile: string;
}

export const PRINT_COPY_ROUTES = {
  billingInvoiceCustomer: {
    label: "Customer copy",
    printerProfile: "Billing A4 / receipt counter",
  },
  billingInvoiceOffice: { label: "Office copy", printerProfile: "Billing A4 / accounts printer" },
  billingReceiptCustomer: { label: "Customer copy", printerProfile: "Billing receipt 80mm" },
  billingReceiptOffice: { label: "Office copy", printerProfile: "Billing A4 / accounts printer" },
  ipdAdmissionCustomer: {
    label: "Customer / attender copy",
    printerProfile: "IPD A4 / admission desk printer",
  },
  ipdAdmissionOffice: { label: "Office copy", printerProfile: "IPD A4 / admission desk printer" },
  ipdAdmissionClinical: { label: "Clinical copy", printerProfile: "IPD A4 / ward printer" },
  ipdAdmissionMrd: { label: "MRD copy", printerProfile: "MRD record room printer" },
  labCustomer: { label: "Customer lab report copy", printerProfile: "lab-report-a4" },
  labArchive: { label: "Lab archive copy", printerProfile: "lab-report-a4" },
  labOffice: { label: "Office copy", printerProfile: "lab-report-a4" },
  mlcOffice: { label: "Office copy", printerProfile: "Emergency A4" },
  mlcPolice: { label: "Police copy", printerProfile: "MLC secure printer" },
  mlcMrd: { label: "MRD copy", printerProfile: "MRD record room printer" },
  mlcDuplicate: { label: "Duplicate / reprint copy", printerProfile: "MLC secure printer" },
  mrdPacket: { label: "MRD copy", printerProfile: "MRD A4" },
  mrdOffice: { label: "Office tracking copy", printerProfile: "MRD record room printer" },
  mrdDuplicate: { label: "Duplicate / reprint copy", printerProfile: "MRD record room printer" },
  patientCardCustomer: { label: "Customer patient card copy", printerProfile: "patient-card" },
  patientCardOffice: { label: "Office registration copy", printerProfile: "registration-a4" },
  pharmacyLabelCustomer: {
    label: "Customer medicine-label copy",
    printerProfile: "Pharmacy drug label printer",
  },
  pharmacyLabelAudit: {
    label: "Pharmacy audit copy",
    printerProfile: "Pharmacy receipt / dispensing printer",
  },
  prescriptionCustomer: { label: "Customer copy", printerProfile: "OPD A4 / prescription printer" },
  prescriptionOfficePharmacy: {
    label: "Office / pharmacy copy",
    printerProfile: "Pharmacy label or dispensing printer",
  },
  radiologyCustomer: {
    label: "Customer radiology report copy",
    printerProfile: "radiology-report-a4",
  },
  radiologyClinical: { label: "Clinical copy", printerProfile: "radiology-report-a4" },
  radiologyOffice: { label: "Office copy", printerProfile: "radiology-report-a4" },
  visitSummaryCustomer: { label: "Customer copy", printerProfile: "OPD summary A4" },
  visitSummaryOffice: { label: "Office copy", printerProfile: "OPD A4 / office printer" },
  visitSummaryMrd: { label: "MRD copy", printerProfile: "MRD record room printer" },
  wristbandClinical: { label: "Clinical copy", printerProfile: "Wristband label printer" },
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
    PRINT_COPY_ROUTES.labArchive,
    PRINT_COPY_ROUTES.labOffice,
  ],
  mlcPacket: [PRINT_COPY_ROUTES.mlcOffice, PRINT_COPY_ROUTES.mlcPolice, PRINT_COPY_ROUTES.mlcMrd],
  mlcPoliceIntimation: [
    PRINT_COPY_ROUTES.mlcPolice,
    PRINT_COPY_ROUTES.mlcOffice,
    PRINT_COPY_ROUTES.mlcMrd,
  ],
  mlcReprint: [PRINT_COPY_ROUTES.mlcDuplicate],
  mrdCaseSheet: [PRINT_COPY_ROUTES.mrdPacket, PRINT_COPY_ROUTES.mrdOffice],
  mrdCaseSheetReprint: [PRINT_COPY_ROUTES.mrdDuplicate],
  patientCard: [PRINT_COPY_ROUTES.patientCardCustomer, PRINT_COPY_ROUTES.patientCardOffice],
  pharmacyLabel: [PRINT_COPY_ROUTES.pharmacyLabelCustomer, PRINT_COPY_ROUTES.pharmacyLabelAudit],
  prescription: [
    PRINT_COPY_ROUTES.prescriptionCustomer,
    PRINT_COPY_ROUTES.prescriptionOfficePharmacy,
  ],
  radiologyReport: [
    PRINT_COPY_ROUTES.radiologyCustomer,
    PRINT_COPY_ROUTES.radiologyClinical,
    PRINT_COPY_ROUTES.radiologyOffice,
  ],
  visitSummary: [
    PRINT_COPY_ROUTES.visitSummaryCustomer,
    PRINT_COPY_ROUTES.visitSummaryOffice,
    PRINT_COPY_ROUTES.visitSummaryMrd,
  ],
  wristband: [PRINT_COPY_ROUTES.wristbandClinical],
} as const satisfies Record<string, readonly PrintCopyRoute[]>;

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
            <span class="copy-printer">${escapePrintHtml(copy.printerProfile)}</span>
          </div>
          ${contentHtml}
        </section>
      `,
    )
    .join("");
}

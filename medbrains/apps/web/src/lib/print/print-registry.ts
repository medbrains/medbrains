import { api } from "@medbrains/api";
import { P } from "@medbrains/types";
import { GENERATED_PRINT_DOCUMENTS, type GeneratedPrintIdKind } from "./print-registry.generated";

/**
 * Every document this system can print, and how to get its data.
 *
 * The pieces were all here and unconnected: ~50 `print-data` endpoints that
 * return the fields of a document, a template-driven `DocumentRenderer`, and a
 * document-template admin screen. Nothing joined them, so none of these
 * documents could be printed from anywhere.
 *
 * `idKind` is not decoration. These endpoints take different things — an
 * admission, an OT booking, a patient, a consent record — and handing the
 * wrong one produces either a 404 or, worse, somebody else's document.
 */
export type PrintDocumentIdKind =
  | "admission"
  | "booking"
  | "patient"
  | "consent"
  | "enrollment"
  | "video_consent"
  /** A lab order and a radiology order are both "an order" and neither
   *  endpoint accepts the other's id, so they are distinct kinds. */
  | "lab_order"
  | "radiology_order"
  | "order"
  | "invoice"
  | "payment"
  /** A pharmacy counter sale (`pharmacy_pos_sales.id`). */
  | "pos_sale"
  /** Everything else, one kind per record a generated document keys on. */
  | GeneratedPrintIdKind;

export interface PrintDocumentDef {
  /** Stable key used by the single print command. */
  key: string;
  label: string;
  idKind: PrintDocumentIdKind;
  /** The permission the *server* enforces. Gating the control on the same
   *  code stops us offering a button the server will refuse. */
  permission: string;
  fetch: (id: string) => Promise<unknown>;
}

/**
 * Statutory consent forms. Fourteen of these had a data endpoint and no
 * renderer of any kind, which for a consent form means the signed paper a
 * hospital is required to hold could not be produced from the system holding
 * the consent.
 */
export const PRINT_DOCUMENTS: readonly PrintDocumentDef[] = [
  {
    key: "consent.general",
    label: "General consent",
    idKind: "admission",
    permission: P.IPD.ADMISSIONS_VIEW,
    fetch: (id) => api.getGeneralConsentPrintData(id),
  },
  {
    key: "consent.surgical",
    label: "Surgical consent",
    idKind: "booking",
    permission: P.IPD.ADMISSIONS_VIEW,
    fetch: (id) => api.getSurgicalConsentPrintData(id),
  },
  {
    key: "consent.anesthesia",
    label: "Anaesthesia consent",
    idKind: "booking",
    permission: P.IPD.ADMISSIONS_VIEW,
    fetch: (id) => api.getAnesthesiaConsentPrintData(id),
  },
  {
    key: "consent.blood",
    label: "Blood transfusion consent",
    idKind: "admission",
    permission: P.IPD.ADMISSIONS_VIEW,
    fetch: (id) => api.getBloodConsentPrintData(id),
  },
  {
    key: "consent.dnr",
    label: "DNR / DNAR",
    idKind: "admission",
    permission: P.IPD.ADMISSIONS_VIEW,
    fetch: (id) => api.getDnrConsentPrintData(id),
  },
  {
    key: "consent.ama",
    label: "Discharge against medical advice",
    idKind: "admission",
    permission: P.IPD.ADMISSIONS_VIEW,
    fetch: (id) => api.getAmaConsentPrintData(id),
  },
  {
    key: "consent.hiv",
    label: "HIV testing consent",
    idKind: "patient",
    permission: P.PATIENTS.VIEW,
    fetch: (id) => api.getHivConsentPrintData(id),
  },
  {
    key: "consent.photo",
    label: "Photography consent",
    idKind: "patient",
    permission: P.PATIENTS.VIEW,
    fetch: (id) => api.getPhotoConsentPrintData(id),
  },
  {
    key: "consent.organ_donation",
    label: "Organ donation consent",
    idKind: "patient",
    permission: P.PATIENTS.VIEW,
    fetch: (id) => api.getOrganDonationConsentPrintData(id),
  },
  {
    key: "consent.abdm",
    label: "ABDM linkage consent",
    idKind: "patient",
    permission: P.PATIENTS.VIEW,
    fetch: (id) => api.getAbdmConsentPrintData(id),
  },
  {
    key: "consent.teaching",
    label: "Teaching consent",
    idKind: "admission",
    permission: P.IPD.ADMISSIONS_VIEW,
    fetch: (id) => api.getTeachingConsentPrintData(id),
  },
  {
    key: "gst-invoice",
    label: "GST bill",
    idKind: "invoice",
    // The handler also requires patients.view, which every role holding
    // billing.invoices.view is granted.
    permission: P.BILLING.INVOICES_VIEW,
    fetch: (id) => api.getGstInvoicePrintData(id),
  },
  {
    key: "pharmacy-bill",
    label: "Pharmacy GST bill",
    idKind: "invoice",
    // Literal until the permission catalogue is regenerated from Rust.
    permission: P.PHARMACY.BILLS_PRINT,
    fetch: (id) => api.getPharmacyBillPrintData(id),
  },
  {
    key: "pharmacy-pos-receipt",
    label: "Counter receipt",
    idKind: "pos_sale",
    permission: P.PHARMACY.POS_VIEW,
    fetch: fetchPosReceipt,
  },
];

/**
 * A counter sale's receipt. A walk-in sale has no billing invoice, so the GST
 * bill cannot serve; this reads the sale and its lines.
 */
async function fetchPosReceipt(saleId: string) {
  const [sale, items] = await Promise.all([api.getPosSale(saleId), api.listPosSaleItems(saleId)]);
  const mrpTotal = items.reduce((sum, item) => sum + Number(item.mrp) * item.quantity, 0);
  const savings = mrpTotal - Number(sale.total_amount);
  return {
    receipt_number: sale.receipt_number ?? sale.sale_number,
    date: new Date(sale.created_at).toLocaleString(),
    customer: sale.patient_name ?? "Walk-in",
    payment_mode: sale.payment_mode,
    payment_reference: sale.payment_reference ?? null,
    mrp_total: mrpTotal.toFixed(2),
    discount: sale.discount_amount,
    gst_included: sale.gst_amount,
    total: sale.total_amount,
    you_saved: savings > 0.005 ? savings.toFixed(2) : null,
    amount_received: sale.amount_received,
    change_due: sale.change_due,
    items: items.map((item) => ({
      medicine: item.drug_name,
      batch: item.batch_number ?? null,
      hsn: item.hsn_code ?? null,
      quantity: item.quantity,
      mrp: item.mrp,
      price: item.selling_price,
      gst_percent: item.gst_rate,
      line_total: item.line_total,
    })),
  };
}

/**
 * Every printable document: the eleven consents written by hand above, plus
 * the 106 generated from the Rust handlers. Generated rather than typed out
 * because each entry's permission must be the one its own handler enforces,
 * and getting 106 of those right by hand is a guarantee of getting some wrong.
 */
export const ALL_PRINT_DOCUMENTS: readonly PrintDocumentDef[] = [
  ...PRINT_DOCUMENTS,
  ...GENERATED_PRINT_DOCUMENTS,
];

const BY_KEY = new Map(ALL_PRINT_DOCUMENTS.map((doc) => [doc.key, doc]));

export function printDocumentDef(key: string): PrintDocumentDef | undefined {
  return BY_KEY.get(key);
}

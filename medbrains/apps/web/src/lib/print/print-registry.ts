import { api } from "@medbrains/api";
import { P } from "@medbrains/types";
import { GENERATED_PRINT_DOCUMENTS } from "./print-registry.generated";

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
  | "order"
  | "invoice"
  | "payment"
  /** Anything else the endpoint keys on — an incident, a claim, a contract. */
  | "record";

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
];

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

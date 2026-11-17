import type { OpdCardPrintData, OpdCardVisit } from "@medbrains/types";
import { esc } from "./print-html";
import { qrSvgMarkup } from "./qr-svg";

/**
 * The OPD card, drawn: the patient's identity under the hospital's own
 * letterhead, a QR of the UHID for the next counter's scanner, and the visit's
 * token when it is printed for one.
 *
 * Two papers. A CR80 card (85.6 x 54 mm, the size of a bank card) for the
 * patient's wallet, and a half-A4 slip (A5 landscape) for the counter's
 * ordinary printer. Identity and logistics only: no diagnosis or allergy,
 * because the card is shown at every counter in the hospital.
 */
export type OpdCardFormat = "slip" | "id-card";

export const OPD_CARD_FORMATS: readonly { value: OpdCardFormat; label: string }[] = [
  { value: "slip", label: "OPD slip (half A4)" },
  { value: "id-card", label: "ID card (CR80)" },
];

export interface PrintPage {
  css: string;
  body: string;
}

/** "male" -> "Male": the enum as a person reads it. */
function genderLabel(gender: string): string {
  return gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : "";
}

/** The letterhead: logo if set, name, then address, phone and registration. */
function letterhead(data: OpdCardPrintData): string {
  const logo = data.hospital_logo_url
    ? `<img class="logo" src="${esc(data.hospital_logo_url)}" alt="" onerror="this.remove()">`
    : "";
  const contact = [
    data.hospital_address,
    data.hospital_phone ? `Ph ${data.hospital_phone}` : null,
    data.hospital_registration_no ? `Reg. no. ${data.hospital_registration_no}` : null,
  ]
    .filter(Boolean)
    .map((part) => esc(part))
    .join(" · ");
  return (
    `<header class="head">${logo}<div class="head-text">` +
    `<div class="hospital">${esc(data.hospital_name)}</div>` +
    (contact ? `<div class="contact">${contact}</div>` : "") +
    `</div></header>`
  );
}

/** Name, UHID, age and sex, phone, address; the QR beside them. */
function patientBlock(data: OpdCardPrintData, qrSize: number): string {
  const ageSex = [data.age, genderLabel(data.gender)].filter(Boolean).join(" / ");
  const address = data.address ? `<div class="line">${esc(data.address)}</div>` : "";
  return (
    `<section class="patient"><div class="who">` +
    `<div class="name">${esc(data.patient_name)}</div>` +
    `<div class="uhid"><span class="label">UHID</span> ${esc(data.uhid)}</div>` +
    `<div class="line">${esc(ageSex)} · Ph ${esc(data.phone)}</div>${address}` +
    `</div><div class="qr" aria-label="UHID ${esc(data.uhid)}">` +
    `${qrSvgMarkup(data.uhid, qrSize)}</div></section>`
  );
}

/** One labelled value in the visit strip. */
function field(label: string, value: string | null | undefined): string {
  return `<div class="field"><span class="label">${esc(label)}</span><span>${esc(value)}</span></div>`;
}

/** Token, date and time, department, doctor and new-or-repeat. */
function visitBlock(visit: OpdCardVisit): string {
  return (
    `<section class="visit"><div class="token"><span class="label">Token</span>` +
    `<span class="token-number">${esc(visit.token_number)}</span></div>` +
    `<div class="fields">` +
    field("Visit", `${visit.visit_date} ${visit.visit_time}`) +
    field("Type", visit.is_repeat ? "Repeat" : "New") +
    field("Department", visit.department) +
    field("Doctor", visit.doctor) +
    `</div></section>`
  );
}

const SHARED_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "IBM Plex Sans", "MedBrains Sans", system-ui, sans-serif; color: #161616; }
  .card { border: 1px solid #161616; display: flex; flex-direction: column; }
  .head { display: flex; align-items: center; border-bottom: 1px solid #161616; }
  .logo { object-fit: contain; }
  .hospital { font-weight: 700; }
  .contact { color: #393939; }
  .patient { display: flex; justify-content: space-between; align-items: center; flex: 1; }
  .name { font-weight: 600; }
  .uhid { font-family: "IBM Plex Mono", ui-monospace, monospace; font-weight: 700; }
  .label { color: #525252; text-transform: uppercase; letter-spacing: 0.04em; margin-right: 4px; }
  .qr svg { display: block; width: 100%; height: 100%; }
  .visit { display: flex; border-top: 1px solid #c6c6c6; }
  .token { display: flex; flex-direction: column; border-right: 1px solid #c6c6c6; }
  .token-number { font-family: "IBM Plex Mono", ui-monospace, monospace; font-weight: 700; }
  .fields { display: grid; grid-template-columns: 1fr 1fr; flex: 1; }
  .field { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  @media print { .card { break-inside: avoid; } }
`;

const SLIP_CSS = `
  @page { size: A5 landscape; margin: 8mm; }
  .card { width: 194mm; height: 132mm; padding: 6mm; gap: 4mm; font-size: 11pt; }
  .head { gap: 4mm; padding-bottom: 3mm; }
  .logo { max-height: 16mm; max-width: 30mm; }
  .hospital { font-size: 18pt; }
  .contact { font-size: 9pt; margin-top: 1mm; }
  .name { font-size: 20pt; }
  .uhid { font-size: 22pt; margin: 2mm 0; }
  .line { margin-top: 1.5mm; font-size: 13pt; }
  .label { font-size: 8pt; }
  .qr { width: 42mm; height: 42mm; }
  .visit { padding-top: 3mm; gap: 5mm; }
  .token { padding-right: 5mm; min-width: 34mm; }
  .token-number { font-size: 28pt; }
  .fields { gap: 2mm 6mm; }
`;

const ID_CARD_CSS = `
  @page { size: 85.6mm 54mm; margin: 0; }
  .card { width: 85.6mm; height: 54mm; padding: 2.5mm; gap: 1.2mm; font-size: 6.5pt; border: 0; }
  .head { gap: 1.5mm; padding-bottom: 1mm; }
  .logo { max-height: 7mm; max-width: 14mm; }
  .hospital { font-size: 8.5pt; line-height: 1.1; }
  .contact { font-size: 5pt; line-height: 1.25; max-height: 2.5em; overflow: hidden; }
  .name { font-size: 8pt; }
  .uhid { font-size: 9pt; }
  .label { font-size: 4.5pt; }
  .line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60mm; }
  .qr { width: 15mm; height: 15mm; flex: none; }
  .visit { padding-top: 1mm; gap: 2mm; }
  .token { padding-right: 2mm; }
  .token-number { font-size: 12pt; }
  .fields { grid-template-columns: 1fr; font-size: 5.5pt; }
`;

/** The page for `data` on the paper `format` names. */
export function renderOpdCard(data: OpdCardPrintData, format: OpdCardFormat = "slip"): PrintPage {
  const isCard = format === "id-card";
  const visit = data.visit ? visitBlock(data.visit) : "";
  return {
    css: SHARED_CSS + (isCard ? ID_CARD_CSS : SLIP_CSS),
    body:
      `<main class="card ${isCard ? "id-card" : "slip"}">` +
      letterhead(data) +
      patientBlock(data, isCard ? 96 : 160) +
      visit +
      `</main>`,
  };
}

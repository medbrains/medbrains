import { blue, ink } from "@medbrains/design-system";
import type { OpdCardPrintData } from "@medbrains/types";
import { esc, PRINT_FONT_FACES, type PrintPage } from "./print-html";
import { qrSvgMarkup } from "./qr-svg";

/**
 * The patient ID card: a CR80 card (85.6 x 54 mm, the size of a bank card)
 * the patient keeps for good. A slim header with the hospital's logo (or its
 * initial in a brand-blue square) and name; the patient's name, UHID, the
 * hospital's OPD number and date where it keeps one, and age, sex and phone
 * on the left; a QR of the UHID on the right for the next
 * counter's scanner.
 *
 * Permanent, so nothing that changes per visit: no token, date, doctor or
 * department (those are the token ticket's), even when the data was fetched
 * with a visit; the letterhead's address and registration number and the
 * patient's address stay off too, for space. No clinical field either,
 * because the card is shown at every counter in the hospital.
 */

/** The card's colours, from the design tokens: MedBrains blue, ink, a muted grey, the edge. */
const COLOUR = { brand: blue[5], ink: ink[10], muted: ink[7], edge: ink[3], paper: ink[0] };

/** "male" -> "Male": the enum as a person reads it. */
function genderLabel(gender: string): string {
  return gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : "";
}

/** The logo if set, else the hospital's initial in a brand-blue square. */
function logo(data: OpdCardPrintData): string {
  const initial = `<div class="logo initial">${esc(data.hospital_name.trim().charAt(0).toUpperCase() || "H")}</div>`;
  if (!data.hospital_logo_url) return initial;
  // A logo that fails to load gives way to the initial rather than a gap.
  return (
    `<img class="logo" src="${esc(data.hospital_logo_url)}" alt="" ` +
    `onerror="this.nextElementSibling.hidden=false;this.remove()">` +
    initial.replace('<div class="logo initial">', '<div class="logo initial" hidden>')
  );
}

/**
 * The slim header: logo, hospital name, and what the card is. With a name
 * banner, the emblem stays on the left and the banner takes the rest of the
 * row in place of the typed name, scaled down to fit.
 */
function header(data: OpdCardPrintData): string {
  if (data.hospital_name_banner_url) {
    const emblem = data.hospital_logo_url
      ? `<img class="logo" src="${esc(data.hospital_logo_url)}" alt="">`
      : "";
    return (
      `<header class="head">${emblem}<img class="banner" src="${esc(data.hospital_name_banner_url)}" ` +
      `alt="${esc(data.hospital_name)}"></header>`
    );
  }
  return (
    `<header class="head">${logo(data)}<div class="hospital">${esc(data.hospital_name)}</div>` +
    `<div class="kind">Patient ID card</div></header>`
  );
}

/** "OPD 1043 · 15-Aug-2026", the hospital's own number, when it keeps one. */
function opdLine(data: OpdCardPrintData): string {
  if (!data.opd_number) return "";
  const text = ["OPD " + data.opd_number, data.opd_date].filter(Boolean).join(" · ");
  return `<div class="meta opd">${esc(text)}</div>`;
}

/** Name, UHID, the OPD number, and age, sex and phone, beside the QR of the UHID. */
function identity(data: OpdCardPrintData): string {
  const meta = [data.age, genderLabel(data.gender), data.phone].filter(Boolean).join(" · ");
  return (
    `<section class="body"><div class="who">` +
    `<div class="name">${esc(data.patient_name)}</div>` +
    `<div class="label">UHID</div><div class="uhid">${esc(data.uhid)}</div>` +
    opdLine(data) +
    `<div class="meta">${esc(meta || null)}</div>` +
    `</div><div class="qr" role="img" aria-label="QR code of UHID ${esc(data.uhid)}">` +
    `${qrSvgMarkup(data.uhid, 160)}</div></section>`
  );
}

/**
 * A fixed grid inside a 3 mm safe area, so nothing moves with the data: a name
 * wraps to two lines and then ends in an ellipsis, and every other line is one
 * line that ellipsises. The QR stays black on white, 19 mm, so it scans.
 */
const ID_CARD_CSS = `${PRINT_FONT_FACES}
  @page { size: 85.6mm 54mm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 85.6mm; height: 54mm; overflow: hidden; background: ${COLOUR.paper}; }
  body { font-family: "MedBrains Sans", "IBM Plex Sans", Arial, sans-serif; color: ${COLOUR.ink}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .card { width: 85.6mm; height: 54mm; padding: 3mm; display: grid; grid-template-rows: 9mm minmax(0, 1fr); border: 0.3mm solid ${COLOUR.edge}; border-radius: 3mm; overflow: hidden; }
  .head { display: flex; align-items: center; gap: 2mm; min-width: 0; border-bottom: 0.4mm solid ${COLOUR.brand}; }
  .logo { width: 6mm; height: 6mm; flex: none; object-fit: contain; border-radius: 1mm; }
  .banner { flex: 1 1 auto; min-width: 0; height: 6mm; object-fit: contain; object-position: right center; }
  .initial { display: grid; place-items: center; background: ${COLOUR.brand}; color: ${COLOUR.paper}; font-weight: 700; font-size: 4mm; }
  .initial[hidden] { display: none; }
  .hospital { font-size: 3.6mm; font-weight: 700; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .kind { margin-left: auto; flex: none; font-size: 2.2mm; color: ${COLOUR.muted}; }
  .body { display: grid; grid-template-columns: minmax(0, 1fr) 19mm; column-gap: 2mm; padding-top: 2mm; min-height: 0; }
  .who { min-width: 0; }
  .name { font-size: 3.8mm; font-weight: 700; line-height: 1.15; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; max-height: 2.3em; }
  .label { margin-top: 1.6mm; font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 1.9mm; letter-spacing: 0.3mm; color: ${COLOUR.muted}; }
  .uhid { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 4.6mm; font-weight: 600; line-height: 1.2; }
  .meta { margin-top: 1mm; font-size: 2.6mm; }
  .opd { font-weight: 600; }
  .uhid, .meta { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .qr { width: 19mm; height: 19mm; align-self: center; }
  .qr svg { display: block; width: 100%; height: 100%; }
`;

/** The ID card for `data`, on its own CR80 page. */
export function renderPatientIdCard(data: OpdCardPrintData): PrintPage {
  return {
    css: ID_CARD_CSS,
    body: `<main class="card">${header(data)}${identity(data)}</main>`,
  };
}

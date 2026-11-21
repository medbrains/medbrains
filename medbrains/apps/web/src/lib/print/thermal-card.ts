import type { PatientCardPrintData } from "@medbrains/types";
import { esc, genderLabel, type PrintPage } from "./print-html";
import { qrSvgMarkup } from "./qr-svg";

/**
 * Thermal roll width. 58mm is the common small printer; the layout is built
 * for it and an 80mm printer simply leaves margin, which is the safe
 * direction to be wrong in.
 */
const ROLL_WIDTH_MM = 58;

/**
 * The printable width inside the roll. Thermal mechanisms do not print to the
 * paper edge — 2mm each side is the usual dead zone, and a card laid out to
 * the full 58mm loses its right-hand characters on half the printers in the
 * field.
 */
const PRINT_WIDTH_MM = 54;

/* Continuous roll: the height is whatever the card needs, and a fixed height
   would eject blank paper after every card. Thermal heads lose hairlines and
   light greys, so everything is solid black on white. */
const CSS = `
  @page { size: ${ROLL_WIDTH_MM}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 2mm; width: ${PRINT_WIDTH_MM}mm;
    font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .uhid { font-size: 15pt; font-weight: 700; letter-spacing: .04em; font-family: "Courier New", monospace; margin: 0 0 1mm; }
  .name { font-size: 11pt; font-weight: 700; line-height: 1.15; margin: 0 0 1mm; }
  .meta { font-size: 8pt; line-height: 1.35; margin: 0; }
  .qr { text-align: center; margin: 2mm 0 1mm; }
  .qr svg { width: 26mm; height: 26mm; }
  .rule { border-top: 1px dashed #000; margin: 2mm 0; }
  .hospital { font-size: 7pt; text-align: center; margin: 0; }
  /* The hospital's marks, small and in high-contrast grey: a thermal head
     prints only black, so colour and soft shading are flattened before it does. */
  .marks { display: flex; align-items: center; gap: 1.5mm; margin: 0 0 1.5mm; }
  .marks img { height: 7mm; filter: grayscale(1) contrast(1.6); }
  .marks .banner { flex: 1 1 auto; min-width: 0; object-fit: contain; object-position: left center; }
  .marks .typed { font-size: 8pt; font-weight: 700; }
`;

/**
 * The header row: the emblem, then the name banner (or the hospital's name as
 * text without one). Nothing when neither mark is set, so a hospital without
 * marks prints exactly the card it printed before.
 */
function marks(data: PatientCardPrintData): string {
  const { hospital_logo_url: emblem, hospital_name_banner_url: banner } = data;
  if (!emblem && !banner) return "";
  const emblemImg = emblem ? `<img src="${esc(emblem)}" alt="">` : "";
  const name = banner
    ? `<img class="banner" src="${esc(banner)}" alt="${esc(data.hospital_name)}">`
    : `<span class="typed">${esc(data.hospital_name)}</span>`;
  return `<div class="marks">${emblemImg}${name}</div>`;
}

/**
 * The thermal patient card: a 58 mm roll slip the patient carries between
 * counters, so the lab bench and the pharmacy scan it rather than re-type a
 * name said once across a noisy table.
 *
 * The QR encodes the UHID, not the internal id: a scanner drops what it reads
 * into a search box, and every search on this path matches UHID, phone and
 * name. A QR rather than a 1D barcode because it survives a folded, thumbed
 * card. The age line only appears when there is one; "— yrs" reads as a fault.
 */
export function renderThermalCard(data: PatientCardPrintData): PrintPage {
  const ageLine = [data.age, genderLabel(data.gender)].filter(Boolean).join(" · ");
  const dob = data.date_of_birth ? `<br/>DOB ${esc(data.date_of_birth)}` : "";
  return {
    css: CSS,
    body:
      marks(data) +
      `<p class="uhid">${esc(data.uhid)}</p><p class="name">${esc(data.patient_name)}</p>` +
      `<p class="meta">${esc(ageLine)}${dob}<br/>${esc(data.phone)}</p>` +
      `<div class="qr">${qrSvgMarkup(data.uhid, 96)}</div><div class="rule"></div>` +
      `<p class="hospital">Registered ${esc(data.registered_at)}</p>`,
  };
}

import type { OpdCardPrintData } from "@medbrains/types";
import { esc, PRINT_FONT_FACES, type PrintPage } from "./print-html";

/**
 * The OPD token ticket: a bus ticket off an 80 mm thermal roll. "Hospital ·
 * OPD" at the top, the token on one line as large as the roll allows, when it
 * was issued, and "please wait". It is thrown away after the visit, so it
 * carries nothing that names the patient: the payload has the name, UHID and
 * phone, and this layout reads none of them.
 *
 * 80 mm only. On a 58 mm roll the printer driver fits the page to the paper,
 * which shrinks it in proportion; a separate 58 mm layout waits for a hospital
 * that runs one.
 */

/** The width the token may fill: the 80 mm page less 5 mm sides and 2 mm of glyph slack each. */
const TOKEN_WIDTH_MM = 66;
/** IBM Plex Mono's advance width, in em. */
const MONO_ADVANCE_EM = 0.6;
/** The largest the token is drawn, so a short one does not crowd the ticket. */
const MAX_TOKEN_MM = 20;

/** The token's font size in mm: as large as fits the roll's width on one line. */
export function tokenSizeMm(token: string): number {
  const fit = TOKEN_WIDTH_MM / (MONO_ADVANCE_EM * Math.max(token.length, 1));
  return Math.min(MAX_TOKEN_MM, Math.floor(fit * 10) / 10);
}

/**
 * Black on white with no greys or hairlines, because a thermal head drops
 * both. The page is the ticket: the roll is cut where it ends.
 */
const TICKET_CSS = `${PRINT_FONT_FACES}
  @page { size: 80mm 70mm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 80mm; background: #fff; }
  body { font-family: "MedBrains Sans", "IBM Plex Sans", Arial, sans-serif; color: #000; }
  .ticket { width: 80mm; height: 70mm; overflow: hidden; padding: 4mm 5mm; display: flex; flex-direction: column; justify-content: space-between; text-align: center; }
  .head { font-size: 4mm; font-weight: 700; padding-bottom: 2mm; border-bottom: 0.4mm dashed #000; overflow-wrap: anywhere; }
  .label { margin-top: 1mm; font-size: 3mm; letter-spacing: 0.5mm; }
  .token { font-family: "IBM Plex Mono", ui-monospace, monospace; font-weight: 600; line-height: 1; white-space: nowrap; }
  .issued { font-size: 3mm; }
  .foot { font-size: 2.6mm; padding-top: 2mm; border-top: 0.4mm dashed #000; }
`;

/**
 * The ticket for `data`, or the reason there is none: a visit the queue gave
 * no number prints nothing rather than a blank ticket.
 */
export function renderTokenTicket(data: OpdCardPrintData): PrintPage | { problem: string } {
  const visit = data.visit;
  if (!visit?.token_number) {
    return { problem: "This visit has no token, so there is no ticket to print." };
  }
  const token = visit.token_number;
  return {
    css: TICKET_CSS,
    body:
      `<main class="ticket"><div class="head">${esc(data.hospital_name)} · OPD</div>` +
      `<div><div class="label">YOUR TOKEN</div>` +
      `<div class="token" style="font-size: ${tokenSizeMm(token)}mm">${esc(token)}</div></div>` +
      `<div class="issued">${esc(visit.visit_date.replaceAll("-", " "))} · ${esc(visit.visit_time)}</div>` +
      `<div class="foot">Please wait for your number to be called</div></main>`,
  };
}

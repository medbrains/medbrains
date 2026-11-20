import type { OpdCardPrintData, OpdCardVisit } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { renderTokenTicket, tokenSizeMm } from "./token-ticket";

/** A fictional hospital and visit: nothing here is a real record. */
const TICKET: OpdCardPrintData = {
  hospital_name: "Rishi Hospital",
  hospital_logo_url: null,
  hospital_address: "12 Temple Road, Madurai",
  hospital_phone: "0452 400 1234",
  hospital_registration_no: "TN/CE/2026/0451",
  patient_name: "Asha Sample",
  uhid: "RH-000123",
  age: "34 Y",
  gender: "female",
  phone: "9000012345",
  address: "4 North Street, Madurai",
  registered_on: "17-Nov-2026",
  visit: {
    visit_date: "17-Nov-2026",
    visit_time: "10:42",
    department: "General Medicine",
    doctor: "Dr Arun Prakash",
    token_number: "OP-014",
    is_repeat: false,
  },
};

/** The ticket's data with the visit's token replaced. */
function withToken(token_number: string | null): OpdCardPrintData {
  return { ...TICKET, visit: { ...(TICKET.visit as OpdCardVisit), token_number } };
}

/** The ticket's page, failing the test when the renderer refused. */
function page(data: OpdCardPrintData) {
  const out = renderTokenTicket(data);
  if ("problem" in out) throw new Error(out.problem);
  return out;
}

describe("renderTokenTicket", () => {
  it("prints the token, the hospital and when it was issued", () => {
    const { body } = page(TICKET);
    expect(body).toContain(">OP-014<");
    expect(body).toContain("Rishi Hospital · OPD");
    expect(body).toContain("YOUR TOKEN");
    expect(body).toContain("17 Nov 2026 · 10:42");
    expect(body).toContain("Please wait for your number to be called");
  });

  it("carries nothing that names the patient, though the payload does", () => {
    const { body } = page(TICKET);
    for (const absent of [
      "Asha",
      "UHID",
      "RH-000123",
      "9000012345",
      "North Street",
      "Dr Arun",
      "<svg",
    ]) {
      expect(body).not.toContain(absent);
    }
  });

  it("declares its own 80 mm page with no margin", () => {
    expect(page(TICKET).css).toContain("@page { size: 80mm 70mm; margin: 0; }");
  });

  it("keeps the token on one line, as large as fits the roll", () => {
    expect(page(TICKET).css).toMatch(/\.token \{[^}]*white-space: nowrap;/);
    expect(page(TICKET).body).toContain("font-size: 18.3mm");
    expect(tokenSizeMm("T-1")).toBe(20);
    expect(tokenSizeMm("GENMED-0142")).toBe(10);
    expect(page(withToken("GENMED-0142")).body).toContain("font-size: 10mm");
  });

  it("refuses rather than printing a blank ticket when the visit has no token", () => {
    const problem = { problem: "This visit has no token, so there is no ticket to print." };
    expect(renderTokenTicket(withToken(null))).toEqual(problem);
    expect(renderTokenTicket({ ...TICKET, visit: null })).toEqual(problem);
  });
});

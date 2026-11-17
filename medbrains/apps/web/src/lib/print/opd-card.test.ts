import type { OpdCardPrintData } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { renderOpdCard } from "./opd-card";

/** A fictional hospital and patient: nothing here is a real record. */
const CARD: OpdCardPrintData = {
  hospital_name: "Rishi Hospital",
  hospital_logo_url: null,
  hospital_address: "12 Temple Road, Madurai, Tamil Nadu, 625001",
  hospital_phone: "0452 400 1234",
  hospital_registration_no: "TN/CE/2026/0451",
  patient_name: "Kavya Raman",
  uhid: "RH-2026-000123",
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
    token_number: "GM-014",
    is_repeat: false,
    follow_up_date: null,
  },
};

describe("renderOpdCard", () => {
  it("heads the card with the hospital's own name and registration, never a product name", () => {
    const { body } = renderOpdCard(CARD);
    expect(body).toContain("Rishi Hospital");
    expect(body).toContain("Reg. no. TN/CE/2026/0451");
    expect(body).not.toMatch(/MedBrains/i);
  });

  it("carries the UHID as text and as a QR, and the visit's token and doctor", () => {
    const { body } = renderOpdCard(CARD);
    expect(body).toContain("RH-2026-000123");
    expect(body).toContain("<svg");
    expect(body).toContain("GM-014");
    expect(body).toContain("Dr Arun Prakash");
    expect(body).toContain("New");
  });

  it("sizes the page to the paper chosen", () => {
    expect(renderOpdCard(CARD, "id-card").css).toContain("size: 85.6mm 54mm");
    expect(renderOpdCard(CARD, "slip").css).toContain("size: A5 landscape");
  });

  it("prints identity alone when there is no visit, with the next-visit box left to fill", () => {
    const { body } = renderOpdCard({ ...CARD, visit: null });
    expect(body).not.toContain("Token");
    expect(body).toContain("Next visit");
  });

  it("escapes what a person typed rather than writing it as markup", () => {
    const { body } = renderOpdCard({ ...CARD, patient_name: "<b>O'Brien & Co</b>" });
    expect(body).toContain("&lt;b&gt;O'Brien &amp; Co&lt;/b&gt;");
  });
});

import type { OpdCardPrintData } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { renderPatientIdCard } from "./patient-id-card";

/** A fictional hospital and patient: nothing here is a real record. */
const CARD: OpdCardPrintData = {
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

describe("renderPatientIdCard", () => {
  it("heads the card with the hospital's own name, never a product name", () => {
    const { body } = renderPatientIdCard(CARD);
    expect(body).toContain("Rishi Hospital");
    expect(body).not.toMatch(/MedBrains/i);
  });

  it("carries the name, the UHID as text and as a QR, age and sex, and phone", () => {
    const { body } = renderPatientIdCard(CARD);
    expect(body).toContain("Asha Sample");
    expect(body).toContain("RH-000123");
    expect(body).toContain("<svg");
    expect(body).toContain("34 Y · Female · 9000012345");
    expect(body).toContain("Patient ID card");
    expect(body).toContain("9000012345");
  });

  it("is permanent: no token, visit date, doctor, department or next visit, even fetched with a visit", () => {
    const { body } = renderPatientIdCard(CARD);
    for (const absent of [
      "Token",
      "OP-014",
      "10:42",
      "Dr Arun Prakash",
      "General Medicine",
      "Next visit",
      "North Street",
    ]) {
      expect(body).not.toContain(absent);
    }
  });

  it("declares its own CR80 page with no margin", () => {
    expect(renderPatientIdCard(CARD).css).toContain("@page { size: 85.6mm 54mm; margin: 0; }");
  });

  it("clamps a long name to two lines and ellipsises every other line", () => {
    const long = "Asha Venkatalakshmi Ramasubramanian Sundaravadivelu Chandrasekharan Iyer";
    const { body, css } = renderPatientIdCard({ ...CARD, patient_name: long });
    expect(body).toContain(long);
    expect(css).toMatch(/\.name \{[^}]*-webkit-line-clamp: 2;[^}]*overflow: hidden;/);
    expect(css).toMatch(/\.uhid, \.meta \{[^}]*text-overflow: ellipsis;/);
    expect(css).toMatch(/\.hospital \{[^}]*text-overflow: ellipsis;/);
  });

  it("escapes what a person typed rather than writing it as markup", () => {
    const { body } = renderPatientIdCard({ ...CARD, patient_name: "<b>O'Brien & Co</b>" });
    expect(body).toContain("&lt;b&gt;O'Brien &amp; Co&lt;/b&gt;");
  });

  it("uses the hospital's logo when set, else its initial in a brand square", () => {
    expect(renderPatientIdCard(CARD).body).toContain('<div class="logo initial">R</div>');
    const withLogo = renderPatientIdCard({ ...CARD, hospital_logo_url: "/logo.png" }).body;
    expect(withLogo).toContain('<img class="logo" src="/logo.png"');
    expect(withLogo).toContain('<div class="logo initial" hidden>R</div>');
  });
  it("carries the hospital's OPD number and its register date, only when there is one", () => {
    const numbered = renderPatientIdCard({ ...CARD, opd_number: "1042", opd_date: "15-Aug-2026" });
    expect(numbered.body).toContain("OPD 1042 · 15-Aug-2026");
    expect(renderPatientIdCard(CARD).body).not.toContain("OPD ");
  });
});

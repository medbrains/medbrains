import type { OpdCardPrintData } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { renderPatientIdCard } from "./patient-id-card";

/** A fictional hospital and patient: nothing here is a real record. */
const CARD: OpdCardPrintData = {
  hospital_name: "Sample Hospital",
  hospital_logo_url: null,
  hospital_name_banner_url: null,
  hospital_address: "1 Example Street, Sample Town",
  hospital_phone: "0000 000 0000",
  hospital_registration_no: "XX/CE/0000/0000",
  patient_name: "Asha Sample",
  uhid: "SH-000123",
  age: "34 Y",
  gender: "female",
  phone: "9000012345",
  address: "4 North Street, Sample Town",
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
    expect(body).toContain("Sample Hospital");
    expect(body).not.toMatch(/MedBrains/i);
  });

  it("carries the name, the UHID as text and as a QR, age and sex, and phone", () => {
    const { body } = renderPatientIdCard(CARD);
    expect(body).toContain("Asha Sample");
    expect(body).toContain("SH-000123");
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
    expect(renderPatientIdCard(CARD).body).toContain('<div class="logo initial">S</div>');
    const withLogo = renderPatientIdCard({ ...CARD, hospital_logo_url: "/logo.png" }).body;
    expect(withLogo).toContain('<img class="logo" src="/logo.png"');
    expect(withLogo).toContain('<div class="logo initial" hidden>S</div>');
  });
  it("carries the hospital's OPD number and its register date, only when there is one", () => {
    const numbered = renderPatientIdCard({ ...CARD, opd_number: "1042", opd_date: "15-Aug-2026" });
    expect(numbered.body).toContain("OPD 1042 · 15-Aug-2026");
    expect(renderPatientIdCard(CARD).body).not.toContain("OPD ");
  });

  it("puts the emblem left and the name banner in place of the typed name", () => {
    const emblem = "data:image/png;base64,AAAA";
    const banner = "data:image/webp;base64,BBBB";
    const { body } = renderPatientIdCard({
      ...CARD,
      hospital_logo_url: emblem,
      hospital_name_banner_url: banner,
    });
    expect(body).toContain(
      `<header class="head"><img class="emblem" src="${emblem}" alt=""><img class="banner" src="${banner}"`,
    );
    expect(body).toMatch(/<img class="banner" src="data:image\/webp;base64,BBBB" alt="[^"]+">/);
    expect(body).not.toContain('class="hospital"');
  });

  it("sets the emblem to the banner's height in one row, the banner filling the rest", () => {
    const { body, css } = renderPatientIdCard({
      ...CARD,
      hospital_logo_url: "data:image/png;base64,AAAA",
      hospital_name_banner_url: "data:image/webp;base64,BBBB",
    });
    expect(body).toContain('<main class="card with-banner">');
    expect(css).toContain(".card.with-banner { grid-template-rows: 13mm minmax(0, 1fr); }");
    expect(css).toContain(".emblem, .banner { height: 11mm; object-fit: contain; }");
    expect(css).toMatch(/\.banner \{[^}]*flex: 1 1 auto;[^}]*object-position: left center;/);
  });

  it("keeps the 9 mm header with no banner, with or without an emblem", () => {
    for (const logo of [null, "data:image/png;base64,AAAA"]) {
      const { body, css } = renderPatientIdCard({ ...CARD, hospital_logo_url: logo });
      expect(body).toContain('<main class="card"><header class="head">');
      expect(body).not.toContain('class="emblem"');
      expect(css).toContain("grid-template-rows: 9mm minmax(0, 1fr)");
    }
  });

  it("keeps the typed name beside the emblem when there is no banner", () => {
    const { body } = renderPatientIdCard({
      ...CARD,
      hospital_logo_url: "data:image/png;base64,AAAA",
    });
    expect(body).toContain('class="hospital"');
    expect(body).not.toContain('class="banner"');
  });
});

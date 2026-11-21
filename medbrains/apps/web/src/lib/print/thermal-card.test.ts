import type { PatientCardPrintData } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { renderThermalCard } from "./thermal-card";

/** A fictional hospital and patient; the images are four-byte placeholders. */
const CARD: PatientCardPrintData = {
  hospital_name: "Example Care Centre",
  hospital_logo_url: null,
  hospital_name_banner_url: null,
  patient_name: "Asha Sample",
  uhid: "EX-000123",
  date_of_birth: null,
  age: "34 yrs",
  gender: "female",
  phone: "9000012345",
  email: null,
  address: null,
  category: "general",
  registered_at: "17-Nov-2026",
};
const EMBLEM = "data:image/png;base64,AAAA";
const BANNER = "data:image/webp;base64,BBBB";

describe("renderThermalCard", () => {
  it("prints the card it always did when the hospital set no marks", () => {
    const { body } = renderThermalCard(CARD);
    expect(body.startsWith('<p class="uhid">')).toBe(true);
    expect(body).not.toContain('class="marks"');
  });

  it("heads the card with the emblem and the name banner", () => {
    const { body, css } = renderThermalCard({
      ...CARD,
      hospital_logo_url: EMBLEM,
      hospital_name_banner_url: BANNER,
    });
    expect(body).toContain(`<div class="marks"><img src="${EMBLEM}" alt="">`);
    expect(body).toContain(`<img class="banner" src="${BANNER}" alt="Example Care Centre">`);
    expect(css).toContain("grayscale(1)");
  });

  it("types the hospital's name beside the emblem when there is no banner", () => {
    const { body } = renderThermalCard({ ...CARD, hospital_logo_url: EMBLEM });
    expect(body).toContain('<span class="typed">Example Care Centre</span>');
    expect(body).not.toContain('class="banner"');
  });
});

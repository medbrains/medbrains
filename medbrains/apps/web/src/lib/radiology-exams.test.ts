import type { RadiologyExamListItem } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { examOrderDefaults, examPriceLabel } from "./radiology-exams";

const exam = (over: Partial<RadiologyExamListItem>): RadiologyExamListItem => ({
  id: "e1",
  tenant_id: "t",
  modality_id: "m",
  code: "CT-BRAIN-P",
  name: "CT Brain Plain",
  body_part: "Head",
  body_part_code: "FMA:7154",
  laterality_required: false,
  contrast: "without",
  synonyms: [],
  charge_code: null,
  preparation: null,
  is_active: true,
  created_at: "",
  updated_at: "",
  modality_code: "CT",
  modality_name: "CT",
  price: null,
  billing_code: "RAD-CT",
  ...over,
});

describe("examOrderDefaults", () => {
  it("fills the body site and asks for contrast only when the exam uses it", () => {
    expect(examOrderDefaults(exam({}))).toEqual({
      site: { label: "Head", code: "FMA:7154", laterality: null },
      contrastRequired: false,
    });
    expect(examOrderDefaults(exam({ contrast: "with" })).contrastRequired).toBe(true);
    expect(examOrderDefaults(exam({ contrast: "with_and_without" })).contrastRequired).toBe(true);
    expect(examOrderDefaults(exam({ body_part: null })).site).toBeNull();
  });
});

describe("examPriceLabel", () => {
  it("names the charge code to price when billing would charge nothing", () => {
    expect(examPriceLabel(exam({}))).toEqual({
      priced: false,
      text: "No price — add RAD-CT in the charge master",
    });
    expect(examPriceLabel(exam({ price: "2500.00" }))).toEqual({ priced: true, text: "₹2500.00" });
  });
});

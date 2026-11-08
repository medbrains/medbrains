import { describe, expect, it } from "vitest";
import { dictatedToRx } from "./dictatedRx";
import type { FormularyDrug } from "./rxModel";

const paracetamol = {
  id: "drug-1",
  name: "Paracetamol 500",
  salt: "paracetamol",
  brands: ["Dolo"],
  cls: "analgesic",
  form: "Tab",
  strengths: ["500 mg"],
} as unknown as FormularyDrug;

describe("dictatedToRx", () => {
  it("matches a dictated medicine to the formulary and keeps what was said", () => {
    const { items, unmatched } = dictatedToRx(
      [
        {
          name: "paracetamol",
          dose: "500 mg",
          frequency: "twice a day",
          duration: "3 days",
          route: "",
        },
      ],
      [paracetamol],
    );
    expect(unmatched).toEqual([]);
    expect(items[0]?.id).toBe("drug-1");
    expect(items[0]?.days).toBe(3);
    expect(items[0]?.note).toBe("Dictated: 500 mg, twice a day, 3 days");
  });

  it("never invents a formulary line for a drug it cannot find", () => {
    const { items, unmatched } = dictatedToRx(
      [{ name: "Unobtainium", dose: "", frequency: "", duration: "", route: "" }],
      [paracetamol],
    );
    expect(items).toEqual([]);
    expect(unmatched).toEqual(["Unobtainium"]);
  });
});

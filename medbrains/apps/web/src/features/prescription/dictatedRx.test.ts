import type { ModelMedicine } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { dictatedToRx, spokenDoses } from "./dictatedRx";
import type { FormularyDrug } from "./rxModel";

const drug = (id: string, name: string, salt: string, cls: string) =>
  ({
    id,
    name,
    salt,
    brands: [],
    cls,
    form: "Tab",
    strengths: ["250 mg"],
  }) as unknown as FormularyDrug;

const paracetamol = drug("p-1", "Paracetamol 650", "paracetamol", "analgesic");
const amox250 = drug("a-1", "Amoxicillin 250", "amoxicillin", "penicillin");
const amox500 = drug("a-2", "Amoxicillin 500", "amoxicillin", "penicillin");
const said = (over: Partial<ModelMedicine>): ModelMedicine => ({
  name: "",
  dose: "",
  frequency: "",
  duration: "",
  route: "",
  ...over,
});

describe("dictatedToRx", () => {
  it("uses the dose, frequency, days and route that were said, not the defaults", () => {
    const { items, picks } = dictatedToRx(
      [
        said({
          name: "paracetamol",
          dose: "500 mg",
          frequency: "three times a day",
          duration: "3 days",
          route: "oral",
        }),
      ],
      [paracetamol],
    );
    expect(picks).toEqual([]);
    expect(items[0]?.id).toBe("p-1");
    expect(items[0]?.strength).toBe("500 mg");
    expect(items[0]?.doses.map((d) => d.key)).toEqual(["m", "a", "n"]);
    expect(items[0]?.days).toBe(3);
    expect(items[0]?.note).toBe("Dictated: paracetamol, 500 mg, three times a day, 3 days, oral");
  });

  it("never matches by drug class alone", () => {
    const { items, picks } = dictatedToRx([said({ name: "penicillin" })], [amox250, paracetamol]);
    expect(items).toEqual([]);
    expect(picks).toMatchObject([{ index: 0, candidates: 0 }]);
  });

  it("leaves an ambiguous name for the doctor to pick, then uses the pick", () => {
    const meds = [said({ name: "amoxicillin", dose: "500 mg" })];
    const first = dictatedToRx(meds, [amox250, amox500]);
    expect(first.items).toEqual([]);
    expect(first.picks).toMatchObject([{ index: 0, candidates: 2 }]);
    const picked = dictatedToRx(meds, [amox250, amox500], { 0: amox500 });
    expect(picked.picks).toEqual([]);
    expect(picked.items[0]?.id).toBe("a-2");
  });

  it("fills no dose slot for a frequency it cannot read", () => {
    expect(spokenDoses("as the patient wishes")).toEqual([]);
    expect(spokenDoses("")).toBeNull();
    expect(spokenDoses("twice daily")?.map((d) => d.key)).toEqual(["m", "n"]);
    expect(spokenDoses("at night")?.map((d) => d.key)).toEqual(["n"]);
  });
});

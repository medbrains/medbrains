import { describe, expect, it } from "vitest";
import { codingSystems, terminologySystemLabel } from "./terminology-policy";

describe("codingSystems", () => {
  it("offers exactly the systems the hospital's switch allows, ICD-11 first", () => {
    expect(codingSystems("icd11")).toEqual(["icd11"]);
    expect(codingSystems("icd10")).toEqual(["icd10"]);
    expect(codingSystems("both")).toEqual(["icd11", "icd10"]);
  });

  it("labels each code with its own system — no code is shown unlabelled", () => {
    expect(terminologySystemLabel("icd10")).toBe("ICD-10");
    expect(terminologySystemLabel("icd11")).toBe("ICD-11");
  });
});

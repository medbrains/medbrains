import { describe, expect, it } from "vitest";
import { ARCHES, conditionTone } from "./tooth-layout";

describe("odontogram layout", () => {
  it("lays out 32 permanent and 20 deciduous teeth, each once", () => {
    const permanent = [...ARCHES.permanent.upper, ...ARCHES.permanent.lower];
    const deciduous = [...ARCHES.deciduous.upper, ...ARCHES.deciduous.lower];
    expect(new Set(permanent).size).toBe(32);
    expect(new Set(deciduous).size).toBe(20);
  });

  it("reads right-to-left across the midline as a dentist charts", () => {
    expect(ARCHES.permanent.upper.slice(6, 10)).toEqual(["12", "11", "21", "22"]);
    expect(ARCHES.permanent.lower[0]).toBe("48");
  });

  it("shows untreated disease as danger and treated teeth as information", () => {
    expect(conditionTone("caries")).toBe("danger");
    expect(conditionTone("root_canal")).toBe("info");
    expect(conditionTone(undefined)).toBe("neutral");
  });
});

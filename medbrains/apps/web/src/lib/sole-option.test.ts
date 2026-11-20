import { describe, expect, it } from "vitest";
import { pickDepartment, soleOption } from "./sole-option";

const gen = { value: "gen", label: "General" };
const ortho = { value: "ortho", label: "Ortho" };

describe("soleOption", () => {
  it("returns the only option", () => expect(soleOption([gen])).toBe(gen));
  it("returns null while there are none (loading or failed)", () =>
    expect(soleOption([])).toBeNull());
  it("returns null when there are several", () => expect(soleOption([gen, ortho])).toBeNull());
  it("returns null when the form holds another value, so the picker shows it", () =>
    expect(soleOption([gen], "old")).toBeNull());
  it("pickDepartment fills the sole one and keeps a picked one", () => {
    expect(pickDepartment([gen], undefined)).toBe("gen");
    expect(pickDepartment([gen, ortho], "ortho")).toBe("ortho");
  });
});

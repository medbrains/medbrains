// @vitest-environment node

import { describe, expect, it } from "vitest";
import { fromFormText, PROFILE_FIELDS, type ProfileForm, toFormText, toRow } from "./fields";

const empty = Object.fromEntries(PROFILE_FIELDS.map((f) => [f.key, ""])) as ProfileForm;

describe("locale profile form", () => {
  it("sends a facility only the fields a facility may set", () => {
    const row = toRow(
      { id: "f1", scope: "facility", name: "Satellite" },
      { ...empty, timezone: "Asia/Dubai", currency: "AED" },
    );
    expect(row).toMatchObject({ scope_id: "f1", scope_name: "Satellite", timezone: "Asia/Dubai" });
    // Currency and country are hospital-wide: never part of a facility's row.
    expect(row).not.toHaveProperty("currency");
    expect(row).not.toHaveProperty("country");
  });

  it("turns an empty field into inherit, not an empty string", () => {
    const row = toRow(
      { id: "t1", scope: "hospital", name: "City Hospital" },
      { ...empty, country: "AE" },
    );
    expect(row.country).toBe("AE");
    expect(row.region).toBeNull();
  });

  it("round-trips lists, calendars and the fiscal month", () => {
    expect(fromFormText("languages", "ar, en")).toEqual(["ar", "en"]);
    expect(toFormText("languages", ["ar", "en"])).toBe("ar, en");
    const hijri = fromFormText("calendars", "islamic-umalqura");
    expect(hijri).toEqual({ primary: "gregory", also: ["islamic-umalqura"] });
    expect(toFormText("calendars", hijri)).toBe("islamic-umalqura");
    expect(fromFormText("fiscal_year_start", "4")).toBe(4);
  });
});

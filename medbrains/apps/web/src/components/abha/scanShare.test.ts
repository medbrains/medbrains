// @vitest-environment node

import type { AbhaVerifiedProfile } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { shareAge, shareRegistrationValues } from "./scanShare";

const profile: AbhaVerifiedProfile = {
  abha_number: "91123456789012",
  abha_address: "priya.v@sbx",
  full_name: "Priya Kumari Varude",
  first_name: null,
  middle_name: null,
  last_name: null,
  date_of_birth: "1989-11-26",
  year_of_birth: "1989",
  gender: "female",
  mobile_masked: "+91 98765 43210",
  email: null,
  address: "12 MG Road",
  pincode: "411001",
  state: "Maharashtra",
  district: "Pune",
  kyc_verified: false,
};

describe("shareAge", () => {
  it("counts a birthday not yet reached this year", () => {
    expect(shareAge(profile, new Date(2026, 10, 25))).toBe(36);
    expect(shareAge(profile, new Date(2026, 10, 26))).toBe(37);
  });

  it("falls back to the year, and to nothing", () => {
    const today = new Date(2026, 0, 1);
    expect(shareAge({ date_of_birth: null, year_of_birth: "1970" }, today)).toBe(56);
    expect(shareAge({ date_of_birth: null, year_of_birth: null }, today)).toBeNull();
  });
});

describe("shareRegistrationValues", () => {
  it("splits a full name and keeps the ABHA and address", () => {
    const v = shareRegistrationValues(profile);
    expect([v.first_name, v.last_name]).toEqual(["Priya", "Varude"]);
    expect(v.phone).toBe("9876543210");
    expect(v.abha_number).toBe("91123456789012");
    expect(v.postal_code).toBe("411001");
    expect(v.registration_source).toBe("mobile_app");
  });

  it("prefers the name parts ABDM sent, and drops a short mobile", () => {
    const v = shareRegistrationValues({
      ...profile,
      first_name: "Priya",
      last_name: "V",
      mobile_masked: "XXXXXX3210",
    });
    expect([v.first_name, v.last_name]).toEqual(["Priya", "V"]);
    expect(v.phone).toBeUndefined();
  });
});

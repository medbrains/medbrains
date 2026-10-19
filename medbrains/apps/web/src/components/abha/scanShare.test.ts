// @vitest-environment node

import type { AbdmSharedProfile, AbhaVerifiedProfile, MpiMatchResult } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  likelyDuplicates,
  rankCandidates,
  shareAge,
  shareMatchRequest,
  shareRegistrationValues,
} from "./scanShare";

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

const shared: AbdmSharedProfile = {
  abha_number: "91123456789012",
  abha_address: "anil.r@sbx",
  full_name: "Anil Kumar Rao",
  first_name: null,
  middle_name: null,
  last_name: null,
  gender: "male",
  date_of_birth: "1980-06-05",
  year_of_birth: "1980",
  mobile: "+91 98765 43210",
  address: null,
  district: null,
  state: null,
  pincode: null,
  counter: "REG-1",
};

const match = (over: Partial<MpiMatchResult>): MpiMatchResult => ({
  id: "p",
  uhid: "UHID-1",
  first_name: "Someone",
  last_name: "Else",
  date_of_birth: null,
  phone: "9000000000",
  gender: "male",
  score: 0.6,
  ...over,
});

describe("shareMatchRequest", () => {
  it("asks the MPI by the shared name, birth date and 10-digit mobile", () => {
    expect(shareMatchRequest(shared)).toEqual({
      first_name: "Anil",
      last_name: "Rao",
      date_of_birth: "1980-06-05",
      phone: "9876543210",
    });
  });
});

describe("rankCandidates", () => {
  it("puts the same-mobile patient first, whatever the name score", () => {
    const ranked = rankCandidates(shared, [
      match({ id: "name", first_name: "Anil", last_name: "Rao", score: 0.9 }),
      match({ id: "mobile", first_name: "A", last_name: "Rao", phone: "9876543210", score: 0.3 }),
    ]);
    expect(ranked.map((c) => c.id)).toEqual(["mobile", "name"]);
    expect(ranked[0]?.sameMobile).toBe(true);
  });
});

describe("likelyDuplicates", () => {
  it("warns on the same mobile with a similar name, or with the same birth date", () => {
    const found = likelyDuplicates(shared, [
      match({ id: "nickname", first_name: "Anilkumar", last_name: "R", phone: "9876543210" }),
      match({ id: "dob", first_name: "Sunita", date_of_birth: "1980-06-05", phone: "9876543210" }),
    ]);
    expect(found.map((c) => c.id)).toEqual(["nickname", "dob"]);
  });

  it("warns on a similar name born the same day, even on another mobile", () => {
    const found = likelyDuplicates(shared, [
      match({ id: "same", first_name: "Anil", last_name: "Rao", date_of_birth: "1980-06-05" }),
    ]);
    expect(found).toHaveLength(1);
  });

  it("does not warn for a family member on the same mobile", () => {
    const found = likelyDuplicates(shared, [
      match({ first_name: "Sunita", last_name: "Devi", phone: "9876543210" }),
      match({ first_name: "Anil", last_name: "Rao", phone: "9111111111" }),
    ]);
    expect(found).toEqual([]);
  });
});

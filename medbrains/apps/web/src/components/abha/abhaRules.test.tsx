import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import { AbhaAddressRules } from "./AbhaAddressRules";
import {
  ABHA_MESSAGES,
  aadhaarFieldError,
  addressChecklist,
  addressName,
  isValidAadhaar,
  isValidAddress,
  isValidMobile,
  mobileFieldError,
  splitAbdmMessage,
  verhoeffOk,
} from "./abhaRules";

/** The same cases as `medbrains_abdm::rules` tests, so the mirror cannot drift. */
describe("ABHA rules (mirror of the server's)", () => {
  it("Verhoeff catches every single-digit slip", () => {
    const good = "999941057058";
    expect(verhoeffOk(good)).toBe(true);
    expect(verhoeffOk("2363")).toBe(true);
    for (let i = 0; i < good.length; i++) {
      for (let d = 0; d <= 9; d++) {
        if (good[i] === String(d)) continue;
        const bad = good.slice(0, i) + d + good.slice(i + 1);
        expect(verhoeffOk(bad), bad).toBe(false);
      }
    }
    expect(verhoeffOk("")).toBe(false);
  });

  it("an Aadhaar number is 12 digits that pass Verhoeff (CRT_ABHA_104)", () => {
    expect(isValidAadhaar("9999 4105 7058")).toBe(true);
    for (const bad of ["999941057059", "123456789012", "99994105705", "9999-4105-7058", ""]) {
      expect(isValidAadhaar(bad), bad).toBe(false);
    }
  });

  it("a mobile is ten digits and nothing else (VRFY_ABHA_301)", () => {
    expect(isValidMobile("98765 43210")).toBe(true);
    for (const bad of [
      "987654321",
      "98765432101",
      "98765abc10",
      "98765-43210",
      "+919876543210",
      "",
    ]) {
      expect(isValidMobile(bad), bad).toBe(false);
    }
  });

  it("address rules hold at every edge (CRT_ABHA_112)", () => {
    expect(isValidAddress("abc", "sbx")).toBe(false);
    expect(isValidAddress("abcd", "sbx")).toBe(true);
    expect(isValidAddress("abcdefghijklmn", "sbx")).toBe(true);
    expect(isValidAddress("abcdefghijklmno", "sbx")).toBe(false);
    expect(isValidAddress("abcdefghijklm", "abdm")).toBe(true);
    expect(isValidAddress("abcdefghijklmn", "abdm")).toBe(false);
    expect(isValidAddress("12345678", "sbx")).toBe(true);
    expect(isValidAddress("priya.v_90", "sbx")).toBe(true);
    for (const bad of ["pri.ya.v", "pri_ya_v", ".priyav", "priyav_", "priya-v1", "priyä.v1"]) {
      expect(isValidAddress(bad, "sbx"), bad).toBe(false);
    }
    expect(addressName(" priya.v@sbx ", "sbx")).toBe("priya.v");
    expect(addressChecklist("_ab", "sbx").map((r) => [r.label, r.met])).toEqual([
      ["8–18 characters, including @sbx", false],
      ["Letters and numbers only, besides . and _", true],
      ["At most one dot (.)", true],
      ["At most one underscore (_)", true],
      ["No . or _ at the start or end", false],
    ]);
  });

  it("ABDM's words come first, our hint beneath", () => {
    expect(splitAbdmMessage("Invalid OTP\nCheck it (code ABDM-1204)")).toEqual({
      message: "Invalid OTP",
      hint: "Check it (code ABDM-1204)",
    });
    expect(splitAbdmMessage(ABHA_MESSAGES.aadhaarInvalid)).toEqual({
      message: "Aadhaar Number is not valid",
      hint: null,
    });
  });
});

describe("AbhaAddressRules", () => {
  it("says met or not met in words, not colour alone", () => {
    render(<AbhaAddressRules name="priya..v" domain="sbx" />);
    expect(screen.getByText("At most one dot (.) — not met")).toBeInTheDocument();
    expect(screen.getByText("8–18 characters, including @sbx — met")).toBeInTheDocument();
  });
});

describe("field errors", () => {
  it("shows the Aadhaar error only once tried or complete", () => {
    expect(aadhaarFieldError("1234", false)).toBeUndefined();
    expect(aadhaarFieldError("1234", true)).toBe(ABHA_MESSAGES.aadhaarInvalid);
    expect(aadhaarFieldError("123456789012", false)).toBe(ABHA_MESSAGES.aadhaarInvalid);
    expect(mobileFieldError("")).toBeUndefined();
    expect(mobileFieldError("12345")).toBe(ABHA_MESSAGES.mobileInvalid);
  });
});

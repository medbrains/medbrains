import { describe, expect, it } from "vitest";
import { resolveProtectedFieldDisplay } from "./field-access-display";

describe("resolveProtectedFieldDisplay", () => {
  it("uses shared partial masking rules for patient identity and phone values", () => {
    expect(
      resolveProtectedFieldDisplay({
        access: "mask",
        kind: "name",
        value: "Anita Rao",
      }),
    ).toMatchObject({
      displayValue: "Masked name",
      isRestricted: true,
      restrictionLabel: "Masked by field access policy",
    });
    expect(
      resolveProtectedFieldDisplay({
        access: "mask",
        kind: "phone",
        value: "9876543210",
      }).displayValue,
    ).toBe("XXXXXX3210");
  });

  it("uses shared financial masking for money values", () => {
    expect(
      resolveProtectedFieldDisplay({
        access: "mask",
        kind: "money",
        value: 1250,
      }).displayValue,
    ).toBe("Amount masked");
  });

  it("distinguishes hidden, masked empty, and visible values", () => {
    expect(
      resolveProtectedFieldDisplay({
        access: "hidden",
        hiddenLabel: "Not allowed",
        value: "AB-1234",
      }),
    ).toMatchObject({
      displayValue: "Not allowed",
      isRestricted: true,
      restrictionLabel: "Hidden by field access policy",
    });
    expect(
      resolveProtectedFieldDisplay({
        access: "mask",
        fallback: "No value",
        value: "",
      }).displayValue,
    ).toBe("No value");
    expect(
      resolveProtectedFieldDisplay({
        access: "view",
        kind: "money",
        value: 1250,
      }).displayValue,
    ).toBe("₹1,250");
  });
});

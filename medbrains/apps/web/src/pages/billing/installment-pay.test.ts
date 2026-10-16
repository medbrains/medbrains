import { describe, expect, it } from "vitest";
import { installmentPaySchema } from "./installment-pay-modal";

describe("installmentPaySchema", () => {
  it("takes cash without a reference", () => {
    expect(installmentPaySchema.safeParse({ mode: "cash", reference_number: "" }).success).toBe(
      true,
    );
  });

  it("refuses a non-cash payment with no reference to trace it by", () => {
    for (const mode of ["card", "upi", "bank_transfer", "cheque"]) {
      expect(installmentPaySchema.safeParse({ mode, reference_number: "  " }).success).toBe(false);
    }
    expect(installmentPaySchema.safeParse({ mode: "upi", reference_number: "UTR1" }).success).toBe(
      true,
    );
  });
});

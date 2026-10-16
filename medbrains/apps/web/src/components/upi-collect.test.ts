import { describe, expect, it } from "vitest";
import { upiCollectSchema } from "./UpiCollectPanel";

describe("upiCollectSchema", () => {
  it("accepts an Indian mobile with the patient's UPI ID", () => {
    expect(upiCollectSchema.safeParse({ phone: "9876543210", vpa: "ravi.k@okaxis" }).success).toBe(
      true,
    );
  });

  it("refuses a bad mobile, and a missing or malformed UPI ID", () => {
    expect(upiCollectSchema.safeParse({ phone: "12345", vpa: "a@okaxis" }).success).toBe(false);
    expect(upiCollectSchema.safeParse({ phone: "5876543210", vpa: "a@okaxis" }).success).toBe(
      false,
    );
    expect(upiCollectSchema.safeParse({ phone: "9876543210", vpa: "" }).success).toBe(false);
    expect(upiCollectSchema.safeParse({ phone: "9876543210", vpa: "ravi" }).success).toBe(false);
  });
});

import type { ClaimSettlementPosting } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { canDecide, settlementView } from "./claim-settlements";

const posting = (over: Partial<ClaimSettlementPosting>): ClaimSettlementPosting =>
  ({
    status: "pending",
    recorded_by: "maker",
    settled_amount: "8000.00",
    tds_amount: "800.00",
    invoice_total: "10000.00",
    invoice_paid: "1000.00",
    deductions: [
      { reason: "Room rent cap", amount: "600", treatment: "patient" },
      { reason: "Tariff", amount: "400", treatment: "write_off" },
    ],
    ...over,
  }) as ClaimSettlementPosting;

describe("settlementView", () => {
  it("posts the gross, writes off the hospital's share, leaves the patient's owing", () => {
    const v = settlementView(posting({}));
    expect(v).toMatchObject({
      net: 7200,
      open: 9000,
      toPost: 8000,
      excess: 0,
      leftOwing: 600,
      writeOff: 400,
    });
  });

  it("never posts past the bill's open balance", () => {
    const v = settlementView(posting({ settled_amount: "9500.00" }));
    expect([v.toPost, v.excess]).toEqual([9000, 500]);
  });
});

describe("canDecide", () => {
  it("keeps the recorder from approving their own settlement", () => {
    expect(canDecide(posting({}), "maker")).toBe(false);
    expect(canDecide(posting({}), "checker")).toBe(true);
    expect(canDecide(posting({ recorded_by: null }), "checker")).toBe(true);
    expect(canDecide(posting({ status: "approved" }), "checker")).toBe(false);
  });
});

import type { NhcxPayment, NhcxTask } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { adjudicationRows, paymentFlag, taskAnswer } from "./claimNhcx";

describe("adjudicationRows", () => {
  it("names each payer line by the line sent and marks the cut ones", () => {
    const rows = adjudicationRows(
      [
        { sequence: 1, code: "RR", description: "Room rent", quantity: 3, net: "9000.00" },
        { sequence: 2, code: "OT", description: "OT charges", quantity: 1, net: "20000.00" },
      ],
      {
        use_: "claim",
        outcome: "complete",
        disposition: null,
        pre_auth_ref: null,
        submitted: "29000",
        approved: "26000",
        deducted: "3000",
        lines: [
          {
            sequence: 1,
            submitted: "9000",
            approved: "6000",
            deducted: "3000",
            reasons: ["Room rent cap"],
          },
          { sequence: 2, submitted: "20000", approved: "20000", deducted: "0", reasons: [] },
        ],
      },
    );
    expect(rows.map((r) => [r.description, r.isCut])).toEqual([
      ["Room rent", true],
      ["OT charges", false],
    ]);
    expect(rows[0]?.reasons).toEqual(["Room rent cap"]);
  });

  it("never shows a line the payer has not decided as approved", () => {
    const rows = adjudicationRows(
      [{ sequence: 1, code: null, description: "Drugs", quantity: 1, net: "500" }],
      null,
    );
    expect(rows[0]?.approved).toBeNull();
    expect(rows[0]?.submitted).toBe("500");
  });
});

describe("taskAnswer and paymentFlag", () => {
  it("is null until the payer answers", () => {
    const task = { result: null } as unknown as NhcxTask;
    expect(taskAnswer(task)).toBeNull();
  });

  it("flags an unmatched payment before a mismatched one", () => {
    const p = { status: "unmatched", is_mismatch: true, stage: "33" } as NhcxPayment;
    expect(paymentFlag(p).label).toBe("No claim matched");
    expect(paymentFlag({ ...p, status: "posted" }).tone).toBe("warning");
    expect(paymentFlag({ ...p, status: "posted", is_mismatch: false }).tone).toBe("success");
  });

  it("never presents an initiated or processed notice as money", () => {
    const p = { status: "advice", is_mismatch: false, stage: "30" } as NhcxPayment;
    expect(paymentFlag(p)).toEqual({ label: "Payment initiated — not paid yet", tone: "info" });
    expect(paymentFlag({ ...p, stage: "31" }).label).toBe("Payment processed — not settled yet");
    const unstated = { ...p, status: "unmatched", stage: null } as NhcxPayment;
    expect(paymentFlag(unstated).tone).toBe("warning");
  });
});

// @vitest-environment node

import {
  PHARMACY_RX_STATUS_VALUES,
  pharmacyRxPriorityLabel,
  pharmacyRxPriorityLabelKey,
  pharmacyRxPrioritySignal,
  pharmacyRxSourceLabel,
  pharmacyRxSourceLabelKey,
  pharmacyRxSourceSignal,
  pharmacyRxStatusLabel,
  pharmacyRxStatusLabelKey,
  pharmacyRxStatusSignal,
} from "@medbrains/types";
import { describe, expect, it } from "vitest";

describe("pharmacy Rx operational signals", () => {
  it("keeps review statuses in the pharmacist handoff order", () => {
    expect(PHARMACY_RX_STATUS_VALUES).toEqual([
      "pending_review",
      "approved",
      "rejected",
      "on_hold",
      "dispensing",
      "dispensed",
      "partially_dispensed",
      "cancelled",
    ]);
  });

  it("maps prescription review statuses to scannable safety shapes", () => {
    expect(pharmacyRxStatusSignal("pending_review")).toEqual({
      phase: "pending_review",
      shape: "diamond",
      tone: "blocked",
    });
    expect(pharmacyRxStatusSignal("on_hold")).toEqual({
      phase: "blocked",
      shape: "diamond",
      tone: "blocked",
    });
    expect(pharmacyRxStatusSignal("dispensing")).toEqual({
      phase: "dispensing",
      shape: "token",
      tone: "active",
    });
    expect(pharmacyRxStatusSignal("partially_dispensed")).toEqual({
      phase: "dispensing",
      shape: "token",
      tone: "active",
    });
    expect(pharmacyRxStatusSignal("dispensed")).toEqual({
      phase: "dispensed",
      shape: "pill",
      tone: "ready",
    });
    expect(pharmacyRxStatusSignal("cancelled")).toEqual({
      phase: "cancelled",
      shape: "diamond",
      tone: "risk",
    });
  });

  it("marks urgent clinical sources before ordinary dispensing work", () => {
    expect(pharmacyRxPrioritySignal("urgent")).toEqual({
      phase: "urgent",
      shape: "diamond",
      tone: "risk",
    });
    expect(pharmacyRxPrioritySignal("high")).toEqual({
      phase: "safety_priority",
      shape: "diamond",
      tone: "blocked",
    });
    expect(pharmacyRxPrioritySignal("normal")).toEqual({
      phase: "normal",
      shape: "pill",
      tone: "neutral",
    });
    expect(pharmacyRxSourceSignal("emergency")).toEqual({
      phase: "emergency",
      shape: "diamond",
      tone: "risk",
    });
    expect(pharmacyRxSourceSignal("opd")).toEqual({
      phase: "care_area",
      shape: "token",
      tone: "active",
    });
  });

  it("keeps prescription status, priority and source labels on the shared signal contract", () => {
    expect(pharmacyRxStatusLabelKey("pending_review")).toBe("rxStatus.pending_review");
    expect(pharmacyRxStatusLabelKey("partially_dispensed")).toBe("rxStatus.partially_dispensed");
    expect(pharmacyRxStatusLabel("dispensing")).toBe("Billing / dispense");
    expect(pharmacyRxStatusLabel("custom_status")).toBe("custom status");
    expect(pharmacyRxStatusLabelKey("custom_status")).toBeNull();

    expect(pharmacyRxPriorityLabelKey("urgent")).toBe("rxPriority.urgent");
    expect(pharmacyRxPriorityLabel("high")).toBe("High");
    expect(pharmacyRxPriorityLabel("custom_priority")).toBe("custom priority");
    expect(pharmacyRxPriorityLabelKey("custom_priority")).toBeNull();

    expect(pharmacyRxSourceLabelKey("direct_sale")).toBe("rxSource.direct_sale");
    expect(pharmacyRxSourceLabel("opd")).toBe("OPD");
    expect(pharmacyRxSourceLabel("custom_source")).toBe("custom source");
    expect(pharmacyRxSourceLabelKey("custom_source")).toBeNull();
  });
});

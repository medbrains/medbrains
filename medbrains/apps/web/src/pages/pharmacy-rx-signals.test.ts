// @vitest-environment node

import {
  PHARMACY_RX_STATUS_VALUES,
  pharmacyRxPrioritySignal,
  pharmacyRxSourceSignal,
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
});

// @vitest-environment node

import {
  BED_BOARD_MUTABLE_STATUS_VALUES,
  BED_BOARD_STATUS_VALUES,
  bedBoardStatusIsAssignable,
  bedBoardStatusSignal,
} from "@medbrains/types";
import { describe, expect, it } from "vitest";

describe("IPD bed-board operational signals", () => {
  it("keeps bed dashboard status ordering aligned to hospital bed flow", () => {
    expect(BED_BOARD_STATUS_VALUES).toEqual([
      "vacant_clean",
      "vacant_dirty",
      "occupied",
      "occupied_transfer_pending",
      "reserved",
      "maintenance",
      "blocked",
    ]);
    expect(BED_BOARD_MUTABLE_STATUS_VALUES).toEqual([
      "vacant_clean",
      "vacant_dirty",
      "maintenance",
      "blocked",
    ]);
  });

  it("maps bed statuses to reusable assignment shapes", () => {
    expect(bedBoardStatusSignal("vacant_clean")).toEqual({
      assignment: "assignable",
      phase: "assignable",
      shape: "bed",
      tone: "ready",
    });
    expect(bedBoardStatusSignal("vacant_dirty")).toEqual({
      assignment: "blocked",
      phase: "turnover",
      shape: "diamond",
      tone: "blocked",
    });
    expect(bedBoardStatusSignal("occupied")).toEqual({
      assignment: "occupied",
      phase: "active_care",
      shape: "bed",
      tone: "active",
    });
    expect(bedBoardStatusSignal("blocked")).toEqual({
      assignment: "blocked",
      phase: "blocked",
      shape: "diamond",
      tone: "risk",
    });
    expect(bedBoardStatusSignal("waiting")).toEqual({
      assignment: "blocked",
      phase: "waiting",
      shape: "token",
      tone: "blocked",
    });
  });

  it("allows only clean vacant beds to accept assignment", () => {
    expect(bedBoardStatusIsAssignable("vacant_clean")).toBe(true);
    expect(bedBoardStatusIsAssignable("vacant_dirty")).toBe(false);
    expect(bedBoardStatusIsAssignable("reserved")).toBe(false);
    expect(bedBoardStatusIsAssignable("occupied_transfer_pending")).toBe(false);
  });
});

// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BED_BOARD_MUTABLE_STATUS_VALUES,
  BED_BOARD_SIGNAL_STATUS_VALUES,
  BED_BOARD_STATUS_VALUES,
  bedBoardSignalLabel,
  bedBoardSignalLabelKey,
  bedBoardStatusIsAssignable,
  bedBoardStatusLabel,
  bedBoardStatusLabelKey,
  bedBoardStatusSignal,
  isBedBoardSignalStatus,
} from "@medbrains/types";
import { describe, expect, it } from "vitest";

function ipdLocale(): Record<string, string> {
  return JSON.parse(
    readFileSync(join(process.cwd(), "public/locales/en/ipd.json"), "utf8"),
  ) as Record<string, string>;
}

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
    expect(BED_BOARD_SIGNAL_STATUS_VALUES).toEqual([...BED_BOARD_STATUS_VALUES, "waiting"]);
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

  it("keeps bed status and signal labels shared with IPD and TV surfaces", () => {
    expect(isBedBoardSignalStatus("vacant_clean")).toBe(true);
    expect(isBedBoardSignalStatus("waiting")).toBe(true);
    expect(isBedBoardSignalStatus("unknown_status")).toBe(false);

    expect(bedBoardStatusLabelKey("vacant_clean")).toBe("bedDashboard.status.vacant_clean");
    expect(bedBoardStatusLabelKey("occupied_transfer_pending")).toBe(
      "bedDashboard.status.occupied_transfer_pending",
    );
    expect(bedBoardStatusLabel("occupied_transfer_pending")).toBe("Transfer pending");
    expect(bedBoardStatusLabel("unknown_status")).toBe("unknown status");
    expect(bedBoardStatusLabelKey("unknown_status")).toBeNull();

    expect(bedBoardSignalLabelKey("vacant_dirty")).toBe("bedDashboard.signal.vacant_dirty");
    expect(bedBoardSignalLabelKey("waiting")).toBe("bedDashboard.signal.waiting");
    expect(bedBoardSignalLabel("vacant_clean")).toBe("Assignment ready");
    expect(bedBoardSignalLabel("unknown_status")).toBe("unknown status");
    expect(bedBoardSignalLabelKey("unknown_status")).toBeNull();
  });

  it("backs every bed board status and signal label with IPD i18n copy", () => {
    const locale = ipdLocale();

    for (const status of BED_BOARD_SIGNAL_STATUS_VALUES) {
      const statusKey = bedBoardStatusLabelKey(status);
      const signalKey = bedBoardSignalLabelKey(status);

      if (!statusKey || !signalKey) {
        throw new Error(`Missing bed-board i18n keys for ${status}`);
      }

      expect(locale[statusKey]).toBe(bedBoardStatusLabel(status));
      expect(locale[signalKey]).toBe(bedBoardSignalLabel(status));
    }
  });
});

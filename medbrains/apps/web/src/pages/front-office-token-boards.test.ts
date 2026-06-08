// @vitest-environment node

import type {
  BillingQueueToken,
  LabQueueToken,
  PharmacyQueueToken,
  QueueToken,
  RadiologyQueueToken,
} from "@medbrains/types";
import {
  TOKEN_BOARD_FAST_REFRESH_MS,
  TOKEN_BOARD_STANDARD_REFRESH_MS,
  TOKEN_BOARD_SURFACE_LIST,
  TOKEN_BOARD_SURFACES,
  tokenBoardFeedReadiness,
  tokenBoardOperationalReadinessItems,
  tokenBoardRefreshLabel,
} from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  billingDisplayToken,
  type DisplayToken,
  labDisplayToken,
  opdDisplayToken,
  pharmacyDisplayToken,
  radiologyDisplayToken,
  tokenBoardDisplayModeFromSearchParams,
  tokenBoardFilterFromSearchParams,
  updateTokenBoardFilterSearchParams,
} from "./front-office-token-boards";

const hiddenValues = [
  "Asha Raman",
  "patient-secret",
  "ABHA-1234",
  "Complete blood count",
  "Pregnancy preparation",
  "Paracetamol",
  "12500",
];

function expectPublicTokenOnly(value: DisplayToken) {
  const rendered = JSON.stringify(value);

  expect(Object.keys(value).sort()).toEqual(["meta", "status", "tokenNumber"]);
  for (const hidden of hiddenValues) {
    expect(rendered).not.toContain(hidden);
  }
}

describe("front-office token-board display mapping", () => {
  it("parses shared web and kiosk token-board route filters", () => {
    expect(tokenBoardFilterFromSearchParams(new URLSearchParams("board=pharmacy"))).toBe(
      "pharmacy",
    );
    expect(
      tokenBoardFilterFromSearchParams(new URLSearchParams("board=billing&display=kiosk")),
    ).toBe("billing");
    expect(tokenBoardFilterFromSearchParams(new URLSearchParams("board=unknown"))).toBe("all");
    expect(tokenBoardFilterFromSearchParams(new URLSearchParams("display=kiosk"))).toBe("all");
    expect(tokenBoardDisplayModeFromSearchParams(new URLSearchParams("display=kiosk"))).toBe(
      "kiosk",
    );
    expect(tokenBoardDisplayModeFromSearchParams(new URLSearchParams("display=workspace"))).toBe(
      "workspace",
    );

    const kioskParams = new URLSearchParams("board=opd&display=kiosk&tenant=demo");
    expect(String(updateTokenBoardFilterSearchParams(kioskParams, "lab"))).toBe(
      "board=lab&display=kiosk&tenant=demo",
    );
    expect(String(updateTokenBoardFilterSearchParams(kioskParams, "all"))).toBe(
      "display=kiosk&tenant=demo",
    );
  });

  it("keeps board launch targets focused to the same surface on web and mobile", () => {
    for (const surface of TOKEN_BOARD_SURFACE_LIST) {
      expect(surface.targets.webPath).toBe(`/front-office?board=${surface.id}#token-boards`);
      expect(surface.targets.kioskPath).toBe(
        `/front-office?board=${surface.id}&display=kiosk#token-boards`,
      );
      expect(surface.targets.mobileParams.surface).toBe(surface.id);
      expect(surface.targets.mobileRoute).toBe("TokenBoards");
      expect(surface.targets.tvDeepLink).toContain("medbrains://tv/");
      expect(surface.readiness.privacy).toBe("Token only");
      expect(tokenBoardRefreshLabel(surface)).toMatch(/^\d+s$/);
    }
  });

  it("keeps shared token-board refresh intervals and feed readiness deterministic", () => {
    const refreshBySurface = Object.fromEntries(
      TOKEN_BOARD_SURFACE_LIST.map((surface) => [surface.id, surface.refreshIntervalMs]),
    );
    const nowMs = Date.parse("2026-06-06T08:00:00.000Z");

    expect(refreshBySurface).toEqual({
      billing: TOKEN_BOARD_STANDARD_REFRESH_MS,
      emergency: TOKEN_BOARD_FAST_REFRESH_MS,
      lab: TOKEN_BOARD_STANDARD_REFRESH_MS,
      opd: TOKEN_BOARD_FAST_REFRESH_MS,
      pharmacy: TOKEN_BOARD_STANDARD_REFRESH_MS,
      radiology: TOKEN_BOARD_STANDARD_REFRESH_MS,
    });
    expect(
      tokenBoardFeedReadiness({
        isError: false,
        nowMs,
        refreshIntervalMs: TOKEN_BOARD_FAST_REFRESH_MS,
        updatedAt: 0,
      }),
    ).toEqual({ label: "Feed", tone: "warning", value: "Waiting" });
    expect(
      tokenBoardFeedReadiness({
        isError: false,
        nowMs,
        refreshIntervalMs: TOKEN_BOARD_FAST_REFRESH_MS,
        updatedAt: nowMs - TOKEN_BOARD_FAST_REFRESH_MS,
      }),
    ).toEqual({ label: "Feed", tone: "success", value: "Live" });
    expect(
      tokenBoardFeedReadiness({
        isError: false,
        nowMs,
        refreshIntervalMs: TOKEN_BOARD_FAST_REFRESH_MS,
        updatedAt: nowMs - TOKEN_BOARD_FAST_REFRESH_MS * 4,
      }),
    ).toEqual({ label: "Feed", tone: "warning", value: "Stale" });
    expect(
      tokenBoardFeedReadiness({
        isError: true,
        nowMs,
        refreshIntervalMs: TOKEN_BOARD_FAST_REFRESH_MS,
        updatedAt: nowMs,
      }),
    ).toEqual({ label: "Feed", tone: "danger", value: "Degraded" });
    expect(
      tokenBoardOperationalReadinessItems({
        isError: false,
        nowMs,
        surface: TOKEN_BOARD_SURFACES.emergency,
        updatedAt: nowMs,
      }),
    ).toEqual([
      { label: "Privacy", tone: "success", value: "Token only" },
      { label: "Feed", tone: "success", value: "Live" },
      { label: "Refresh", tone: "info", value: "5s" },
      { label: "Flow", tone: "danger", value: "Triage" },
    ]);
  });

  it("keeps OPD public display tokens free of patient identifiers", () => {
    const token: QueueToken = {
      called_at: null,
      completed_at: null,
      created_at: "2026-06-05T08:00:00.000Z",
      department_id: "general-medicine",
      doctor_id: "doctor-1",
      id: "token-1",
      patient_id: "patient-secret",
      priority: "normal",
      status: "waiting",
      tenant_id: "tenant-1",
      token_date: "2026-06-05",
      token_number: "OPD-014",
      token_seq: 14,
    };

    expect(opdDisplayToken(token)).toEqual({
      meta: "Standard priority",
      status: "waiting",
      tokenNumber: "OPD-014",
    });
    expectPublicTokenOnly(opdDisplayToken(token));
  });

  it("keeps lab, radiology, pharmacy and billing public displays token-only", () => {
    const lab: LabQueueToken = {
      counter: 2,
      is_fasting: true,
      is_pediatric: false,
      patient_name: "Asha Raman",
      status: "waiting",
      test_count: 3,
      token_number: "LAB-009",
    };
    const radiology: RadiologyQueueToken = {
      modality: "X-ray",
      patient_name: "Asha Raman",
      preparation_instructions: "Pregnancy preparation",
      room_number: "Room 4",
      status: "called",
      token_number: "RAD-004",
    };
    const pharmacy: PharmacyQueueToken = {
      counter: 1,
      estimated_wait_minutes: 12,
      patient_name: "Asha Raman",
      prescription_count: 2,
      status: "preparing",
      token_number: "PHA-021",
    };
    const billing: BillingQueueToken = {
      counter: 3,
      patient_name: "Asha Raman",
      queue_type: "IPD discharge",
      status: "issued",
      token_number: "BIL-011",
    };

    expect(labDisplayToken(lab)).toEqual({
      meta: "3 tests · Counter 2 · Fasting",
      status: "waiting",
      tokenNumber: "LAB-009",
    });
    expect(radiologyDisplayToken(radiology)).toEqual({
      meta: "X-ray · Room 4",
      status: "called",
      tokenNumber: "RAD-004",
    });
    expect(pharmacyDisplayToken(pharmacy)).toEqual({
      meta: "2 items · Counter 1 · 12 min wait",
      status: "preparing",
      tokenNumber: "PHA-021",
    });
    expect(billingDisplayToken(billing)).toEqual({
      meta: "IPD discharge · Counter 3",
      status: "issued",
      tokenNumber: "BIL-011",
    });

    for (const token of [
      labDisplayToken(lab),
      radiologyDisplayToken(radiology),
      pharmacyDisplayToken(pharmacy),
      billingDisplayToken(billing),
    ]) {
      expectPublicTokenOnly(token);
    }
  });
});

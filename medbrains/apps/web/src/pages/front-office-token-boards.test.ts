// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  BillingQueueDisplay,
  BillingQueueToken,
  LabQueueToken,
  ModuleToken,
  PharmacyQueueToken,
  RadiologyQueueToken,
} from "@medbrains/types";
import {
  BILLING_QUEUE_LANES,
  isTokenBoardSurfaceId,
  TOKEN_BOARD_FAST_REFRESH_MS,
  TOKEN_BOARD_STANDARD_REFRESH_MS,
  TOKEN_BOARD_STATUS_VALUES,
  TOKEN_BOARD_SURFACE_LIST,
  TOKEN_BOARD_SURFACES,
  tokenBoardFeedReadiness,
  tokenBoardMobileRouteParams,
  tokenBoardOperationalReadinessItems,
  tokenBoardReadinessLabel,
  tokenBoardReadinessLabelKey,
  tokenBoardReadinessValue,
  tokenBoardReadinessValueKey,
  tokenBoardRefreshLabel,
  tokenBoardRefreshValueKey,
  tokenBoardStatusLabel,
  tokenBoardStatusLabelKey,
  tokenBoardStatusSignal,
  tokenBoardSurfaceFilterFromParam,
  tokenBoardSurfaceFlowLabelKey,
} from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { mobilePatientJourneyText } from "../../../mobile/src/components/patientJourneyText";
import {
  billingDisplayToken,
  type DisplayToken,
  labDisplayToken,
  opdDisplayToken,
  pharmacyDisplayToken,
  radiologyDisplayToken,
  tokenBoardDisplayModeFromSearchParams,
  tokenBoardFilterFromSearchParams,
  tokenBoardFilterRoute,
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

  expect(Object.keys(value).sort()).toEqual(["meta", "signal", "status", "tokenNumber"]);
  for (const hidden of hiddenValues) {
    expect(rendered).not.toContain(hidden);
  }
}

function frontOfficeLocale(): Record<string, string> {
  return JSON.parse(
    readFileSync(join(process.cwd(), "public/locales/en/frontOffice.json"), "utf8"),
  ) as Record<string, string>;
}

function mobileTokenBoardKey(sharedKey: string): string {
  return `patientJourney.mobile.${sharedKey}`;
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
    expect(isTokenBoardSurfaceId("opd")).toBe(true);
    expect(isTokenBoardSurfaceId("billing")).toBe(true);
    expect(isTokenBoardSurfaceId("unknown")).toBe(false);
    expect(isTokenBoardSurfaceId("prototype")).toBe(false);
    expect(isTokenBoardSurfaceId(null)).toBe(false);
    expect(tokenBoardSurfaceFilterFromParam("radiology")).toBe("radiology");
    expect(tokenBoardSurfaceFilterFromParam("unknown")).toBe("all");
    expect(tokenBoardSurfaceFilterFromParam(undefined)).toBe("all");

    const kioskParams = new URLSearchParams("board=opd&display=kiosk&tenant=demo");
    expect(String(updateTokenBoardFilterSearchParams(kioskParams, "lab"))).toBe(
      "board=lab&display=kiosk&tenant=demo",
    );
    expect(String(updateTokenBoardFilterSearchParams(kioskParams, "all"))).toBe(
      "display=kiosk&tenant=demo",
    );
    expect(tokenBoardFilterRoute("/front-office", kioskParams, "billing")).toEqual({
      hash: "token-boards",
      pathname: "/front-office",
      search: "board=billing&display=kiosk&tenant=demo",
    });
    expect(tokenBoardFilterRoute("/front-office", kioskParams, "all")).toEqual({
      hash: "token-boards",
      pathname: "/front-office",
      search: "display=kiosk&tenant=demo",
    });
  });

  it("keeps board launch targets focused to the same surface on web and mobile", () => {
    for (const surface of TOKEN_BOARD_SURFACE_LIST) {
      expect(surface.targets.webPath).toBe(`/front-office?board=${surface.id}#token-boards`);
      expect(surface.targets.kioskPath).toBe(
        `/front-office?board=${surface.id}&display=kiosk#token-boards`,
      );
      expect(surface.targets.mobileParams.surface).toBe(surface.id);
      expect(tokenBoardMobileRouteParams(surface.id)).toEqual(surface.targets.mobileParams);
      expect(surface.targets.mobileRoute).toBe("TokenBoards");
      expect(surface.targets.tvDeepLink).toContain("medbrains://tv/");
      expect(surface.readiness.privacy).toBe("Token only");
      expect(tokenBoardRefreshLabel(surface)).toMatch(/^\d+s$/);
    }
    expect(tokenBoardMobileRouteParams("all")).toBeUndefined();
  });

  it("keeps billing counter lanes complete and in operational order", () => {
    expect(BILLING_QUEUE_LANES.map((lane) => lane.key)).toEqual([
      "opd_billing",
      "ipd_discharge",
      "advance_deposit",
      "insurance_desk",
    ]);
    expect(BILLING_QUEUE_LANES.map((lane) => lane.title)).toEqual([
      "OPD billing",
      "IPD discharge",
      "Advance deposit",
      "Insurance desk",
    ]);

    const display: BillingQueueDisplay = {
      advance_deposit: [
        {
          counter: 4,
          patient_name: "Asha Raman",
          queue_type: "Advance deposit",
          status: "active",
          token_number: "ADV-004",
        },
      ],
      insurance_desk: [],
      ipd_discharge: [],
      opd_billing: [],
    };
    const advanceLane = BILLING_QUEUE_LANES.find((lane) => lane.key === "advance_deposit");

    expect(advanceLane?.emptyLabel).toBe("No advance deposit tokens");
    expect(advanceLane ? display[advanceLane.key].map(billingDisplayToken) : []).toEqual([
      {
        meta: "Advance deposit · Counter 4",
        signal: tokenBoardStatusSignal("active"),
        status: "active",
        tokenNumber: "ADV-004",
      },
    ]);
  });

  it("keeps shared token-board refresh intervals and feed readiness deterministic", () => {
    const refreshBySurface = Object.fromEntries(
      TOKEN_BOARD_SURFACE_LIST.map((surface) => [surface.id, surface.refreshIntervalMs]),
    );
    const nowMs = Date.parse("2026-06-06T08:00:00.000Z");

    expect(refreshBySurface).toEqual({
      billing: TOKEN_BOARD_STANDARD_REFRESH_MS,
      // Camp boards refresh fast: a camp queue turns over quicker than a
      // hospital department's.
      camp: TOKEN_BOARD_FAST_REFRESH_MS,
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

  it("keeps token-board status labels shared across web, mobile and TV surfaces", () => {
    expect(tokenBoardStatusLabelKey("collection_in_progress")).toBe(
      "tokenBoards.status.collectionInProgress",
    );
    expect(tokenBoardStatusLabelKey("partially_paid")).toBe("tokenBoards.status.partiallyPaid");
    expect(tokenBoardStatusLabel("collection_in_progress")).toBe("Collection in progress");
    expect(tokenBoardStatusLabel("partially_paid")).toBe("Partially paid");
    expect(tokenBoardStatusLabel("custom_status")).toBe("custom status");
    expect(tokenBoardStatusLabelKey("custom_status")).toBeNull();
  });

  it("backs every shared token-board status label with web and mobile i18n copy", () => {
    const locale = frontOfficeLocale();

    for (const status of TOKEN_BOARD_STATUS_VALUES) {
      const key = tokenBoardStatusLabelKey(status);
      if (!key) {
        throw new Error(`Missing token-board status i18n key for ${status}`);
      }

      const fallback = tokenBoardStatusLabel(status);

      expect(locale[key]).toBe(fallback);
      expect(mobilePatientJourneyText(mobileTokenBoardKey(key))).toBe(fallback);
    }
  });

  it("keeps token-board readiness labels and values shared across device surfaces", () => {
    expect(tokenBoardReadinessLabelKey("Privacy")).toBe("tokenBoards.readiness.labels.privacy");
    expect(tokenBoardReadinessLabelKey("Feed")).toBe("tokenBoards.readiness.labels.feed");
    expect(tokenBoardReadinessLabelKey("Refresh")).toBe("tokenBoards.readiness.labels.refresh");
    expect(tokenBoardReadinessLabelKey("Flow")).toBe("tokenBoards.readiness.labels.flow");
    expect(tokenBoardReadinessLabelKey("Unknown")).toBeNull();
    expect(tokenBoardReadinessLabel("Unknown")).toBe("Unknown");

    expect(tokenBoardReadinessValueKey("Token only")).toBe(
      "tokenBoards.readiness.values.tokenOnly",
    );
    expect(tokenBoardReadinessValueKey("Degraded")).toBe("tokenBoards.readiness.values.degraded");
    expect(tokenBoardReadinessValueKey("Live")).toBe("tokenBoards.readiness.values.live");
    expect(tokenBoardReadinessValueKey("Stale")).toBe("tokenBoards.readiness.values.stale");
    expect(tokenBoardReadinessValueKey("Waiting")).toBe("tokenBoards.readiness.values.waiting");
    expect(tokenBoardReadinessValueKey("Custom")).toBeNull();
    expect(tokenBoardReadinessValue("Custom")).toBe("Custom");

    expect(tokenBoardRefreshValueKey()).toBe("tokenBoards.readiness.values.refreshSeconds");
    expect(tokenBoardSurfaceFlowLabelKey("billing")).toBe("tokenBoards.surfaces.billing.flow");
    expect(tokenBoardSurfaceFlowLabelKey("emergency")).toBe("tokenBoards.surfaces.emergency.flow");
    expect(tokenBoardSurfaceFlowLabelKey("pharmacy")).toBe("tokenBoards.surfaces.pharmacy.flow");
  });

  it("keeps OPD public display tokens free of patient identifiers", () => {
    // The board now reads the unified `tokens` table, whose rows carry
    // `patient_name`. `queue_tokens` never did, so this test used to prove the
    // mapping dropped a field that was not there. The name is in the fixture on
    // purpose: it is the thing that must not reach a waiting-room screen.
    const token: ModuleToken = {
      called_at: null,
      completed_at: null,
      created_at: "2026-06-05T08:00:00.000Z",
      id: "token-1",
      module: "opd",
      number: "OPD-014",
      patient_id: "patient-secret",
      patient_name: "Asha Raman",
      priority: "normal",
      scope: "department",
      scope_id: "general-medicine",
      seq: 14,
      served_at: null,
      status: "waiting",
      token_date: "2026-06-05",
    };

    expect(opdDisplayToken(token)).toEqual({
      meta: "Standard priority",
      signal: tokenBoardStatusSignal("waiting"),
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
      signal: tokenBoardStatusSignal("waiting"),
      status: "waiting",
      tokenNumber: "LAB-009",
    });
    expect(radiologyDisplayToken(radiology)).toEqual({
      meta: "X-ray · Room 4",
      signal: tokenBoardStatusSignal("called"),
      status: "called",
      tokenNumber: "RAD-004",
    });
    expect(pharmacyDisplayToken(pharmacy)).toEqual({
      meta: "2 items · Counter 1 · 12 min wait",
      signal: tokenBoardStatusSignal("preparing"),
      status: "preparing",
      tokenNumber: "PHA-021",
    });
    expect(billingDisplayToken(billing)).toEqual({
      meta: "IPD discharge · Counter 3",
      signal: tokenBoardStatusSignal("issued"),
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

  it("maps token statuses to shared operational shapes for web, mobile and TV", () => {
    expect(tokenBoardStatusSignal("called")).toEqual({
      emphasis: "high",
      phase: "serving",
      shape: "diamond",
      tone: "success",
    });
    expect(tokenBoardStatusSignal("waiting")).toEqual({
      emphasis: "low",
      phase: "waiting",
      shape: "ring",
      tone: "neutral",
    });
    expect(tokenBoardStatusSignal("preparing")).toEqual({
      emphasis: "medium",
      phase: "in_progress",
      shape: "pill",
      tone: "warning",
    });
    expect(tokenBoardStatusSignal("ready")).toEqual({
      emphasis: "high",
      phase: "ready",
      shape: "circle",
      tone: "success",
    });
    expect(tokenBoardStatusSignal("no_show")).toEqual({
      emphasis: "high",
      phase: "blocked",
      shape: "square",
      tone: "danger",
    });
  });
});

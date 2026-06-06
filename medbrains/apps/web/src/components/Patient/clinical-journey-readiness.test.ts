// @vitest-environment node

import { resolveClinicalJourneyActions, summarizeClinicalJourneyActions } from "@medbrains/types";
import { describe, expect, it } from "vitest";

const allowAll = () => true;
const denyAll = () => false;

describe("clinical journey readiness summary", () => {
  it("classifies mobile patient handoffs by the current blocker", () => {
    const actions = resolveClinicalJourneyActions({ patientId: "patient-1" }, allowAll, "mobile", {
      includePermissionDenied: true,
    });
    const summary = summarizeClinicalJourneyActions(actions);

    expect(summary).toMatchObject({
      blocked: 9,
      contextBlocked: 4,
      enabled: 7,
      eventBlocked: 5,
      permissionBlocked: 0,
      total: 16,
    });
    expect(summary.contextBlockedActionIds).toContain("orders.medication");
    expect(summary.eventBlockedActionIds).toContain("pharmacy.open_patient_queue");
    expect(summary.readyActionIds).toContain("billing.open_ledger");
  });

  it("keeps permission-denied actions visible when requested", () => {
    const actions = resolveClinicalJourneyActions(
      {
        activeEncounterId: "encounter-1",
        activeOrderContext: "opd",
        patientId: "patient-1",
      },
      denyAll,
      "mobile",
      { includePermissionDenied: true },
    );
    const summary = summarizeClinicalJourneyActions(actions);

    expect(summary).toMatchObject({
      enabled: 0,
      permissionBlocked: 16,
      total: 16,
    });
    expect(summary.permissionBlockedActionIds).toContain("opd.open_visit");
    expect(summary.permissionBlockedActionIds).toContain("orders.lab");
  });
});

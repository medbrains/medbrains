// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  buildReportEventCoverage,
  REPORT_EVENT_SOURCE_DEFINITIONS,
  summarizeReportEventCoverage,
} from "./report-event-coverage";

describe("report event coverage", () => {
  it("keeps report and indicator evidence tied to registered clinical events", () => {
    const rows = buildReportEventCoverage();
    const summary = summarizeReportEventCoverage(rows);

    expect(rows).toHaveLength(REPORT_EVENT_SOURCE_DEFINITIONS.length);
    expect(rows.every((row) => row.gaps.length === 0)).toBe(true);
    expect(summary).toMatchObject({
      captureNeeded: 0,
      complete: REPORT_EVENT_SOURCE_DEFINITIONS.length,
      eventBacked: REPORT_EVENT_SOURCE_DEFINITIONS.length,
      gaps: 0,
      total: REPORT_EVENT_SOURCE_DEFINITIONS.length,
    });
    expect(summary.journeyActionLinks).toBeGreaterThan(10);
    expect(summary.reportTargets).toBeGreaterThan(20);
    expect(summary.indicatorTargets).toBeGreaterThan(15);
  });

  it("reports missing payload evidence for event-fed report definitions", () => {
    const [row] = buildReportEventCoverage([
      {
        family: "test",
        id: "opd-gap",
        indicatorTargets: ["opd.wait_time"],
        journeyActionIds: ["opd.open_visit"],
        label: "OPD payload gap",
        readiness: "event_backed",
        reportTargets: ["opd-queue-wait-heatmap"],
        requiredPayloadKeys: ["patient_id", "encounter_id", "doctor_id"],
        sourceEvents: ["opd.encounter.created"],
        standardRefs: ["NABH AAC"],
      },
    ]);

    expect(row?.gaps).toEqual(["missing-payload-evidence"]);
    expect(row?.missingPayloadKeys).toEqual(["doctor_id"]);
    expect(row?.availablePayloadKeys).toEqual(["encounter_id", "patient_id"]);
    expect(row?.journeyActionEvents).toEqual(["opd.encounter.created"]);
  });

  it("reports journey action events missing from report event sources", () => {
    const [row] = buildReportEventCoverage([
      {
        family: "test",
        id: "journey-event-gap",
        indicatorTargets: ["opd.wait_time"],
        journeyActionIds: ["opd.open_visit"],
        label: "Journey action source gap",
        readiness: "event_backed",
        reportTargets: ["opd-registration-arrivals"],
        requiredPayloadKeys: ["patient_id"],
        sourceEvents: ["patient.created"],
        standardRefs: ["NABH AAC"],
      },
    ]);

    expect(row?.gaps).toEqual(["missing-journey-event"]);
    expect(row?.journeyActionLabels).toEqual(["New OPD visit"]);
    expect(row?.journeyActionEvents).toEqual(["opd.encounter.created"]);
    expect(row?.missingJourneyActionEvents).toEqual(["opd.encounter.created"]);
  });

  it("keeps emitted patient-flow evidence visible to reports and indicators", () => {
    const rows = buildReportEventCoverage();
    const registration = rows.find((row) => row.id === "patient-registration-opd-flow");
    const ipd = rows.find((row) => row.id === "ipd-census-discharge-flow");
    const diagnostics = rows.find((row) => row.id === "diagnostic-order-result-flow");
    const pharmacy = rows.find((row) => row.id === "pharmacy-fulfillment-regulatory-flow");

    expect(registration?.sourceEvents).toEqual(
      expect.arrayContaining([
        "patient.updated",
        "patient.search.completed",
        "patient.access_shared",
        "patient.card_printed",
        "opd.vitals.recorded",
        "opd.consultation.saved",
        "opd.prescription.updated",
        "opd.certificate.created",
        "opd.consent.signed",
      ]),
    );
    expect(registration?.requiredPayloadKeys).toEqual(
      expect.arrayContaining(["search_id", "consultation_id", "prescription_id", "consent_id"]),
    );
    expect(registration?.journeyActionIds).toEqual(
      expect.arrayContaining(["opd.open_visit", "patient.print_card", "patient.share"]),
    );
    expect(registration?.journeyActionEvents).toEqual(
      expect.arrayContaining([
        "opd.encounter.created",
        "patient.access_shared",
        "patient.card_printed",
      ]),
    );

    expect(ipd?.sourceEvents).toEqual(
      expect.arrayContaining(["mrd.case_sheet.generated", "mrd.case_sheet.printed"]),
    );
    expect(ipd?.requiredPayloadKeys).toEqual(expect.arrayContaining(["packet_id", "packet_type"]));

    expect(diagnostics?.sourceEvents).toEqual(
      expect.arrayContaining(["order.cancelled", "lab.result.posted"]),
    );
    expect(diagnostics?.requiredPayloadKeys).toContain("reason");

    expect(pharmacy?.sourceEvents).toContain("order.cancelled");
    expect(pharmacy?.requiredPayloadKeys).toContain("reason");
    expect(pharmacy?.journeyActionEvents).toEqual(
      expect.arrayContaining(["order.created", "pharmacy.order.dispensed"]),
    );
  });
});

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
    expect(summary.reportTargets).toBeGreaterThan(20);
    expect(summary.indicatorTargets).toBeGreaterThan(15);
  });

  it("reports missing payload evidence for event-fed report definitions", () => {
    const [row] = buildReportEventCoverage([
      {
        family: "test",
        id: "opd-gap",
        indicatorTargets: ["opd.wait_time"],
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
  });
});

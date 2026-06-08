// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  bedBoardStatusSignal,
  clinicalJourneyActionSignal,
  patientContextSignal,
  pharmacyRxStatusSignal,
  WORKFLOW_SIGNAL_SHAPE_DEFINITIONS,
  WORKFLOW_SIGNAL_SHAPES,
  type WorkflowSignalShape,
} from "@medbrains/types";
import { describe, expect, it } from "vitest";

function getPathValue(source: unknown, path: string): unknown {
  let value = source;

  for (const segment of path.split(".")) {
    if (value === null || typeof value !== "object") return undefined;

    const descriptor = Object.getOwnPropertyDescriptor(value, segment);
    if (!descriptor) return undefined;
    value = descriptor.value;
  }

  return value;
}

function semantic(shape: WorkflowSignalShape) {
  return WORKFLOW_SIGNAL_SHAPE_DEFINITIONS[shape].semantic;
}

describe("operational signal shape grammar", () => {
  it("keeps every reusable shape backed by clinical i18n copy", () => {
    const locale: unknown = JSON.parse(
      readFileSync(join(process.cwd(), "public/locales/en/clinical.json"), "utf8"),
    );

    expect(WORKFLOW_SIGNAL_SHAPES.map((shape) => shape.shape)).toEqual([
      "diamond",
      "token",
      "pill",
      "bed",
    ]);

    for (const shape of WORKFLOW_SIGNAL_SHAPES) {
      expect(getPathValue(locale, shape.labelKey)).toEqual(expect.any(String));
      expect(getPathValue(locale, shape.descriptionKey)).toEqual(expect.any(String));
    }
  });

  it("uses diamonds for stop-check risks across patient, prescription, bed, and handoff flows", () => {
    expect(semantic(patientContextSignal("drug_allergy").shape)).toBe("stop_or_safety_attention");
    expect(semantic(pharmacyRxStatusSignal("pending_review").shape)).toBe(
      "stop_or_safety_attention",
    );
    expect(semantic(bedBoardStatusSignal("vacant_dirty").shape)).toBe("stop_or_safety_attention");
    expect(
      semantic(clinicalJourneyActionSignal({ blockedReason: "permission", enabled: false }).shape),
    ).toBe("stop_or_safety_attention");
  });

  it("uses tokens for queued or in-progress module handoffs", () => {
    expect(semantic(pharmacyRxStatusSignal("dispensing").shape)).toBe("handoff_or_queue");
    expect(semantic(bedBoardStatusSignal("waiting").shape)).toBe("handoff_or_queue");
    expect(
      semantic(clinicalJourneyActionSignal({ blockedReason: "event", enabled: false }).shape),
    ).toBe("handoff_or_queue");
  });

  it("uses ready and bed shapes for completion and inpatient assignment state", () => {
    expect(semantic(patientContextSignal("no_known_allergies").shape)).toBe("ready_or_complete");
    expect(semantic(pharmacyRxStatusSignal("dispensed").shape)).toBe("ready_or_complete");
    expect(
      semantic(clinicalJourneyActionSignal({ blockedReason: null, enabled: true }).shape),
    ).toBe("ready_or_complete");
    expect(semantic(bedBoardStatusSignal("vacant_clean").shape)).toBe("bed_assignment");
    expect(semantic(bedBoardStatusSignal("occupied").shape)).toBe("bed_assignment");
  });
});

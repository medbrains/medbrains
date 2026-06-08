// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CLINICAL_EVENT_REQUIRED_PAYLOAD_KEYS,
  type ClinicalEventName,
  type ClinicalJourneyActionSignalPhase,
  clinicalJourneyActionSignalLabelKey,
} from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  CLINICAL_EVENT_I18N_KEYS,
  clinicalEventLabel,
  journeyActionSignalLabel,
  journeyMessage,
  type PatientJourneyTranslator,
} from "./patient-journey-i18n";

const dictionary: Record<string, string> = {
  "patientJourney.actionSignals.blockedByPermission": "Permission blocked",
  "patientJourney.blockers.availableAfterEvents": "Available after {{events}}",
  "patientJourney.events.order.created": "order created",
  "patientJourney.events.pharmacy.orderDispensed": "pharmacy order dispensed",
  "patientJourney.events.pharmacy.prescriptionReviewed": "pharmacy prescription reviewed",
  "patientJourney.lists.orJoin": "{{left}} or {{right}}",
};

const SIGNAL_PHASES: readonly ClinicalJourneyActionSignalPhase[] = [
  "blocked",
  "blocked_by_configuration",
  "blocked_by_context",
  "blocked_by_masking",
  "blocked_by_permission",
  "blocked_by_regulatory",
  "ready",
  "waiting_for_event",
];

const t: PatientJourneyTranslator = (key, values) => {
  const template = dictionary[key] ?? key;
  return Object.entries(values ?? {}).reduce(
    (text, [name, value]) => text.replace(`{{${name}}}`, String(value)),
    template,
  );
};

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

describe("patient journey i18n", () => {
  it("declares an i18n key for every registered clinical event", () => {
    expect(Object.keys(CLINICAL_EVENT_I18N_KEYS).sort()).toEqual(
      Object.keys(CLINICAL_EVENT_REQUIRED_PAYLOAD_KEYS).sort(),
    );
  });

  it("keeps patient journey keys present in the English clinical catalog", () => {
    const locale: unknown = JSON.parse(
      readFileSync(join(process.cwd(), "public/locales/en/clinical.json"), "utf8"),
    );
    const missingEventKeys = Object.values(CLINICAL_EVENT_I18N_KEYS).filter(
      (key) => typeof getPathValue(locale, key) !== "string",
    );
    const missingSignalKeys = SIGNAL_PHASES.map((phase) =>
      clinicalJourneyActionSignalLabelKey(phase),
    ).filter((key) => typeof getPathValue(locale, key) !== "string");

    expect(missingEventKeys).toEqual([]);
    expect(missingSignalKeys).toEqual([]);
    expect(getPathValue(locale, "patientJourney.actions.pharmacy.dispense_order.label")).toBe(
      "Dispense medicines",
    );
    expect(getPathValue(locale, "patientJourney.blockers.availableAfterEvents")).toBe(
      "Available after {{events}}",
    );
  });

  it("labels prescription review through the translation catalog", () => {
    expect(clinicalEventLabel(t, "pharmacy.prescription.reviewed")).toBe(
      "pharmacy prescription reviewed",
    );
  });

  it("labels action readiness signals through the translation catalog", () => {
    expect(journeyActionSignalLabel(t, "blocked_by_permission")).toBe("Permission blocked");
    expect(journeyActionSignalLabel(t, "blocked_by_regulatory")).toBe("Regulatory check needed");
  });

  it("formats activation blockers from event translation labels", () => {
    const activationEvents: readonly ClinicalEventName[] = [
      "order.created",
      "pharmacy.prescription.reviewed",
      "pharmacy.order.dispensed",
    ];

    expect(
      journeyMessage(
        t,
        "patientJourney.blockers.availableAfterEvents",
        null,
        activationEvents,
        null,
      ),
    ).toBe(
      "Available after order created or pharmacy prescription reviewed or pharmacy order dispensed",
    );
  });
});

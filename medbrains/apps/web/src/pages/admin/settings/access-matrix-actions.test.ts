// @vitest-environment node

import type {
  AccessMatrixSurface,
  ClinicalJourneyActionDefinition,
  ClinicalJourneyContext,
} from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  buildJourneyActionCoverage,
  summarizeJourneyActionCoverage,
} from "./access-matrix-actions";

function action(input: Partial<ClinicalJourneyActionDefinition>): ClinicalJourneyActionDefinition {
  return {
    activatesAfter: ["patient.created"],
    description: "Open linked workflow.",
    disabledReason: (_context: ClinicalJourneyContext) => null,
    id: "opd.open_visit",
    intent: "primary",
    label: "Open OPD",
    module: "opd",
    requiredPermissions: ["opd.visit.create"],
    shortLabel: "OPD",
    standardRefs: [],
    surfaces: ["web"],
    ...input,
  };
}

function surface(input: Partial<AccessMatrixSurface>): AccessMatrixSurface {
  return {
    activatesAfter: [],
    area: "Test",
    fieldAccessKeys: [],
    id: "opd.new_visit.screen",
    kind: "screen",
    label: "New OPD visit",
    masking: "clinical",
    module: "opd",
    platforms: ["web"],
    printArtifacts: [],
    printCopies: [],
    printerProfiles: [],
    requiredPermissions: [],
    requiresPrinter: false,
    standardRefs: [],
    ...input,
  };
}

describe("journey action access-matrix coverage", () => {
  it("marks actions covered when a target surface carries permission and activation metadata", () => {
    const [row] = buildJourneyActionCoverage(
      [action({ id: "opd.open_visit" })],
      [
        surface({
          requiredPermissions: ["opd.visit.create"],
          activatesAfter: ["patient.created"],
        }),
      ],
    );

    expect(row?.gaps).toEqual([]);
    expect(row?.matchedSurfaceIds).toEqual(["opd.new_visit.screen"]);
  });

  it("reports permission and activation gaps on loosely mapped surfaces", () => {
    const [permissionGap] = buildJourneyActionCoverage(
      [action({ id: "opd.open_visit" })],
      [surface({ activatesAfter: ["patient.created"] })],
    );
    const [activationGap] = buildJourneyActionCoverage(
      [action({ id: "opd.open_visit" })],
      [surface({ requiredPermissions: ["opd.visit.create"] })],
    );

    expect(permissionGap?.gaps).toEqual(["missing-permission"]);
    expect(permissionGap?.missingPermissions).toEqual(["opd.visit.create"]);
    expect(activationGap?.gaps).toEqual(["missing-activation"]);
    expect(activationGap?.missingActivationEvents).toEqual(["patient.created"]);
  });

  it("supports any-permission actions and summarizes gaps", () => {
    const rows = buildJourneyActionCoverage(
      [
        action({
          id: "camp.open_context",
          module: "camp",
          permissionMode: "any",
          requiredPermissions: ["camp.list", "camp.registrations.list"],
        }),
        action({ id: "patient.share", module: "patients", requiredPermissions: ["patients.view"] }),
      ],
      [
        surface({
          id: "camp.management.screen",
          module: "camp",
          requiredPermissions: ["camp.list"],
          activatesAfter: ["patient.created"],
        }),
      ],
    );

    expect(rows.find((row) => row.actionId === "camp.open_context")?.gaps).toEqual([]);
    expect(rows.find((row) => row.actionId === "patient.share")?.gaps).toEqual([
      "missing-surface",
      "missing-permission",
      "missing-activation",
    ]);
    expect(summarizeJourneyActionCoverage(rows)).toEqual({
      total: 2,
      covered: 1,
      gaps: 1,
      missingSurfaces: 1,
      permissionGaps: 1,
      activationGaps: 1,
    });
  });
});

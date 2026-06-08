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
    platformRoutes: {},
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
    expect(row?.routeTargets).toEqual(["/opd/new?patient_id=:patientId"]);
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
      guardedActions: 0,
      routeLinked: 1,
      configurationControls: 0,
      contextControls: 0,
      maskingControls: 0,
      regulatoryControls: 0,
    });
  });

  it("exposes blocker-control categories for settings governance", () => {
    const rows = buildJourneyActionCoverage(
      [
        action({
          id: "patient.share",
          module: "patients",
          blockingControls: ["regulatory"],
          requiredPermissions: ["patients.view"],
        }),
        action({
          id: "patient.print_card",
          module: "patients",
          blockingControls: ["masking"],
          requiredPermissions: ["patients.view"],
        }),
        action({
          id: "billing.collect_payment",
          module: "billing",
          blockingControls: ["configuration", "context"],
          requiredPermissions: ["billing.payments.create"],
        }),
        action({
          id: "billing.open_ledger",
          module: "billing",
          requiredPermissions: ["billing.invoices.list"],
          activatesAfter: ["billing.invoice.created"],
        }),
        action({
          id: "billing.prepare_discharge_bill",
          module: "billing",
          blockingControls: ["context"],
          requiredPermissions: ["billing.invoices.create"],
          activatesAfter: ["ipd.discharge.finalized"],
        }),
      ],
      [
        surface({
          id: "patients.context.actions",
          kind: "action",
          module: "patients",
          requiredPermissions: ["patients.view"],
          activatesAfter: ["patient.created"],
        }),
        surface({
          id: "billing.payment_inputs",
          kind: "input",
          module: "billing",
          requiredPermissions: ["billing.payments.create"],
          activatesAfter: ["patient.created"],
        }),
        surface({
          id: "billing.invoice_ledger",
          kind: "screen",
          module: "billing",
          requiredPermissions: ["billing.invoices.list"],
          activatesAfter: ["billing.invoice.created"],
        }),
        surface({
          id: "billing.discharge_invoice_actions",
          kind: "action",
          module: "billing",
          requiredPermissions: ["billing.invoices.create"],
          activatesAfter: ["ipd.discharge.finalized"],
        }),
      ],
    );

    expect(rows.find((row) => row.actionId === "patient.share")?.blockingControls).toEqual([
      "regulatory",
    ]);
    expect(rows.find((row) => row.actionId === "patient.print_card")?.blockingControls).toEqual([
      "masking",
    ]);
    expect(
      rows.find((row) => row.actionId === "billing.collect_payment")?.blockingControls,
    ).toEqual(["configuration", "context"]);
    expect(rows.find((row) => row.actionId === "billing.collect_payment")).toMatchObject({
      gaps: [],
      matchedSurfaceIds: ["billing.payment_inputs"],
      missingPermissions: [],
    });
    expect(rows.find((row) => row.actionId === "billing.open_ledger")?.routeTargets).toEqual([
      "/billing/invoices/:invoiceId",
      "/billing?tab=invoices&patient_id=:patientId&admission_id=:admissionId",
      "/billing?tab=invoices&patient_id=:patientId&encounter_id=:encounterId",
      "/billing?tab=invoices&patient_id=:patientId",
    ]);
    expect(rows.find((row) => row.actionId === "billing.collect_payment")?.routeTargets).toEqual([
      "/billing/invoices/:invoiceId?action=payment",
      "/billing?tab=invoices&patient_id=:patientId&admission_id=:admissionId&action=payment",
      "/billing?tab=invoices&patient_id=:patientId&encounter_id=:encounterId&action=payment",
      "/billing?tab=invoices&patient_id=:patientId&action=payment",
    ]);
    expect(
      rows.find((row) => row.actionId === "billing.prepare_discharge_bill")?.routeTargets,
    ).toEqual([
      "/billing?tab=invoices&patient_id=:patientId&admission_id=:admissionId&source=ipd_discharge",
      "/billing?tab=invoices&patient_id=:patientId&source=ipd_discharge",
    ]);
    expect(summarizeJourneyActionCoverage(rows)).toMatchObject({
      guardedActions: 4,
      routeLinked: 3,
      configurationControls: 1,
      contextControls: 2,
      maskingControls: 1,
      regulatoryControls: 1,
    });
  });

  it("includes surface-specific action permissions in coverage rows", () => {
    const [row] = buildJourneyActionCoverage(
      [
        action({
          id: "orders.lab",
          module: "orders",
          requiredPermissions: ["order_basket.sign"],
          surfacePermissions: {
            mobile: { requiredPermissions: ["lab.orders.create"] },
          },
          surfaces: ["web", "mobile"],
        }),
      ],
      [
        surface({
          id: "opd.order_basket.action",
          kind: "action",
          requiredPermissions: ["order_basket.sign"],
          activatesAfter: ["patient.created"],
        }),
        surface({
          id: "mobile.lab_order.action",
          kind: "action",
          module: "lab",
          platforms: ["mobile"],
          requiredPermissions: ["lab.orders.create"],
          activatesAfter: ["patient.created"],
        }),
      ],
    );

    expect(row?.gaps).toEqual([]);
    expect(row?.permissionCoverage).toEqual([
      {
        covered: true,
        missingPermissions: [],
        permissionMode: "all",
        requiredPermissions: ["order_basket.sign"],
        scope: "base",
      },
      {
        covered: true,
        missingPermissions: [],
        permissionMode: "all",
        requiredPermissions: ["lab.orders.create"],
        scope: "mobile",
      },
    ]);
    expect(row?.requiredPermissions).toEqual(["order_basket.sign", "lab.orders.create"]);
    expect(row?.matchedSurfaceIds).toEqual(["mobile.lab_order.action", "opd.order_basket.action"]);
    expect(row?.routeTargets).toEqual([
      "/opd/encounters/:encounterId?order=lab#investigations",
      "/ipd/admissions/:admissionId?order=lab#investigations",
    ]);
  });

  it("reports missing surface-specific permissions", () => {
    const [row] = buildJourneyActionCoverage(
      [
        action({
          id: "orders.radiology",
          module: "orders",
          requiredPermissions: ["order_basket.sign"],
          surfacePermissions: {
            mobile: { requiredPermissions: ["radiology.orders.create", "radiology.orders.list"] },
          },
          surfaces: ["web", "mobile"],
        }),
      ],
      [
        surface({
          id: "opd.order_basket.action",
          kind: "action",
          requiredPermissions: ["order_basket.sign"],
          activatesAfter: ["patient.created"],
        }),
      ],
    );

    expect(row?.gaps).toEqual(["missing-permission"]);
    expect(row?.permissionCoverage.find((coverage) => coverage.scope === "base")).toMatchObject({
      covered: true,
      missingPermissions: [],
    });
    expect(row?.permissionCoverage.find((coverage) => coverage.scope === "mobile")).toMatchObject({
      covered: false,
      missingPermissions: ["radiology.orders.create", "radiology.orders.list"],
    });
    expect(row?.missingPermissions).toEqual(["radiology.orders.create", "radiology.orders.list"]);
  });
});

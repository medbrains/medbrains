// @vitest-environment node

import type { AccessMatrixSurface } from "@medbrains/types";
import {
  ACCESS_MATRIX_SURFACES,
  ACCESS_MATRIX_WORKFLOW_EXPECTATIONS,
  CLINICAL_EVENT_REQUIRED_PAYLOAD_KEYS,
  FIELD_ACCESS_FIELDS,
  TOKEN_BOARD_SURFACE_LIST,
  TOKEN_BOARD_SURFACES,
} from "@medbrains/types";
import { describe, expect, it } from "vitest";
import type { NavGroupConfig } from "@/config/navigation";
import {
  buildAccessFieldCoverage,
  buildAccessPlatformCoverage,
  buildAccessSurfaceGovernanceCoverage,
  buildAccessSurfaceGovernanceGapRows,
  buildNavRouteCoverage,
  buildPatientFlowGovernanceCoverage,
  buildWorkflowKindCoverage,
  buildWorkflowShapeGovernanceCoverage,
  flattenNavRoutes,
  normalizeCoverageRoute,
  summarizeAccessFieldCoverage,
  summarizeAccessPlatformCoverage,
  summarizeAccessSurfaceGovernance,
  summarizeNavRouteCoverage,
  summarizePatientFlowGovernance,
  summarizeWorkflowKindCoverage,
  summarizeWorkflowShapeGovernance,
} from "./access-matrix-coverage";
import { REPORT_EVENT_SOURCE_DEFINITIONS } from "./report-event-coverage";

function testSurface(
  input: Pick<AccessMatrixSurface, "id" | "label" | "route" | "requiredPermissions"> &
    Partial<AccessMatrixSurface>,
): AccessMatrixSurface {
  return {
    activatesAfter: [],
    area: "Test",
    fieldAccessKeys: [],
    kind: "screen",
    masking: "none",
    module: "test",
    platformRoutes: {},
    platforms: ["web"],
    printArtifacts: [],
    printCopies: [],
    printerProfiles: [],
    requiresPrinter: false,
    standardRefs: [],
    ...input,
  };
}

const groups: NavGroupConfig[] = [
  {
    key: "core",
    items: [
      {
        i18nKey: "patients",
        icon: "IconUsers",
        path: "/patients",
        requiredPermission: "patients.list",
      },
      {
        i18nKey: "billing",
        icon: "IconReceipt",
        path: "/billing",
        requiredPermission: "billing.invoices.list",
      },
      {
        i18nKey: "admin",
        icon: "IconSettings",
        path: "/admin/users",
        requiredPermissions: ["admin.users.list", "admin.roles.list"],
      },
    ],
  },
];

function fieldKey(field: (typeof FIELD_ACCESS_FIELDS)[number]) {
  return `${field.db_table ?? "general"}.${field.code}`;
}

describe("access matrix route coverage", () => {
  it("normalizes hash, query, and trailing slash route variants", () => {
    expect(normalizeCoverageRoute("billing?tab=invoices#ledger/")).toBe("/billing");
    expect(normalizeCoverageRoute("/mrd#case-sheets")).toBe("/mrd");
    expect(normalizeCoverageRoute("/patients/")).toBe("/patients");
  });

  it("deduplicates navigation routes and permissions", () => {
    const duplicated: NavGroupConfig[] = [
      ...groups,
      {
        key: "duplicate",
        items: [
          {
            i18nKey: "patientsDuplicate",
            icon: "IconUsers",
            path: "/patients",
            requiredPermission: "patients.view",
          },
        ],
      },
    ];

    const patients = flattenNavRoutes(duplicated).find((route) => route.path === "/patients");

    expect(patients?.requiredPermissions).toEqual(["patients.list", "patients.view"]);
  });

  it("reports covered, permission-gap, and unmapped routes", () => {
    const rows = buildNavRouteCoverage(groups, [
      testSurface({
        id: "patients.directory.screen",
        label: "Patients",
        route: "/patients",
        requiredPermissions: ["patients.list"],
      }),
      testSurface({
        id: "billing.screen",
        label: "Billing",
        route: "/billing?tab=invoices",
        requiredPermissions: ["billing.invoices.view"],
      }),
    ]);

    expect(rows.find((row) => row.path === "/patients")?.status).toBe("covered");
    expect(rows.find((row) => row.path === "/billing")?.status).toBe("permission-gap");
    expect(rows.find((row) => row.path === "/admin/users")?.status).toBe("unmapped");
    expect(summarizeNavRouteCoverage(rows)).toEqual({
      total: 3,
      covered: 1,
      permissionGaps: 1,
      unmapped: 1,
      blocked: 2,
    });
  });

  it("maps every critical patient workflow to required surface types", () => {
    const rows = buildWorkflowKindCoverage(
      ACCESS_MATRIX_WORKFLOW_EXPECTATIONS,
      ACCESS_MATRIX_SURFACES,
    );
    const gaps = rows.flatMap((row) => row.missingKinds.map((kind) => `${row.key}:${kind}`));
    const indentInventory = rows.find((row) => row.key === "indent_inventory");
    const printableWorkflows = rows.filter((row) => row.printSurfaces > 0).length;

    expect(gaps).toEqual([]);
    expect(indentInventory?.presentKinds).toEqual(
      expect.arrayContaining(["action", "input", "screen", "tab", "table", "widget"]),
    );
    expect(summarizeWorkflowKindCoverage(rows)).toEqual({
      total: ACCESS_MATRIX_WORKFLOW_EXPECTATIONS.length,
      complete: ACCESS_MATRIX_WORKFLOW_EXPECTATIONS.length,
      gaps: 0,
      eventDriven: ACCESS_MATRIX_WORKFLOW_EXPECTATIONS.length,
      printMapped: printableWorkflows,
      permissionMapped: ACCESS_MATRIX_WORKFLOW_EXPECTATIONS.length,
    });
  });

  it("reports workflow surface type and activation gaps", () => {
    const rows = buildWorkflowKindCoverage(
      [
        {
          key: "demo",
          label: "Demo workflow",
          modules: ["demo"],
          requiredKinds: ["screen", "input", "action", "print"],
        },
      ],
      [
        testSurface({
          id: "demo.screen",
          label: "Demo screen",
          module: "demo",
          kind: "screen",
          route: "/demo",
          requiredPermissions: ["demo.list"],
        }),
        testSurface({
          id: "demo.action",
          label: "Demo action",
          module: "demo",
          kind: "action",
          route: "/demo",
          requiredPermissions: ["demo.update"],
          activatesAfter: ["patient.created"],
        }),
      ],
    );

    expect(rows[0]?.presentKinds).toEqual(["action", "screen"]);
    expect(rows[0]?.missingKinds).toEqual(["input", "print"]);
    expect(rows[0]?.activatedSurfaces).toBe(1);
    expect(rows[0]?.permissions.size).toBe(2);
    expect(summarizeWorkflowKindCoverage(rows)).toEqual({
      total: 1,
      complete: 0,
      gaps: 1,
      eventDriven: 1,
      printMapped: 0,
      permissionMapped: 1,
    });
  });

  it("keeps access-surface field keys aligned with the field masking registry", () => {
    const registeredFieldKeys = new Set(FIELD_ACCESS_FIELDS.map(fieldKey));
    const mappedFieldKeys = new Set(
      ACCESS_MATRIX_SURFACES.flatMap((surface) => [...surface.fieldAccessKeys]),
    );

    const surfaceKeysMissingFromRegistry = [...mappedFieldKeys]
      .filter((key) => !registeredFieldKeys.has(key))
      .sort();
    const registeredKeysNotMapped = FIELD_ACCESS_FIELDS.map(fieldKey)
      .filter((key) => !mappedFieldKeys.has(key))
      .sort();

    expect(surfaceKeysMissingFromRegistry).toEqual([]);
    expect(registeredKeysNotMapped).toEqual([]);
  });

  it("summarizes registered fields by governed surfaces, masking, platforms and print coverage", () => {
    const rows = buildAccessFieldCoverage(FIELD_ACCESS_FIELDS, ACCESS_MATRIX_SURFACES);
    const summary = summarizeAccessFieldCoverage(rows);
    const patientUhid = rows.find((row) => row.key === "patients.uhid");
    const billingAmount = rows.find((row) => row.key === "billing.amount");
    const mlcFIR = rows.find((row) => row.key === "emergency.mlc.fir_number");

    expect(summary).toMatchObject({
      total: FIELD_ACCESS_FIELDS.length,
      complete: FIELD_ACCESS_FIELDS.length,
      gaps: 0,
    });
    expect(summary.edgeMapped).toBeGreaterThan(0);
    expect(summary.printMapped).toBeGreaterThan(0);
    expect(patientUhid?.kindCounts.screen).toBeGreaterThan(0);
    expect(patientUhid?.kindCounts.input).toBeGreaterThan(0);
    expect(patientUhid?.kindCounts.column).toBeGreaterThan(0);
    expect(patientUhid?.platforms).toEqual(expect.arrayContaining(["web", "mobile", "kiosk"]));
    expect(billingAmount?.maskingBehaviors).toEqual(expect.arrayContaining(["financial"]));
    expect(billingAmount?.printMapped).toBeGreaterThan(0);
    expect(mlcFIR?.maskingBehaviors).toEqual(expect.arrayContaining(["regulatory"]));
  });

  it("reports field governance gaps when a registered field is not mapped to a governed surface", () => {
    const [patientUhid] = FIELD_ACCESS_FIELDS;
    if (!patientUhid) {
      throw new Error("FIELD_ACCESS_FIELDS must include at least one field");
    }
    const rows = buildAccessFieldCoverage(
      [patientUhid],
      [
        testSurface({
          id: "patient.unlinked",
          label: "Patient unlinked",
          route: "/patients",
          requiredPermissions: [],
          fieldAccessKeys: [],
        }),
      ],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.key).toBe(fieldKey(patientUhid));
    expect(rows[0]?.gaps).toEqual(["missing-surface"]);
    expect(summarizeAccessFieldCoverage(rows)).toEqual({
      total: 1,
      complete: 0,
      gaps: 1,
      edgeMapped: 0,
      printMapped: 0,
    });
  });

  it("keeps access-surface activation events aligned with the clinical event registry", () => {
    const registeredEvents = new Set(Object.keys(CLINICAL_EVENT_REQUIRED_PAYLOAD_KEYS));
    const mappedEvents = new Set(
      ACCESS_MATRIX_SURFACES.flatMap((surface) => [...surface.activatesAfter]),
    );

    const missingEvents = [...mappedEvents].filter((event) => !registeredEvents.has(event)).sort();

    expect(missingEvents).toEqual([]);
  });

  it("keeps report-backed events represented in access-surface activation metadata", () => {
    const reportEvents = new Set(
      REPORT_EVENT_SOURCE_DEFINITIONS.flatMap((definition) => [...definition.sourceEvents]),
    );
    const accessEvents = new Set(
      ACCESS_MATRIX_SURFACES.flatMap((surface) => [...surface.activatesAfter]),
    );

    const missingActivationEvents = [...reportEvents]
      .filter((eventName) => !accessEvents.has(eventName))
      .sort();

    expect(missingActivationEvents).toEqual([]);
  });

  it("maps OPD stage events to stage-specific access surfaces", () => {
    const tokenPrint = ACCESS_MATRIX_SURFACES.find(
      (surface) => surface.id === "opd.queue.token_printables",
    );
    const vitalsRoute = ACCESS_MATRIX_SURFACES.find((surface) => surface.id === "opd.vitals.route");
    const clinicalInputs = ACCESS_MATRIX_SURFACES.find(
      (surface) => surface.id === "opd.encounter.clinical_inputs",
    );
    const orderActions = ACCESS_MATRIX_SURFACES.find(
      (surface) => surface.id === "opd.encounter.order_actions",
    );
    const mrdAction = ACCESS_MATRIX_SURFACES.find(
      (surface) => surface.id === "opd.encounter.mrd_case_sheet_action",
    );
    const summaryPrint = ACCESS_MATRIX_SURFACES.find(
      (surface) => surface.id === "opd.encounter.visit_summary_print",
    );

    expect(tokenPrint?.activatesAfter).toEqual(
      expect.arrayContaining(["opd.encounter.created", "opd.queue.called"]),
    );
    expect(vitalsRoute?.activatesAfter).toEqual(
      expect.arrayContaining(["opd.encounter.created", "opd.queue.called"]),
    );
    expect(clinicalInputs?.activatesAfter).toEqual(
      expect.arrayContaining([
        "opd.encounter.created",
        "opd.consultation.started",
        "opd.vitals.recorded",
      ]),
    );
    expect(orderActions?.activatesAfter).toEqual(
      expect.arrayContaining([
        "opd.encounter.created",
        "opd.vitals.recorded",
        "opd.consultation.saved",
      ]),
    );
    expect(mrdAction?.activatesAfter).toEqual(
      expect.arrayContaining([
        "opd.consultation.saved",
        "opd.prescription.updated",
        "opd.encounter.completed",
      ]),
    );
    expect(summaryPrint?.activatesAfter).toEqual(
      expect.arrayContaining([
        "opd.consultation.saved",
        "opd.prescription.updated",
        "opd.followup.scheduled",
        "opd.encounter.completed",
      ]),
    );
  });

  it("maps reviewed and cancelled orders to pharmacy queue and order-detail surfaces", () => {
    const surfaceIds = [
      "pharmacy.rx_queue.screen",
      "pharmacy.orders.screen",
      "pharmacy.order_detail.actions",
    ];
    const surfaces = ACCESS_MATRIX_SURFACES.filter((surface) => surfaceIds.includes(surface.id));

    expect(surfaces).toHaveLength(surfaceIds.length);
    expect(surfaces.map((surface) => surface.activatesAfter)).toEqual(
      surfaceIds.map(() => ["order.created", "pharmacy.prescription.reviewed", "order.cancelled"]),
    );
  });

  it("maps IPD bed movement and discharge completion to stage-specific surfaces", () => {
    const admissionSurfaceIds = [
      "ipd.admissions.screen",
      "ipd.detail.screen",
      "ipd.detail.command_tabs",
      "ipd.detail.attender_inputs",
      "ipd.detail.action_bar",
      "ipd.detail.admission_printables",
      "ipd.detail.mrd_case_sheet_action",
    ];
    const surfaces = ACCESS_MATRIX_SURFACES.filter((surface) =>
      admissionSurfaceIds.includes(surface.id),
    );

    expect(surfaces).toHaveLength(admissionSurfaceIds.length);
    expect(
      surfaces.find((surface) => surface.id === "ipd.admissions.screen")?.activatesAfter,
    ).toEqual(["ipd.admission.created"]);
    expect(surfaces.find((surface) => surface.id === "ipd.detail.screen")?.activatesAfter).toEqual(
      expect.arrayContaining(["ipd.admission.created", "bed.assigned", "bed.transferred"]),
    );
    expect(
      surfaces.find((surface) => surface.id === "ipd.detail.command_tabs")?.activatesAfter,
    ).toEqual(expect.arrayContaining(["ipd.admission.created", "bed.assigned", "bed.transferred"]));
    expect(
      surfaces.find((surface) => surface.id === "ipd.detail.attender_inputs")?.activatesAfter,
    ).toEqual(["ipd.admission.created"]);
    expect(
      surfaces.find((surface) => surface.id === "ipd.detail.action_bar")?.activatesAfter,
    ).toEqual(
      expect.arrayContaining([
        "ipd.admission.created",
        "bed.transferred",
        "ipd.discharge.completed",
      ]),
    );
    expect(
      surfaces.find((surface) => surface.id === "ipd.detail.admission_printables")?.activatesAfter,
    ).toEqual(["ipd.admission.created"]);
    expect(
      surfaces.find((surface) => surface.id === "ipd.detail.mrd_case_sheet_action")?.activatesAfter,
    ).toEqual(["ipd.admission.created", "mrd.case_sheet.generated"]);
  });

  it("governs the shared patient-flow handoff rail across web and mobile", () => {
    const surface = ACCESS_MATRIX_SURFACES.find(
      (entry) => entry.id === "patients.patient_flow.handoff_rail",
    );

    expect(surface).toBeDefined();
    expect(surface?.kind).toBe("widget");
    expect(surface?.platforms).toEqual(["web", "mobile"]);
    expect(surface?.platformRoutes).toEqual({
      mobile: "PatientDetail",
      web: "/patients/:id#overview",
    });
    expect(surface?.fieldAccessKeys).toEqual(
      expect.arrayContaining([
        "patients.uhid",
        "patients.first_name",
        "patients.middle_name",
        "patients.last_name",
      ]),
    );
    expect(surface?.requiredPermissions).toEqual(
      expect.arrayContaining([
        "patients.view",
        "opd.visit.create",
        "ipd.admissions.create",
        "ipd.admissions.view",
        "emergency.visits.create",
        "camp.list",
        "camp.registrations.list",
        "camp.registrations.create",
        "pharmacy.prescriptions.list",
        "billing.invoices.list",
      ]),
    );
    expect(surface?.activatesAfter).toEqual(
      expect.arrayContaining([
        "patient.created",
        "opd.encounter.created",
        "ipd.admission.created",
        "bed.assigned",
        "emergency.visit.created",
        "camp.registration.created",
        "camp.screening.completed",
        "order.created",
        "pharmacy.prescription.reviewed",
        "pharmacy.order.dispensed",
        "billing.invoice.created",
        "billing.payment.received",
      ]),
    );
    expect(surface?.masking).toBe("identity");
  });

  it("summarizes registration-to-billing patient-flow governance without edge gaps", () => {
    const rows = buildPatientFlowGovernanceCoverage(ACCESS_MATRIX_SURFACES);
    const summary = summarizePatientFlowGovernance(rows);
    const opd = rows.find((row) => row.key === "opd");
    const pharmacy = rows.find((row) => row.key === "pharmacy");
    const billing = rows.find((row) => row.key === "billing");

    expect(summary).toEqual({
      total: rows.length,
      complete: rows.length,
      gaps: 0,
      publicDisplayMapped: rows.length,
      printMapped: rows.length,
      edgeReady: rows.length,
    });
    expect(opd?.missingLaunchTargetPlatforms).toEqual([]);
    expect(opd?.publicDisclosureMapped).toBeGreaterThan(0);
    expect(pharmacy?.presentPlatforms).toEqual(
      expect.arrayContaining(["web", "mobile", "tv", "kiosk"]),
    );
    expect(billing?.publicDisclosureMapped).toBeGreaterThan(0);
  });

  it("governs shape semantics for patient, prescription, bed, billing and handoff workflows", () => {
    const rows = buildWorkflowShapeGovernanceCoverage(ACCESS_MATRIX_SURFACES);
    const summary = summarizeWorkflowShapeGovernance(rows);
    const prescription = rows.find((row) => row.key === "prescription");
    const bedManagement = rows.find((row) => row.key === "bed_management");
    const billing = rows.find((row) => row.key === "billing");

    expect(summary).toEqual({
      total: 5,
      complete: 5,
      gaps: 0,
      stopCheckMapped: 5,
      handoffMapped: 5,
      readyMapped: 4,
      bedAssignmentMapped: 1,
    });
    expect(prescription?.presentSemantics).toEqual(
      expect.arrayContaining(["handoff_or_queue", "ready_or_complete", "stop_or_safety_attention"]),
    );
    expect(bedManagement?.presentSemantics).toEqual(
      expect.arrayContaining(["bed_assignment", "handoff_or_queue", "stop_or_safety_attention"]),
    );
    expect(bedManagement?.platforms).toEqual(
      expect.arrayContaining(["web", "mobile", "tv", "kiosk"]),
    );
    expect(billing?.maskingMapped).toBeGreaterThan(0);
  });

  it("reports shape governance gaps when semantics are missing or not platform linked", () => {
    const rows = buildWorkflowShapeGovernanceCoverage(
      [
        testSurface({
          id: "ipd.demo.screen",
          label: "IPD demo",
          module: "ipd",
          route: "/ipd",
          requiredPermissions: ["ipd.admissions.view"],
          fieldAccessKeys: ["patients.uhid"],
          masking: "identity",
          platforms: ["web"],
        }),
      ],
      [
        {
          key: "demo_bed_management",
          labelKey: "demo.label",
          descriptionKey: "demo.description",
          modules: ["ipd"],
          requiredSemantics: ["bed_assignment", "stop_or_safety_attention"],
          requiredPlatforms: ["web", "tv"],
          requiresEventActivation: true,
          requiresMasking: true,
          scenarios: [
            {
              key: "demo.ready",
              labelKey: "demo.ready",
              shape: "pill",
              tone: "ready",
              semantic: "ready_or_complete",
              expectedSemantic: "bed_assignment",
              covered: false,
            },
          ],
        },
      ],
    );

    expect(rows[0]?.gaps).toEqual(
      expect.arrayContaining(["missing-event", "missing-platform", "missing-semantic"]),
    );
    expect(rows[0]?.missingSemantics).toEqual(["bed_assignment", "stop_or_safety_attention"]);
  });

  it("maps indent lifecycle and stock movement events to governed store surfaces", () => {
    const surfaces = ACCESS_MATRIX_SURFACES.filter((surface) => surface.module === "indent");
    const screen = surfaces.find((surface) => surface.id === "indent.requisitions.screen");
    const action = surfaces.find((surface) => surface.id === "indent.approval_issue.actions");
    const analytics = surfaces.find((surface) => surface.id === "indent.analytics.widgets");

    expect(surfaces.map((surface) => surface.kind).sort()).toEqual([
      "action",
      "input",
      "screen",
      "tab",
      "table",
      "widget",
    ]);
    expect(screen?.activatesAfter).toEqual(
      expect.arrayContaining([
        "indent.requisition.submitted",
        "indent.requisition.approved",
        "indent.requisition.issued",
      ]),
    );
    expect(action?.activatesAfter).toEqual(
      expect.arrayContaining([
        "indent.requisition.submitted",
        "indent.requisition.approved",
        "indent.requisition.issued",
        "pharmacy.stock.movement.created",
      ]),
    );
    expect(analytics?.platforms).toEqual(["web", "tv"]);
  });

  it("maps safety evidence events to emergency and enterprise indicator surfaces", () => {
    const emergencyActions = ACCESS_MATRIX_SURFACES.find(
      (surface) => surface.id === "emergency.triage.actions",
    );
    const reportScreen = ACCESS_MATRIX_SURFACES.find(
      (surface) => surface.id === "reports.enterprise.screen",
    );
    const dashboardWidgets = ACCESS_MATRIX_SURFACES.find(
      (surface) => surface.id === "reports.dashboard.widgets",
    );

    expect(emergencyActions?.activatesAfter).toEqual(
      expect.arrayContaining(["emergency.code_blue.activated", "emergency.code_blue.completed"]),
    );
    expect(reportScreen?.activatesAfter).toEqual(
      expect.arrayContaining([
        "quality.incident.reported",
        "blood.transfusion_reaction.reported",
        "bme.equipment_downtime.recorded",
        "housekeeping.bmw_disposal.recorded",
      ]),
    );
    expect(dashboardWidgets?.activatesAfter).toEqual(
      expect.arrayContaining([
        "quality.incident.reported",
        "emergency.code_blue.activated",
        "emergency.code_blue.completed",
      ]),
    );
  });

  it("maps public token-board access surfaces to focused web workspaces", () => {
    for (const board of TOKEN_BOARD_SURFACE_LIST) {
      const surface = ACCESS_MATRIX_SURFACES.find(
        (entry) => entry.id === `token_boards.${board.id}.public_display`,
      );

      expect(surface?.route).toBe(board.targets.webPath);
      expect(surface?.platformRoutes).toEqual({
        kiosk: board.targets.kioskPath,
        mobile: `${board.targets.mobileRoute}?surface=${board.id}`,
        tv: board.targets.tvDeepLink,
        web: board.targets.webPath,
      });
      expect(surface?.platforms).toEqual(["web", "mobile", "tv", "kiosk"]);
      expect(surface?.fieldAccessKeys.length).toBeGreaterThan(0);
      expect(surface?.masking).not.toBe("none");
    }
  });

  it("summarizes screen, tab, table, column, input and action governance by surface type", () => {
    const rows = buildAccessSurfaceGovernanceCoverage(ACCESS_MATRIX_SURFACES);
    const summary = summarizeAccessSurfaceGovernance(rows);
    const kinds = new Set(rows.map((row) => row.kind));

    expect(summary.total).toBe(ACCESS_MATRIX_SURFACES.length);
    expect(summary.gaps).toBe(0);
    expect(kinds).toEqual(
      new Set(["action", "column", "input", "print", "screen", "tab", "table", "widget"]),
    );
    expect(rows.find((row) => row.kind === "input")?.permissionMapped).toBeGreaterThan(0);
    expect(rows.find((row) => row.kind === "column")?.fieldMapped).toBeGreaterThan(0);
    expect(rows.find((row) => row.kind === "table")?.routeMapped).toBeGreaterThan(0);
  });

  it("summarizes platform coverage for web, mobile, TV and kiosk surfaces", () => {
    const rows = buildAccessPlatformCoverage(ACCESS_MATRIX_SURFACES);
    const summary = summarizeAccessPlatformCoverage(rows);
    const tvRow = rows.find((row) => row.platform === "tv");
    const kioskRow = rows.find((row) => row.platform === "kiosk");

    expect(summary).toMatchObject({
      total: 4,
      covered: 4,
      gaps: 0,
    });
    expect(summary.tvSurfaces).toBeGreaterThanOrEqual(TOKEN_BOARD_SURFACE_LIST.length);
    expect(summary.kioskSurfaces).toBeGreaterThanOrEqual(TOKEN_BOARD_SURFACE_LIST.length);
    expect(tvRow?.kindCounts.screen).toBeGreaterThanOrEqual(TOKEN_BOARD_SURFACE_LIST.length);
    expect(tvRow?.platformRouteMapped).toBeGreaterThanOrEqual(TOKEN_BOARD_SURFACE_LIST.length);
    expect(kioskRow?.platformRouteMapped).toBeGreaterThanOrEqual(TOKEN_BOARD_SURFACE_LIST.length);
    expect(kioskRow?.modules).toEqual(
      expect.arrayContaining(["billing", "emergency", "opd", "pharmacy"]),
    );
  });

  it("summarizes real patient-flow governance across web, mobile, TV, kiosk and print", () => {
    const rows = buildPatientFlowGovernanceCoverage(ACCESS_MATRIX_SURFACES);
    const summary = summarizePatientFlowGovernance(rows);
    const registration = rows.find((row) => row.key === "registration");
    const opd = rows.find((row) => row.key === "opd");
    const ipd = rows.find((row) => row.key === "ipd");
    const billing = rows.find((row) => row.key === "billing");

    expect(summary).toEqual({
      total: 7,
      complete: 7,
      gaps: 0,
      publicDisplayMapped: 7,
      printMapped: 7,
      edgeReady: 7,
    });
    expect(registration?.launchTargetPlatforms).toEqual(
      expect.arrayContaining(["web", "mobile", "kiosk"]),
    );
    expect(opd?.publicDisclosureMapped).toBeGreaterThan(0);
    expect(ipd?.launchTargetPlatforms).toEqual(
      expect.arrayContaining(["web", "mobile", "tv", "kiosk"]),
    );
    expect(billing?.launchTargetPlatforms).toEqual(
      expect.arrayContaining(["web", "mobile", "tv", "kiosk"]),
    );
  });

  it("reports patient-flow governance gaps for missing launch and public display policy", () => {
    const rows = buildPatientFlowGovernanceCoverage([
      testSurface({
        id: "billing.invoices.screen",
        label: "Billing invoices",
        module: "billing",
        kind: "screen",
        route: "/billing",
        platforms: ["web", "mobile"],
        requiredPermissions: ["billing.invoices.list"],
        fieldAccessKeys: ["billing.amount"],
        masking: "financial",
        activatesAfter: ["billing.invoice.created"],
      }),
      testSurface({
        id: "billing.receipt.print",
        label: "Billing receipt",
        module: "billing",
        kind: "print",
        route: "/billing",
        platforms: ["web"],
        requiredPermissions: ["billing.receipts.print"],
        fieldAccessKeys: ["billing.amount"],
        masking: "financial",
        activatesAfter: ["billing.payment.received"],
        printArtifacts: ["Receipt"],
        printCopies: ["customer", "office"],
      }),
    ]);
    const billing = rows.find((row) => row.key === "billing");

    expect(billing?.gaps).toEqual(
      expect.arrayContaining([
        "missing-platform",
        "missing-launch-target",
        "missing-surface-kind",
        "missing-public-display-policy",
      ]),
    );
  });

  it("reports per-platform governance gaps when an edge surface is not fully mapped", () => {
    const rows = buildAccessPlatformCoverage([
      testSurface({
        id: "kiosk.registration",
        label: "Kiosk registration",
        kind: "input",
        route: "/kiosk/register",
        platforms: ["kiosk"],
        requiredPermissions: [],
        fieldAccessKeys: [],
        masking: "identity",
      }),
      testSurface({
        id: "tv.queue",
        label: "TV queue",
        kind: "screen",
        route: TOKEN_BOARD_SURFACES.opd.targets.webPath,
        platformRoutes: { tv: TOKEN_BOARD_SURFACES.opd.targets.tvDeepLink },
        platforms: ["tv"],
        requiredPermissions: [...TOKEN_BOARD_SURFACES.opd.requiredAnyPermissions],
        fieldAccessKeys: ["patients.uhid"],
        masking: "identity",
      }),
    ]);
    const summary = summarizeAccessPlatformCoverage(rows);

    expect(rows.find((row) => row.platform === "kiosk")?.governanceGapSurfaces).toBe(1);
    expect(rows.find((row) => row.platform === "tv")?.governanceGapSurfaces).toBe(0);
    expect(summary.gaps).toBe(1);
  });

  it("reports governance gaps for unlinked fields, routes, permissions and activation", () => {
    const gapRows = buildAccessSurfaceGovernanceGapRows([
      testSurface({
        id: "patient.input",
        label: "Patient input",
        kind: "input",
        route: "/patients/register",
        requiredPermissions: [],
        fieldAccessKeys: [],
        masking: "identity",
      }),
      testSurface({
        id: "patient.action",
        label: "Patient action",
        kind: "action",
        route: "/patients/:id",
        requiredPermissions: ["patients.update"],
        fieldAccessKeys: ["patients.uhid"],
        masking: "identity",
      }),
      testSurface({
        id: "patient.tab",
        label: "Patient tab",
        kind: "tab",
        route: "/patients/:id",
        requiredPermissions: ["patients.view"],
        fieldAccessKeys: ["patients.uhid"],
        masking: "identity",
      }),
    ]);

    expect(gapRows.find((row) => row.surfaceId === "patient.input")?.gaps).toEqual([
      "missing-permission",
      "missing-field-keys",
    ]);
    expect(gapRows.find((row) => row.surfaceId === "patient.action")?.gaps).toEqual([
      "missing-activation",
    ]);
    expect(gapRows.find((row) => row.surfaceId === "patient.tab")?.gaps).toEqual([
      "missing-tab-anchor",
    ]);
  });
});

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
  buildWorkflowKindCoverage,
  flattenNavRoutes,
  normalizeCoverageRoute,
  summarizeAccessFieldCoverage,
  summarizeAccessPlatformCoverage,
  summarizeAccessSurfaceGovernance,
  summarizeNavRouteCoverage,
  summarizeWorkflowKindCoverage,
} from "./access-matrix-coverage";

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
    const expectedPrintableWorkflows = ACCESS_MATRIX_WORKFLOW_EXPECTATIONS.filter((workflow) =>
      workflow.requiredKinds.includes("print"),
    ).length;

    expect(gaps).toEqual([]);
    expect(summarizeWorkflowKindCoverage(rows)).toEqual({
      total: ACCESS_MATRIX_WORKFLOW_EXPECTATIONS.length,
      complete: ACCESS_MATRIX_WORKFLOW_EXPECTATIONS.length,
      gaps: 0,
      eventDriven: ACCESS_MATRIX_WORKFLOW_EXPECTATIONS.length,
      printMapped: expectedPrintableWorkflows,
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

  it("separates IPD admission workspace activation from bed assignment activation", () => {
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
    expect(surfaces.map((surface) => surface.activatesAfter)).toEqual(
      admissionSurfaceIds.map((id) =>
        id === "ipd.detail.mrd_case_sheet_action"
          ? ["ipd.admission.created", "mrd.case_sheet.generated"]
          : ["ipd.admission.created"],
      ),
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

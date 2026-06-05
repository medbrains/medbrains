// @vitest-environment node

import type { AccessMatrixSurface, AccessMatrixSurfaceKind } from "@medbrains/types";
import { ACCESS_MATRIX_SURFACES, FIELD_ACCESS_FIELDS } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import type { NavGroupConfig } from "@/config/navigation";
import {
  buildAccessSurfaceGovernanceCoverage,
  buildAccessSurfaceGovernanceGapRows,
  buildNavRouteCoverage,
  flattenNavRoutes,
  normalizeCoverageRoute,
  summarizeAccessSurfaceGovernance,
  summarizeNavRouteCoverage,
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

const criticalWorkflowExpectations: {
  key: string;
  modules: readonly string[];
  requiredKinds: readonly AccessMatrixSurfaceKind[];
}[] = [
  {
    key: "registration",
    modules: ["patients"],
    requiredKinds: ["screen", "tab", "column", "input", "action", "print"],
  },
  {
    key: "opd",
    modules: ["opd"],
    requiredKinds: ["screen", "tab", "column", "input", "action", "print"],
  },
  {
    key: "ipd",
    modules: ["ipd"],
    requiredKinds: ["screen", "tab", "input", "action", "print"],
  },
  {
    key: "emergency",
    modules: ["emergency"],
    requiredKinds: ["screen", "table", "input", "action", "print"],
  },
  {
    key: "camp",
    modules: ["camp"],
    requiredKinds: ["screen", "tab", "input", "action", "print"],
  },
  {
    key: "pharmacy",
    modules: ["pharmacy"],
    requiredKinds: ["screen", "table", "column", "input", "action", "print"],
  },
  {
    key: "billing",
    modules: ["billing"],
    requiredKinds: ["screen", "tab", "column", "input", "action", "print"],
  },
  {
    key: "mrd",
    modules: ["mrd"],
    requiredKinds: ["screen", "table", "column", "input", "action", "print"],
  },
  {
    key: "settings_reports",
    modules: ["admin", "analytics"],
    requiredKinds: ["screen", "tab", "widget"],
  },
];

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
    const gaps = criticalWorkflowExpectations.flatMap((workflow) => {
      const workflowSurfaces = ACCESS_MATRIX_SURFACES.filter((surface) =>
        workflow.modules.includes(surface.module),
      );
      const mappedKinds = new Set(workflowSurfaces.map((surface) => surface.kind));
      return workflow.requiredKinds
        .filter((kind) => !mappedKinds.has(kind))
        .map((kind) => `${workflow.key}:${kind}`);
    });

    expect(gaps).toEqual([]);
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

  it("summarizes screen, tab, table, column, input and action governance by surface type", () => {
    const rows = buildAccessSurfaceGovernanceCoverage(ACCESS_MATRIX_SURFACES);
    const summary = summarizeAccessSurfaceGovernance(rows);
    const kinds = new Set(rows.map((row) => row.kind));

    expect(summary.total).toBe(ACCESS_MATRIX_SURFACES.length);
    expect(kinds).toEqual(
      new Set(["action", "column", "input", "print", "screen", "tab", "table", "widget"]),
    );
    expect(rows.find((row) => row.kind === "input")?.permissionMapped).toBeGreaterThan(0);
    expect(rows.find((row) => row.kind === "column")?.fieldMapped).toBeGreaterThan(0);
    expect(rows.find((row) => row.kind === "table")?.routeMapped).toBeGreaterThan(0);
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

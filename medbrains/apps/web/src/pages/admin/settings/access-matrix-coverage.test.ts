// @vitest-environment node

import type { AccessMatrixSurface } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import type { NavGroupConfig } from "@/config/navigation";
import {
  buildNavRouteCoverage,
  flattenNavRoutes,
  normalizeCoverageRoute,
  summarizeNavRouteCoverage,
} from "./access-matrix-coverage";

function testSurface(
  input: Pick<AccessMatrixSurface, "id" | "label" | "route" | "requiredPermissions">,
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
});

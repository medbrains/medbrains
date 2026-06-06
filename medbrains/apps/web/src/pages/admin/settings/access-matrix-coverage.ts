import type {
  AccessMatrixMaskingBehavior,
  AccessMatrixPlatform,
  AccessMatrixSurface,
  AccessMatrixSurfaceKind,
  AccessMatrixWorkflowExpectation,
  FieldMasterFull,
} from "@medbrains/types";
import type { NavGroupConfig, NavItemConfig } from "@/config/navigation";

export const ACCESS_MATRIX_PLATFORMS: readonly AccessMatrixPlatform[] = [
  "web",
  "mobile",
  "tv",
  "kiosk",
];

export type NavRouteCoverageStatus = "covered" | "permission-gap" | "unmapped";

export interface NavRouteCoverageRow {
  path: string;
  labelKey: string;
  requiredPermissions: readonly string[];
  mappedPermissions: readonly string[];
  surfaceIds: readonly string[];
  missingPermissions: readonly string[];
  status: NavRouteCoverageStatus;
}

export interface NavRouteCoverageSummary {
  total: number;
  covered: number;
  permissionGaps: number;
  unmapped: number;
  blocked: number;
}

export type AccessSurfaceGovernanceGap =
  | "missing-route"
  | "missing-permission"
  | "missing-field-keys"
  | "missing-table"
  | "missing-tab-anchor"
  | "missing-activation"
  | "missing-masking";

export interface AccessSurfaceGovernanceRow {
  kind: AccessMatrixSurfaceKind;
  total: number;
  routeMapped: number;
  permissionMapped: number;
  fieldMapped: number;
  eventActivated: number;
  maskingMapped: number;
  gapSurfaces: number;
}

export interface AccessSurfaceGovernanceGapRow {
  surfaceId: string;
  module: string;
  kind: AccessMatrixSurfaceKind;
  label: string;
  route: string | null;
  table: string | null;
  tab: string | null;
  gaps: readonly AccessSurfaceGovernanceGap[];
}

export interface AccessSurfaceGovernanceSummary {
  total: number;
  covered: number;
  gaps: number;
}

export type AccessFieldCoverageGap =
  | "missing-surface"
  | "missing-route"
  | "missing-permission"
  | "missing-masking";

export interface AccessFieldCoverageRow {
  key: string;
  module: string;
  name: string;
  dataType: FieldMasterFull["data_type"];
  description: string | null;
  surfaces: readonly AccessMatrixSurface[];
  surfaceIds: readonly string[];
  kindCounts: Readonly<Record<AccessMatrixSurfaceKind, number>>;
  platforms: readonly AccessMatrixPlatform[];
  maskingBehaviors: readonly AccessMatrixMaskingBehavior[];
  permissions: readonly string[];
  routeMapped: number;
  eventActivated: number;
  printMapped: number;
  edgeMapped: number;
  gaps: readonly AccessFieldCoverageGap[];
}

export interface AccessFieldCoverageSummary {
  total: number;
  complete: number;
  gaps: number;
  edgeMapped: number;
  printMapped: number;
}

export interface AccessPlatformCoverageRow {
  platform: AccessMatrixPlatform;
  surfaces: readonly AccessMatrixSurface[];
  modules: readonly string[];
  kindCounts: Readonly<Record<AccessMatrixSurfaceKind, number>>;
  routeMapped: number;
  platformRouteMapped: number;
  permissionMapped: number;
  fieldMapped: number;
  maskingMapped: number;
  eventActivated: number;
  governanceGapSurfaces: number;
}

export interface AccessPlatformCoverageSummary {
  total: number;
  covered: number;
  gaps: number;
  tvSurfaces: number;
  kioskSurfaces: number;
}

export interface WorkflowKindCoverageRow extends AccessMatrixWorkflowExpectation {
  surfaces: readonly AccessMatrixSurface[];
  presentKinds: readonly AccessMatrixSurfaceKind[];
  missingKinds: readonly AccessMatrixSurfaceKind[];
  activatedSurfaces: number;
  permissions: ReadonlySet<string>;
  printSurfaces: number;
  printerRequired: number;
}

export interface WorkflowKindCoverageSummary {
  total: number;
  complete: number;
  gaps: number;
  eventDriven: number;
  printMapped: number;
  permissionMapped: number;
}

export type PatientFlowGovernanceGap =
  | "missing-surface"
  | "missing-platform"
  | "missing-launch-target"
  | "missing-surface-kind"
  | "missing-permission"
  | "missing-field-keys"
  | "missing-masking"
  | "missing-activation"
  | "missing-print"
  | "missing-public-display-policy";

export interface PatientFlowGovernanceExpectation {
  key: string;
  label: string;
  modules: readonly string[];
  requiredKinds: readonly AccessMatrixSurfaceKind[];
  requiredPlatforms: readonly AccessMatrixPlatform[];
  requiresPrint: boolean;
  requiresPublicDisplayPolicy: boolean;
}

export interface PatientFlowGovernanceRow extends PatientFlowGovernanceExpectation {
  surfaces: readonly AccessMatrixSurface[];
  presentKinds: readonly AccessMatrixSurfaceKind[];
  missingKinds: readonly AccessMatrixSurfaceKind[];
  presentPlatforms: readonly AccessMatrixPlatform[];
  missingPlatforms: readonly AccessMatrixPlatform[];
  launchTargetPlatforms: readonly AccessMatrixPlatform[];
  missingLaunchTargetPlatforms: readonly AccessMatrixPlatform[];
  routeMapped: number;
  permissionMapped: number;
  fieldMapped: number;
  maskingMapped: number;
  eventActivated: number;
  printSurfaces: number;
  publicDisplaySurfaces: number;
  publicDisclosureMapped: number;
  gaps: readonly PatientFlowGovernanceGap[];
}

export interface PatientFlowGovernanceSummary {
  total: number;
  complete: number;
  gaps: number;
  publicDisplayMapped: number;
  printMapped: number;
  edgeReady: number;
}

export const PATIENT_FLOW_GOVERNANCE_EXPECTATIONS: readonly PatientFlowGovernanceExpectation[] = [
  {
    key: "registration",
    label: "Registration desk",
    modules: ["patients"],
    requiredKinds: ["screen", "input", "action", "print"],
    requiredPlatforms: ["web", "mobile", "kiosk"],
    requiresPrint: true,
    requiresPublicDisplayPolicy: false,
  },
  {
    key: "opd",
    label: "OPD clinic",
    modules: ["opd"],
    requiredKinds: ["screen", "column", "input", "action", "print"],
    requiredPlatforms: ["web", "mobile", "tv", "kiosk"],
    requiresPrint: true,
    requiresPublicDisplayPolicy: true,
  },
  {
    key: "ipd",
    label: "IPD ward",
    modules: ["ipd"],
    requiredKinds: ["screen", "tab", "input", "action", "print"],
    requiredPlatforms: ["web", "mobile", "tv", "kiosk"],
    requiresPrint: true,
    requiresPublicDisplayPolicy: false,
  },
  {
    key: "emergency",
    label: "Emergency and MLC",
    modules: ["emergency"],
    requiredKinds: ["screen", "table", "input", "action", "print"],
    requiredPlatforms: ["web", "mobile", "tv", "kiosk"],
    requiresPrint: true,
    requiresPublicDisplayPolicy: true,
  },
  {
    key: "camp",
    label: "Camp workflow",
    modules: ["camp"],
    requiredKinds: ["screen", "tab", "input", "action", "print"],
    requiredPlatforms: ["web", "mobile", "kiosk"],
    requiresPrint: true,
    requiresPublicDisplayPolicy: false,
  },
  {
    key: "pharmacy",
    label: "Pharmacy",
    modules: ["pharmacy"],
    requiredKinds: ["screen", "table", "column", "input", "action", "print"],
    requiredPlatforms: ["web", "mobile", "tv", "kiosk"],
    requiresPrint: true,
    requiresPublicDisplayPolicy: true,
  },
  {
    key: "billing",
    label: "Billing",
    modules: ["billing"],
    requiredKinds: ["screen", "tab", "column", "input", "action", "print"],
    requiredPlatforms: ["web", "mobile", "tv", "kiosk"],
    requiresPrint: true,
    requiresPublicDisplayPolicy: true,
  },
];

interface NavRouteRequirement {
  path: string;
  labelKey: string;
  requiredPermissions: readonly string[];
}

export function normalizeCoverageRoute(path: string) {
  const [withoutQuery] = path.split("?");
  const [withoutHash] = (withoutQuery ?? path).split("#");
  const normalized = withoutHash && withoutHash.length > 0 ? withoutHash : "/";
  const withLeadingSlash = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, "") : withLeadingSlash;
}

function flattenNavItems(items: readonly NavItemConfig[], rows: NavRouteRequirement[]) {
  for (const item of items) {
    rows.push({
      path: normalizeCoverageRoute(item.path),
      labelKey: item.i18nKey,
      requiredPermissions: [
        ...(item.requiredPermission ? [item.requiredPermission] : []),
        ...(item.requiredPermissions ?? []),
      ],
    });
    if (item.children) {
      flattenNavItems(item.children, rows);
    }
  }
}

export function flattenNavRoutes(groups: readonly NavGroupConfig[]) {
  const rows: NavRouteRequirement[] = [];
  for (const group of groups) {
    flattenNavItems(group.items, rows);
  }

  const byPath = new Map<string, NavRouteRequirement>();
  for (const row of rows) {
    const previous = byPath.get(row.path);
    if (!previous) {
      byPath.set(row.path, row);
      continue;
    }
    byPath.set(row.path, {
      path: row.path,
      labelKey: previous.labelKey,
      requiredPermissions: [
        ...new Set([...previous.requiredPermissions, ...row.requiredPermissions]),
      ],
    });
  }

  return [...byPath.values()].sort((left, right) => left.path.localeCompare(right.path));
}

export function buildNavRouteCoverage(
  groups: readonly NavGroupConfig[],
  surfaces: readonly AccessMatrixSurface[],
): NavRouteCoverageRow[] {
  const surfaceRows = surfaces
    .filter((surface) => surface.route)
    .map((surface) => ({
      surface,
      path: normalizeCoverageRoute(surface.route ?? ""),
    }));

  return flattenNavRoutes(groups).map((route) => {
    const matchedSurfaces = surfaceRows
      .filter((surfaceRow) => surfaceRow.path === route.path)
      .map((surfaceRow) => surfaceRow.surface);
    const mappedPermissions = [
      ...new Set(matchedSurfaces.flatMap((surface) => [...surface.requiredPermissions])),
    ].sort();
    const missingPermissions = route.requiredPermissions.filter(
      (permission) => !mappedPermissions.includes(permission),
    );
    const status: NavRouteCoverageStatus =
      matchedSurfaces.length === 0
        ? "unmapped"
        : missingPermissions.length > 0
          ? "permission-gap"
          : "covered";

    return {
      path: route.path,
      labelKey: route.labelKey,
      requiredPermissions: route.requiredPermissions,
      mappedPermissions,
      surfaceIds: matchedSurfaces.map((surface) => surface.id).sort(),
      missingPermissions,
      status,
    };
  });
}

export function summarizeNavRouteCoverage(
  rows: readonly NavRouteCoverageRow[],
): NavRouteCoverageSummary {
  const covered = rows.filter((row) => row.status === "covered").length;
  const permissionGaps = rows.filter((row) => row.status === "permission-gap").length;
  const unmapped = rows.filter((row) => row.status === "unmapped").length;

  return {
    total: rows.length,
    covered,
    permissionGaps,
    unmapped,
    blocked: permissionGaps + unmapped,
  };
}

function surfaceHasTabAnchor(surface: AccessMatrixSurface) {
  return Boolean(surface.tab || surface.route?.includes("#") || surface.route?.includes("tab="));
}

export function accessSurfacePlatformRoute(
  surface: AccessMatrixSurface,
  platform: AccessMatrixPlatform,
): string | null {
  return surface.platformRoutes[platform] ?? (platform === "web" ? (surface.route ?? null) : null);
}

function surfaceGovernanceGaps(surface: AccessMatrixSurface): AccessSurfaceGovernanceGap[] {
  const gaps: AccessSurfaceGovernanceGap[] = [];

  if (surface.kind !== "widget" && !surface.route) {
    gaps.push("missing-route");
  }
  if (surface.requiredPermissions.length === 0) {
    gaps.push("missing-permission");
  }
  if ((surface.kind === "table" || surface.kind === "column") && !surface.table) {
    gaps.push("missing-table");
  }
  if (surface.kind === "tab" && !surfaceHasTabAnchor(surface)) {
    gaps.push("missing-tab-anchor");
  }
  if (
    (surface.kind === "input" || surface.kind === "column" || surface.kind === "table") &&
    surface.fieldAccessKeys.length === 0
  ) {
    gaps.push("missing-field-keys");
  }
  if (
    surface.masking !== "none" &&
    surface.fieldAccessKeys.length === 0 &&
    (surface.kind === "screen" ||
      surface.kind === "tab" ||
      surface.kind === "action" ||
      surface.kind === "print")
  ) {
    gaps.push("missing-field-keys");
  }
  if (
    (surface.kind === "action" || surface.kind === "print") &&
    surface.activatesAfter.length === 0
  ) {
    gaps.push("missing-activation");
  }
  if (surface.fieldAccessKeys.length > 0 && surface.masking === "none") {
    gaps.push("missing-masking");
  }

  return gaps;
}

export function buildAccessSurfaceGovernanceCoverage(
  surfaces: readonly AccessMatrixSurface[],
): AccessSurfaceGovernanceRow[] {
  const rows = new Map<AccessMatrixSurfaceKind, AccessSurfaceGovernanceRow>();

  for (const surface of surfaces) {
    const row = rows.get(surface.kind) ?? {
      kind: surface.kind,
      total: 0,
      routeMapped: 0,
      permissionMapped: 0,
      fieldMapped: 0,
      eventActivated: 0,
      maskingMapped: 0,
      gapSurfaces: 0,
    };
    const gaps = surfaceGovernanceGaps(surface);

    row.total += 1;
    if (surface.route) row.routeMapped += 1;
    if (surface.requiredPermissions.length > 0) row.permissionMapped += 1;
    if (surface.fieldAccessKeys.length > 0) row.fieldMapped += 1;
    if (surface.activatesAfter.length > 0) row.eventActivated += 1;
    if (surface.masking !== "none") row.maskingMapped += 1;
    if (gaps.length > 0) row.gapSurfaces += 1;

    rows.set(surface.kind, row);
  }

  return [...rows.values()].sort((left, right) => left.kind.localeCompare(right.kind));
}

export function buildAccessSurfaceGovernanceGapRows(
  surfaces: readonly AccessMatrixSurface[],
): AccessSurfaceGovernanceGapRow[] {
  return surfaces
    .map((surface) => ({
      surfaceId: surface.id,
      module: surface.module,
      kind: surface.kind,
      label: surface.label,
      route: surface.route ?? null,
      table: surface.table ?? null,
      tab: surface.tab ?? null,
      gaps: surfaceGovernanceGaps(surface),
    }))
    .filter((row) => row.gaps.length > 0)
    .sort((left, right) => {
      const kindComparison = left.kind.localeCompare(right.kind);
      return kindComparison === 0 ? left.surfaceId.localeCompare(right.surfaceId) : kindComparison;
    });
}

export function summarizeAccessSurfaceGovernance(
  rows: readonly AccessSurfaceGovernanceRow[],
): AccessSurfaceGovernanceSummary {
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const gaps = rows.reduce((sum, row) => sum + row.gapSurfaces, 0);
  return {
    total,
    covered: total - gaps,
    gaps,
  };
}

export function accessMatrixFieldKey(field: FieldMasterFull) {
  return `${field.db_table ?? "general"}.${field.code}`;
}

function emptyKindCounts(): Record<AccessMatrixSurfaceKind, number> {
  const counts: Record<AccessMatrixSurfaceKind, number> = {
    action: 0,
    column: 0,
    input: 0,
    print: 0,
    screen: 0,
    tab: 0,
    table: 0,
    widget: 0,
  };

  return counts;
}

function fieldCoverageGaps({
  maskingBehaviors,
  permissions,
  routeMapped,
  surfaces,
}: Pick<
  AccessFieldCoverageRow,
  "maskingBehaviors" | "permissions" | "routeMapped" | "surfaces"
>): AccessFieldCoverageGap[] {
  const gaps: AccessFieldCoverageGap[] = [];

  if (surfaces.length === 0) {
    gaps.push("missing-surface");
  }
  if (surfaces.length > 0 && routeMapped === 0) {
    gaps.push("missing-route");
  }
  if (surfaces.length > 0 && permissions.length === 0) {
    gaps.push("missing-permission");
  }
  if (surfaces.length > 0 && maskingBehaviors.length === 0) {
    gaps.push("missing-masking");
  }

  return gaps;
}

export function buildAccessFieldCoverage(
  fields: readonly FieldMasterFull[],
  surfaces: readonly AccessMatrixSurface[],
): AccessFieldCoverageRow[] {
  const surfacesByField = new Map<string, AccessMatrixSurface[]>();

  for (const surface of surfaces) {
    for (const key of new Set(surface.fieldAccessKeys)) {
      surfacesByField.set(key, [...(surfacesByField.get(key) ?? []), surface]);
    }
  }

  return fields
    .map((field) => {
      const key = accessMatrixFieldKey(field);
      const fieldSurfaces = surfacesByField.get(key) ?? [];
      const kindCounts = emptyKindCounts();
      for (const surface of fieldSurfaces) {
        kindCounts[surface.kind] += 1;
      }
      const platforms = [
        ...new Set(fieldSurfaces.flatMap((surface) => [...surface.platforms])),
      ].sort();
      const maskingBehaviors = [
        ...new Set(
          fieldSurfaces.map((surface) => surface.masking).filter((masking) => masking !== "none"),
        ),
      ].sort();
      const permissions = [
        ...new Set(fieldSurfaces.flatMap((surface) => [...surface.requiredPermissions])),
      ].sort();
      const routeMapped = fieldSurfaces.filter((surface) => surface.route).length;
      const rowWithoutGaps = {
        dataType: field.data_type,
        description: field.description,
        edgeMapped: fieldSurfaces.filter((surface) =>
          surface.platforms.some((platform) => platform !== "web"),
        ).length,
        eventActivated: fieldSurfaces.filter((surface) => surface.activatesAfter.length > 0).length,
        gaps: [],
        key,
        kindCounts,
        maskingBehaviors,
        module: field.db_table ?? "general",
        name: field.name,
        permissions,
        platforms,
        printMapped: fieldSurfaces.filter((surface) => surface.kind === "print").length,
        routeMapped,
        surfaceIds: fieldSurfaces.map((surface) => surface.id).sort(),
        surfaces: fieldSurfaces,
      } satisfies Omit<AccessFieldCoverageRow, "gaps"> & {
        gaps: readonly AccessFieldCoverageGap[];
      };

      return {
        ...rowWithoutGaps,
        gaps: fieldCoverageGaps(rowWithoutGaps),
      };
    })
    .sort((left, right) => {
      const moduleComparison = left.module.localeCompare(right.module);
      return moduleComparison === 0 ? left.key.localeCompare(right.key) : moduleComparison;
    });
}

export function summarizeAccessFieldCoverage(
  rows: readonly AccessFieldCoverageRow[],
): AccessFieldCoverageSummary {
  return {
    total: rows.length,
    complete: rows.filter((row) => row.gaps.length === 0).length,
    gaps: rows.filter((row) => row.gaps.length > 0).length,
    edgeMapped: rows.filter((row) => row.edgeMapped > 0).length,
    printMapped: rows.filter((row) => row.printMapped > 0).length,
  };
}

export function buildAccessPlatformCoverage(
  surfaces: readonly AccessMatrixSurface[],
  platforms: readonly AccessMatrixPlatform[] = ACCESS_MATRIX_PLATFORMS,
): AccessPlatformCoverageRow[] {
  return platforms.map((platform) => {
    const platformSurfaces = surfaces.filter((surface) => surface.platforms.includes(platform));
    const kindCounts = emptyKindCounts();

    for (const surface of platformSurfaces) {
      kindCounts[surface.kind] += 1;
    }

    return {
      platform,
      surfaces: platformSurfaces,
      modules: [...new Set(platformSurfaces.map((surface) => surface.module))].sort(),
      kindCounts,
      routeMapped: platformSurfaces.filter((surface) => surface.route).length,
      platformRouteMapped: platformSurfaces.filter((surface) =>
        Boolean(accessSurfacePlatformRoute(surface, platform)),
      ).length,
      permissionMapped: platformSurfaces.filter((surface) => surface.requiredPermissions.length > 0)
        .length,
      fieldMapped: platformSurfaces.filter((surface) => surface.fieldAccessKeys.length > 0).length,
      maskingMapped: platformSurfaces.filter((surface) => surface.masking !== "none").length,
      eventActivated: platformSurfaces.filter((surface) => surface.activatesAfter.length > 0)
        .length,
      governanceGapSurfaces: platformSurfaces.filter(
        (surface) => surfaceGovernanceGaps(surface).length > 0,
      ).length,
    };
  });
}

export function summarizeAccessPlatformCoverage(
  rows: readonly AccessPlatformCoverageRow[],
): AccessPlatformCoverageSummary {
  const gaps = rows.reduce((sum, row) => sum + row.governanceGapSurfaces, 0);
  return {
    total: rows.length,
    covered: rows.filter((row) => row.surfaces.length > 0 && row.governanceGapSurfaces === 0)
      .length,
    gaps,
    tvSurfaces: rows.find((row) => row.platform === "tv")?.surfaces.length ?? 0,
    kioskSurfaces: rows.find((row) => row.platform === "kiosk")?.surfaces.length ?? 0,
  };
}

export function buildWorkflowKindCoverage(
  expectations: readonly AccessMatrixWorkflowExpectation[],
  surfaces: readonly AccessMatrixSurface[],
): WorkflowKindCoverageRow[] {
  return expectations.map((workflow) => {
    const workflowSurfaces = surfaces.filter((surface) =>
      workflow.modules.includes(surface.module),
    );
    const presentKinds = [...new Set(workflowSurfaces.map((surface) => surface.kind))].sort();
    const missingKinds = workflow.requiredKinds.filter((kind) => !presentKinds.includes(kind));
    const permissions = new Set(
      workflowSurfaces.flatMap((surface) => [...surface.requiredPermissions]),
    );
    const printSurfaces = workflowSurfaces.filter((surface) => surface.kind === "print");

    return {
      ...workflow,
      activatedSurfaces: workflowSurfaces.filter((surface) => surface.activatesAfter.length > 0)
        .length,
      missingKinds,
      permissions,
      presentKinds,
      printerRequired: printSurfaces.filter((surface) => surface.requiresPrinter).length,
      printSurfaces: printSurfaces.length,
      surfaces: workflowSurfaces,
    };
  });
}

export function summarizeWorkflowKindCoverage(
  rows: readonly WorkflowKindCoverageRow[],
): WorkflowKindCoverageSummary {
  return {
    total: rows.length,
    complete: rows.filter((row) => row.missingKinds.length === 0).length,
    gaps: rows.filter((row) => row.missingKinds.length > 0).length,
    eventDriven: rows.filter((row) => row.activatedSurfaces > 0).length,
    printMapped: rows.filter((row) => row.printSurfaces > 0).length,
    permissionMapped: rows.filter((row) => row.permissions.size > 0).length,
  };
}

function publicDisplayPolicyMapped(surface: AccessMatrixSurface) {
  return (
    surface.id.startsWith("token_boards.") &&
    surface.id.endsWith(".public_display") &&
    surface.fieldAccessKeys.length > 0 &&
    surface.masking !== "none" &&
    surface.platforms.includes("tv") &&
    surface.platforms.includes("kiosk") &&
    surface.standardRefs.some((standard) => {
      const normalized = standard.toLowerCase();
      return (
        normalized.includes("privacy") ||
        normalized.includes("minimisation") ||
        normalized.includes("ipsg")
      );
    })
  );
}

export function buildPatientFlowGovernanceCoverage(
  surfaces: readonly AccessMatrixSurface[],
  expectations: readonly PatientFlowGovernanceExpectation[] = PATIENT_FLOW_GOVERNANCE_EXPECTATIONS,
): PatientFlowGovernanceRow[] {
  return expectations.map((expectation) => {
    const flowSurfaces = surfaces.filter((surface) => expectation.modules.includes(surface.module));
    const presentKinds = [...new Set(flowSurfaces.map((surface) => surface.kind))].sort();
    const presentPlatforms = [
      ...new Set(flowSurfaces.flatMap((surface) => [...surface.platforms])),
    ].sort();
    const launchTargetPlatforms = expectation.requiredPlatforms.filter((platform) =>
      flowSurfaces.some((surface) => Boolean(accessSurfacePlatformRoute(surface, platform))),
    );
    const publicDisplaySurfaces = flowSurfaces.filter(
      (surface) => surface.id.startsWith("token_boards.") && surface.id.endsWith(".public_display"),
    );
    const rowWithoutGaps = {
      ...expectation,
      eventActivated: flowSurfaces.filter((surface) => surface.activatesAfter.length > 0).length,
      fieldMapped: flowSurfaces.filter((surface) => surface.fieldAccessKeys.length > 0).length,
      gaps: [],
      launchTargetPlatforms,
      maskingMapped: flowSurfaces.filter((surface) => surface.masking !== "none").length,
      missingKinds: expectation.requiredKinds.filter((kind) => !presentKinds.includes(kind)),
      missingLaunchTargetPlatforms: expectation.requiredPlatforms.filter(
        (platform) => !launchTargetPlatforms.includes(platform),
      ),
      missingPlatforms: expectation.requiredPlatforms.filter(
        (platform) => !presentPlatforms.includes(platform),
      ),
      permissionMapped: flowSurfaces.filter((surface) => surface.requiredPermissions.length > 0)
        .length,
      presentKinds,
      presentPlatforms,
      printSurfaces: flowSurfaces.filter((surface) => surface.kind === "print").length,
      publicDisclosureMapped: publicDisplaySurfaces.filter(publicDisplayPolicyMapped).length,
      publicDisplaySurfaces: publicDisplaySurfaces.length,
      routeMapped: flowSurfaces.filter((surface) => surface.route).length,
      surfaces: flowSurfaces,
    } satisfies Omit<PatientFlowGovernanceRow, "gaps"> & {
      gaps: readonly PatientFlowGovernanceGap[];
    };
    const gaps: PatientFlowGovernanceGap[] = [];

    if (rowWithoutGaps.surfaces.length === 0) gaps.push("missing-surface");
    if (rowWithoutGaps.missingPlatforms.length > 0) gaps.push("missing-platform");
    if (rowWithoutGaps.missingLaunchTargetPlatforms.length > 0) {
      gaps.push("missing-launch-target");
    }
    if (rowWithoutGaps.missingKinds.length > 0) gaps.push("missing-surface-kind");
    if (rowWithoutGaps.permissionMapped === 0) gaps.push("missing-permission");
    if (rowWithoutGaps.fieldMapped === 0) gaps.push("missing-field-keys");
    if (rowWithoutGaps.maskingMapped === 0) gaps.push("missing-masking");
    if (rowWithoutGaps.eventActivated === 0) gaps.push("missing-activation");
    if (expectation.requiresPrint && rowWithoutGaps.printSurfaces === 0) {
      gaps.push("missing-print");
    }
    if (expectation.requiresPublicDisplayPolicy && rowWithoutGaps.publicDisclosureMapped === 0) {
      gaps.push("missing-public-display-policy");
    }

    return {
      ...rowWithoutGaps,
      gaps,
    };
  });
}

export function summarizePatientFlowGovernance(
  rows: readonly PatientFlowGovernanceRow[],
): PatientFlowGovernanceSummary {
  return {
    total: rows.length,
    complete: rows.filter((row) => row.gaps.length === 0).length,
    gaps: rows.filter((row) => row.gaps.length > 0).length,
    publicDisplayMapped: rows.filter(
      (row) => !row.requiresPublicDisplayPolicy || row.publicDisclosureMapped > 0,
    ).length,
    printMapped: rows.filter((row) => !row.requiresPrint || row.printSurfaces > 0).length,
    edgeReady: rows.filter(
      (row) => row.missingPlatforms.length === 0 && row.missingLaunchTargetPlatforms.length === 0,
    ).length,
  };
}

import type { AccessMatrixSurface, AccessMatrixSurfaceKind } from "@medbrains/types";
import type { NavGroupConfig, NavItemConfig } from "@/config/navigation";

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

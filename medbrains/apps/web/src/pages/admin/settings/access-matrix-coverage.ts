import type { AccessMatrixSurface } from "@medbrains/types";
import type { NavGroupConfig, NavItemConfig } from "../../../config/navigation";

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

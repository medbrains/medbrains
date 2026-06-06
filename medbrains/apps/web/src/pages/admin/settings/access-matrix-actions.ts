import type {
  AccessMatrixSurface,
  AccessMatrixSurfaceKind,
  ClinicalJourneyActionDefinition,
  ClinicalJourneySurface,
} from "@medbrains/types";

export type JourneyActionCoverageGap =
  | "missing-surface"
  | "missing-permission"
  | "missing-activation";

export interface JourneyActionCoverageRow {
  actionId: string;
  label: string;
  module: string;
  surfaces: readonly string[];
  permissionCoverage: readonly JourneyActionPermissionCoverage[];
  requiredPermissions: readonly string[];
  activationEvents: readonly string[];
  matchedSurfaceIds: readonly string[];
  matchedSurfaceKinds: readonly AccessMatrixSurfaceKind[];
  missingPermissions: readonly string[];
  missingActivationEvents: readonly string[];
  gaps: readonly JourneyActionCoverageGap[];
}

export type JourneyActionPermissionScope = "base" | ClinicalJourneySurface;

export interface JourneyActionPermissionCoverage {
  covered: boolean;
  missingPermissions: readonly string[];
  permissionMode: "all" | "any";
  requiredPermissions: readonly string[];
  scope: JourneyActionPermissionScope;
}

export interface JourneyActionCoverageSummary {
  total: number;
  covered: number;
  gaps: number;
  missingSurfaces: number;
  permissionGaps: number;
  activationGaps: number;
}

export const JOURNEY_ACTION_COVERAGE_GAP_LABELS: Record<JourneyActionCoverageGap, string> = {
  "missing-surface": "surface missing",
  "missing-permission": "permission mismatch",
  "missing-activation": "event activation missing",
};

function intersects(left: readonly string[], right: readonly string[]) {
  const rightSet = new Set(right);
  return left.some((item) => rightSet.has(item));
}

function acceptedSurfaceKinds(
  action: ClinicalJourneyActionDefinition,
): readonly AccessMatrixSurfaceKind[] {
  if (action.id === "patient.print_card") return ["print"];
  if (action.id === "patient.share") return ["action"];
  if (action.module === "orders") return ["action"];
  return ["screen", "tab", "action", "print"];
}

function moduleMatches(action: ClinicalJourneyActionDefinition, surface: AccessMatrixSurface) {
  if (action.module === surface.module) return true;
  if (action.module === "orders") {
    return intersects(actionRequiredPermissions(action), surface.requiredPermissions);
  }
  return false;
}

function candidateSurface(action: ClinicalJourneyActionDefinition, surface: AccessMatrixSurface) {
  if (!acceptedSurfaceKinds(action).includes(surface.kind)) return false;
  if (!moduleMatches(action, surface)) return false;

  return (
    intersects(actionRequiredPermissions(action), surface.requiredPermissions) ||
    intersects(action.activatesAfter, surface.activatesAfter)
  );
}

function actionPermissionSets(action: ClinicalJourneyActionDefinition) {
  return [
    {
      scope: "base" as const,
      permissionMode: action.permissionMode,
      requiredPermissions: action.requiredPermissions,
    },
    ...Object.entries(action.surfacePermissions ?? {}).map(([scope, permissionSet]) => ({
      scope: scope as ClinicalJourneySurface,
      ...permissionSet,
    })),
  ];
}

function actionRequiredPermissions(action: ClinicalJourneyActionDefinition) {
  return [
    ...new Set(
      actionPermissionSets(action).flatMap((permissionSet) => [
        ...permissionSet.requiredPermissions,
      ]),
    ),
  ];
}

function permissionSetSatisfied(
  permissionSet: {
    permissionMode?: "all" | "any";
    requiredPermissions: readonly string[];
  },
  permissions: Set<string>,
) {
  if (permissionSet.permissionMode === "any") {
    return permissionSet.requiredPermissions.some((permission) => permissions.has(permission));
  }
  return permissionSet.requiredPermissions.every((permission) => permissions.has(permission));
}

function permissionSatisfied(action: ClinicalJourneyActionDefinition, permissions: Set<string>) {
  return actionPermissionSets(action).every((permissionSet) =>
    permissionSetSatisfied(permissionSet, permissions),
  );
}

function missingPermissions(action: ClinicalJourneyActionDefinition, permissions: Set<string>) {
  return [
    ...new Set(
      actionPermissionSets(action).flatMap((permissionSet) =>
        permissionSetSatisfied(permissionSet, permissions)
          ? []
          : permissionSet.requiredPermissions.filter((permission) => !permissions.has(permission)),
      ),
    ),
  ];
}

function permissionCoverage(
  action: ClinicalJourneyActionDefinition,
  permissions: Set<string>,
): JourneyActionPermissionCoverage[] {
  return actionPermissionSets(action).map((permissionSet) => {
    const covered = permissionSetSatisfied(permissionSet, permissions);

    return {
      covered,
      missingPermissions: covered
        ? []
        : permissionSet.requiredPermissions.filter((permission) => !permissions.has(permission)),
      permissionMode: permissionSet.permissionMode ?? "all",
      requiredPermissions: permissionSet.requiredPermissions,
      scope: permissionSet.scope,
    };
  });
}

function activationSatisfied(action: ClinicalJourneyActionDefinition, events: Set<string>) {
  return (
    action.activatesAfter.length === 0 || action.activatesAfter.some((event) => events.has(event))
  );
}

export function buildJourneyActionCoverage(
  actions: readonly ClinicalJourneyActionDefinition[],
  surfaces: readonly AccessMatrixSurface[],
): JourneyActionCoverageRow[] {
  return actions.map((action) => {
    const matchedSurfaces = surfaces.filter((surface) => candidateSurface(action, surface));
    const permissions = new Set(
      matchedSurfaces.flatMap((surface) => [...surface.requiredPermissions]),
    );
    const events = new Set(matchedSurfaces.flatMap((surface) => [...surface.activatesAfter]));
    const gaps: JourneyActionCoverageGap[] = [];

    if (matchedSurfaces.length === 0) gaps.push("missing-surface");
    if (!permissionSatisfied(action, permissions)) gaps.push("missing-permission");
    if (!activationSatisfied(action, events)) gaps.push("missing-activation");

    return {
      actionId: action.id,
      label: action.label,
      module: action.module,
      surfaces: action.surfaces,
      permissionCoverage: permissionCoverage(action, permissions),
      requiredPermissions: actionRequiredPermissions(action),
      activationEvents: action.activatesAfter,
      matchedSurfaceIds: matchedSurfaces.map((surface) => surface.id).sort(),
      matchedSurfaceKinds: [...new Set(matchedSurfaces.map((surface) => surface.kind))].sort(),
      missingPermissions: missingPermissions(action, permissions),
      missingActivationEvents: activationSatisfied(action, events) ? [] : action.activatesAfter,
      gaps,
    };
  });
}

export function summarizeJourneyActionCoverage(
  rows: readonly JourneyActionCoverageRow[],
): JourneyActionCoverageSummary {
  return {
    total: rows.length,
    covered: rows.filter((row) => row.gaps.length === 0).length,
    gaps: rows.filter((row) => row.gaps.length > 0).length,
    missingSurfaces: rows.filter((row) => row.gaps.includes("missing-surface")).length,
    permissionGaps: rows.filter((row) => row.gaps.includes("missing-permission")).length,
    activationGaps: rows.filter((row) => row.gaps.includes("missing-activation")).length,
  };
}

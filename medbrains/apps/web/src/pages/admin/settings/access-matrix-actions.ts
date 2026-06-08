import type {
  AccessMatrixSurface,
  AccessMatrixSurfaceKind,
  ClinicalJourneyActionDefinition,
  ClinicalJourneyActionId,
  ClinicalJourneyBlockingControl,
  ClinicalJourneyContext,
  ClinicalJourneySurface,
} from "@medbrains/types";
import { patientJourneyActionRoute } from "@medbrains/types";

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
  blockingControls: readonly ClinicalJourneyBlockingControl[];
  routeTargets: readonly string[];
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
  guardedActions: number;
  routeLinked: number;
  configurationControls: number;
  contextControls: number;
  maskingControls: number;
  regulatoryControls: number;
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

const BASE_ROUTE_CONTEXT: ClinicalJourneyContext = {
  patientId: ":patientId",
};

const JOURNEY_ACTION_ROUTE_CONTEXTS: Partial<
  Record<ClinicalJourneyActionId, readonly ClinicalJourneyContext[]>
> = {
  "orders.medication": [
    { ...BASE_ROUTE_CONTEXT, activeEncounterId: ":encounterId", activeOrderContext: "opd" },
    { ...BASE_ROUTE_CONTEXT, activeAdmissionId: ":admissionId", activeOrderContext: "ipd" },
  ],
  "orders.lab": [
    { ...BASE_ROUTE_CONTEXT, activeEncounterId: ":encounterId", activeOrderContext: "opd" },
    { ...BASE_ROUTE_CONTEXT, activeAdmissionId: ":admissionId", activeOrderContext: "ipd" },
  ],
  "orders.radiology": [
    { ...BASE_ROUTE_CONTEXT, activeEncounterId: ":encounterId", activeOrderContext: "opd" },
    { ...BASE_ROUTE_CONTEXT, activeAdmissionId: ":admissionId", activeOrderContext: "ipd" },
  ],
  "ipd.open_admission": [{ ...BASE_ROUTE_CONTEXT, activeAdmissionId: ":admissionId" }],
  "emergency.open_visit": [
    { ...BASE_ROUTE_CONTEXT, activeEmergencyVisitId: ":emergencyVisitId" },
    BASE_ROUTE_CONTEXT,
  ],
  "emergency.open_mlc": [
    { ...BASE_ROUTE_CONTEXT, activeEmergencyVisitId: ":emergencyVisitId" },
    BASE_ROUTE_CONTEXT,
  ],
  "camp.open_context": [
    {
      ...BASE_ROUTE_CONTEXT,
      activeCampId: ":campId",
      activeCampRegistrationId: ":campRegistrationId",
    },
    { ...BASE_ROUTE_CONTEXT, activeCampId: ":campId" },
    BASE_ROUTE_CONTEXT,
  ],
  "billing.open_ledger": [
    { ...BASE_ROUTE_CONTEXT, activeInvoiceId: ":invoiceId" },
    BASE_ROUTE_CONTEXT,
  ],
  "billing.collect_payment": [
    { ...BASE_ROUTE_CONTEXT, activeInvoiceId: ":invoiceId" },
    BASE_ROUTE_CONTEXT,
  ],
  "pharmacy.open_patient_queue": [
    { ...BASE_ROUTE_CONTEXT, activePharmacyOrderId: ":pharmacyOrderId" },
    BASE_ROUTE_CONTEXT,
  ],
  "pharmacy.dispense_order": [
    { ...BASE_ROUTE_CONTEXT, activePharmacyOrderId: ":pharmacyOrderId" },
    BASE_ROUTE_CONTEXT,
  ],
  "mrd.open_case_sheet": [
    { ...BASE_ROUTE_CONTEXT, activeAdmissionId: ":admissionId" },
    { ...BASE_ROUTE_CONTEXT, activeEncounterId: ":encounterId" },
    BASE_ROUTE_CONTEXT,
  ],
};

function actionRouteTargets(actionId: ClinicalJourneyActionId) {
  const contexts = JOURNEY_ACTION_ROUTE_CONTEXTS[actionId] ?? [BASE_ROUTE_CONTEXT];
  return [
    ...new Set(
      contexts
        .map((context) => patientJourneyActionRoute(actionId, context))
        .filter((route): route is string => route !== null),
    ),
  ];
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
      blockingControls: action.blockingControls ?? [],
      routeTargets: actionRouteTargets(action.id),
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
    guardedActions: rows.filter((row) => row.blockingControls.length > 0).length,
    routeLinked: rows.filter((row) => row.routeTargets.length > 0).length,
    configurationControls: rows.filter((row) => row.blockingControls.includes("configuration"))
      .length,
    contextControls: rows.filter((row) => row.blockingControls.includes("context")).length,
    maskingControls: rows.filter((row) => row.blockingControls.includes("masking")).length,
    regulatoryControls: rows.filter((row) => row.blockingControls.includes("regulatory")).length,
  };
}

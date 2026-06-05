import type { ClinicalEventName, QueueEntry, QueueStatus } from "@medbrains/types";
import { P } from "@medbrains/types";

export type OpdQueueRowActionId =
  | "record_vitals"
  | "open_visit"
  | "call_patient"
  | "start_consultation"
  | "complete_visit"
  | "mark_no_show";

export interface OpdQueueRowActionPermissions {
  canManageToken: boolean;
  canOpenVisit: boolean;
  canRecordVitals: boolean;
}

interface OpdQueueRowActionDefinition {
  id: OpdQueueRowActionId;
  label: string;
  requiredPermissions: readonly string[];
  permissionMode?: "all" | "any";
  activatesAfter: readonly ClinicalEventName[];
  allowedStatuses: readonly QueueStatus[];
  disabledStatusReason: string;
  showWhenStatusBlocked?: boolean;
  permitted: (permissions: OpdQueueRowActionPermissions) => boolean;
}

export interface ResolvedOpdQueueRowAction extends Omit<OpdQueueRowActionDefinition, "permitted"> {
  enabled: boolean;
  visible: boolean;
  disabledReasonText: string | null;
}

const ENCOUNTER_CREATED: readonly ClinicalEventName[] = ["opd.encounter.created"];
const WAITING: readonly QueueStatus[] = ["waiting"];
const CALLED: readonly QueueStatus[] = ["called"];
const IN_CONSULTATION: readonly QueueStatus[] = ["in_consultation"];
const CALLABLE: readonly QueueStatus[] = ["waiting", "called"];
const VISIT_OPENABLE: readonly QueueStatus[] = ["called", "in_consultation", "completed"];
const VITALS_ALLOWED: readonly QueueStatus[] = ["waiting", "called", "in_consultation"];

export const OPD_QUEUE_ROW_ACTIONS: readonly OpdQueueRowActionDefinition[] = [
  {
    activatesAfter: ENCOUNTER_CREATED,
    allowedStatuses: VITALS_ALLOWED,
    disabledStatusReason:
      "Vitals are available while the patient is waiting, called, or in consultation",
    id: "record_vitals",
    label: "Record vitals",
    permissionMode: "any",
    permitted: (permissions) => permissions.canRecordVitals,
    requiredPermissions: [P.OPD.VISIT_UPDATE, P.NURSE.VITALS_RECORD],
  },
  {
    activatesAfter: ENCOUNTER_CREATED,
    allowedStatuses: VISIT_OPENABLE,
    disabledStatusReason: "Call patient before opening OPD visit",
    id: "open_visit",
    label: "Open OPD visit",
    permitted: (permissions) => permissions.canOpenVisit,
    requiredPermissions: [P.OPD.QUEUE_VIEW],
    showWhenStatusBlocked: true,
  },
  {
    activatesAfter: ENCOUNTER_CREATED,
    allowedStatuses: WAITING,
    disabledStatusReason: "Patient must be waiting before call",
    id: "call_patient",
    label: "Call patient",
    permitted: (permissions) => permissions.canManageToken,
    requiredPermissions: [P.OPD.TOKEN_MANAGE],
  },
  {
    activatesAfter: ENCOUNTER_CREATED,
    allowedStatuses: CALLED,
    disabledStatusReason: "Call patient before starting consultation",
    id: "start_consultation",
    label: "Start consultation",
    permitted: (permissions) => permissions.canManageToken,
    requiredPermissions: [P.OPD.TOKEN_MANAGE],
  },
  {
    activatesAfter: ENCOUNTER_CREATED,
    allowedStatuses: IN_CONSULTATION,
    disabledStatusReason: "Start consultation before completing visit",
    id: "complete_visit",
    label: "Complete",
    permitted: (permissions) => permissions.canManageToken,
    requiredPermissions: [P.OPD.TOKEN_MANAGE],
  },
  {
    activatesAfter: ENCOUNTER_CREATED,
    allowedStatuses: CALLABLE,
    disabledStatusReason: "Only waiting or called patients can be marked no-show",
    id: "mark_no_show",
    label: "No show",
    permitted: (permissions) => permissions.canManageToken,
    requiredPermissions: [P.OPD.TOKEN_MANAGE],
  },
];

function permissionDisabledReason(action: OpdQueueRowActionDefinition): string {
  if (action.permissionMode === "any") {
    return `Requires one of ${action.requiredPermissions.join(" / ")}`;
  }
  return `Requires ${action.requiredPermissions.join(" + ")}`;
}

function statusMatches(status: string, allowedStatuses: readonly QueueStatus[]): boolean {
  return allowedStatuses.some((allowedStatus) => allowedStatus === status);
}

export function resolveOpdQueueRowActions(
  row: Pick<QueueEntry, "status">,
  permissions: OpdQueueRowActionPermissions,
): readonly ResolvedOpdQueueRowAction[] {
  return OPD_QUEUE_ROW_ACTIONS.map((action) => {
    const hasPermission = action.permitted(permissions);
    const hasRequiredStatus = statusMatches(row.status, action.allowedStatuses);
    const enabled = hasPermission && hasRequiredStatus;
    const visible = hasPermission && (hasRequiredStatus || action.showWhenStatusBlocked === true);
    const disabledReasonText = !hasPermission
      ? permissionDisabledReason(action)
      : hasRequiredStatus
        ? null
        : action.disabledStatusReason;

    return {
      activatesAfter: action.activatesAfter,
      allowedStatuses: action.allowedStatuses,
      disabledReasonText,
      disabledStatusReason: action.disabledStatusReason,
      enabled,
      id: action.id,
      label: action.label,
      permissionMode: action.permissionMode,
      requiredPermissions: action.requiredPermissions,
      showWhenStatusBlocked: action.showWhenStatusBlocked,
      visible,
    };
  });
}

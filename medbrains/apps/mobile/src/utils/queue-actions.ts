import type { ClinicalEventName, QueueEntry, QueueStatus } from "@medbrains/types";
import { P } from "@medbrains/types";

export type MobileQueueActionId = "call" | "start" | "complete" | "noShow";

export interface MobileQueueActionPermissions {
  canManageQueue: boolean;
}

interface MobileQueueActionDefinition {
  id: MobileQueueActionId;
  requiredPermissions: readonly string[];
  activatesAfter: readonly ClinicalEventName[];
  allowedStatuses: readonly QueueStatus[];
}

export interface ResolvedMobileQueueAction extends MobileQueueActionDefinition {
  enabled: boolean;
}

const ENCOUNTER_CREATED: readonly ClinicalEventName[] = ["opd.encounter.created"];
const WAITING: readonly QueueStatus[] = ["waiting"];
const CALLED: readonly QueueStatus[] = ["called"];
const IN_CONSULTATION: readonly QueueStatus[] = ["in_consultation"];
const CALLABLE: readonly QueueStatus[] = ["waiting", "called"];

export const MOBILE_QUEUE_ACTIONS: readonly MobileQueueActionDefinition[] = [
  {
    activatesAfter: ENCOUNTER_CREATED,
    allowedStatuses: WAITING,
    id: "call",
    requiredPermissions: [P.OPD.TOKEN_MANAGE],
  },
  {
    activatesAfter: ENCOUNTER_CREATED,
    allowedStatuses: CALLED,
    id: "start",
    requiredPermissions: [P.OPD.TOKEN_MANAGE],
  },
  {
    activatesAfter: ENCOUNTER_CREATED,
    allowedStatuses: IN_CONSULTATION,
    id: "complete",
    requiredPermissions: [P.OPD.TOKEN_MANAGE],
  },
  {
    activatesAfter: ENCOUNTER_CREATED,
    allowedStatuses: CALLABLE,
    id: "noShow",
    requiredPermissions: [P.OPD.TOKEN_MANAGE],
  },
];

function statusMatches(status: string, allowedStatuses: readonly QueueStatus[]): boolean {
  return allowedStatuses.some((allowedStatus) => allowedStatus === status);
}

export function resolveMobileQueueActions(
  row: Pick<QueueEntry, "status">,
  permissions: MobileQueueActionPermissions,
): readonly ResolvedMobileQueueAction[] {
  return MOBILE_QUEUE_ACTIONS.map((action) => ({
    activatesAfter: action.activatesAfter,
    allowedStatuses: action.allowedStatuses,
    enabled: permissions.canManageQueue && statusMatches(row.status, action.allowedStatuses),
    id: action.id,
    requiredPermissions: action.requiredPermissions,
  }));
}

export function mobileQueueActionEnabled(
  actions: readonly ResolvedMobileQueueAction[],
  id: MobileQueueActionId,
): boolean {
  return actions.some((action) => action.id === id && action.enabled);
}

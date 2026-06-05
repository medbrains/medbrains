import type { ClinicalEventName } from "@medbrains/types";
import { P } from "@medbrains/types";

export type IpdActionRailSection =
  | "handoffs"
  | "orders"
  | "mrd"
  | "admission"
  | "finance"
  | "discharge";

export type IpdOrderBasketTab = "drug" | "lab" | "radiology";

export type IpdActionRailActionId =
  | "order_medicines"
  | "order_lab"
  | "order_imaging"
  | "refer_out"
  | "dama_lama"
  | "mark_death";

export interface IpdActionRailContext {
  admissionHasAssignedBed: boolean;
  admissionIsActive: boolean;
  canCreateTransfer: boolean;
  canDischarge: boolean;
  canManageDeathRecords: boolean;
  canOrder: boolean;
}

interface IpdActionRailActionDefinition {
  id: IpdActionRailActionId;
  label: string;
  requiredPermissions: readonly string[];
  activatesAfter: readonly ClinicalEventName[];
  section: IpdActionRailSection;
}

export interface ResolvedIpdActionRailAction extends IpdActionRailActionDefinition {
  disabledReasonText: string | null;
  enabled: boolean;
}

const ADMISSION_CREATED: readonly ClinicalEventName[] = ["ipd.admission.created"];
const ADMISSION_WITH_BED: readonly ClinicalEventName[] = ["ipd.admission.created", "bed.assigned"];

export const IPD_ACTION_RAIL_ACTIONS: readonly IpdActionRailActionDefinition[] = [
  {
    activatesAfter: ADMISSION_WITH_BED,
    id: "order_medicines",
    label: "Order medicines",
    requiredPermissions: [P.ORDER_BASKET.SIGN],
    section: "orders",
  },
  {
    activatesAfter: ADMISSION_WITH_BED,
    id: "order_lab",
    label: "Order lab tests",
    requiredPermissions: [P.ORDER_BASKET.SIGN],
    section: "orders",
  },
  {
    activatesAfter: ADMISSION_WITH_BED,
    id: "order_imaging",
    label: "Order imaging",
    requiredPermissions: [P.ORDER_BASKET.SIGN],
    section: "orders",
  },
  {
    activatesAfter: ADMISSION_CREATED,
    id: "refer_out",
    label: "Refer or transfer the patient out",
    requiredPermissions: [P.IPD.TRANSFERS_CREATE],
    section: "admission",
  },
  {
    activatesAfter: ADMISSION_CREATED,
    id: "dama_lama",
    label: "Start DAMA / LAMA discharge workflow",
    requiredPermissions: [P.IPD.DISCHARGE_CREATE],
    section: "admission",
  },
  {
    activatesAfter: ADMISSION_CREATED,
    id: "mark_death",
    label: "Create death record and mark the admission",
    requiredPermissions: [P.IPD.DEATH_RECORDS_MANAGE],
    section: "admission",
  },
];

function permissionAllowed(action: IpdActionRailActionId, context: IpdActionRailContext): boolean {
  switch (action) {
    case "order_medicines":
    case "order_lab":
    case "order_imaging":
      return context.canOrder;
    case "refer_out":
      return context.canCreateTransfer;
    case "dama_lama":
      return context.canDischarge;
    case "mark_death":
      return context.canManageDeathRecords;
  }
}

function permissionReason(definition: IpdActionRailActionDefinition): string {
  return `Requires ${definition.requiredPermissions.join(" + ")}`;
}

function stateReason(
  definition: IpdActionRailActionDefinition,
  context: IpdActionRailContext,
): string | null {
  if (!context.admissionIsActive) {
    return `${definition.label} needs an active admission`;
  }

  if (definition.section === "orders" && !context.admissionHasAssignedBed) {
    return "Assign a bed before inpatient orders";
  }

  return null;
}

export function resolveIpdActionRailActions(
  context: IpdActionRailContext,
): readonly ResolvedIpdActionRailAction[] {
  return IPD_ACTION_RAIL_ACTIONS.map((definition) => {
    const hasPermission = permissionAllowed(definition.id, context);
    const blockedByState = stateReason(definition, context);
    const enabled = hasPermission && blockedByState === null;

    return {
      activatesAfter: definition.activatesAfter,
      disabledReasonText: hasPermission ? blockedByState : permissionReason(definition),
      enabled,
      id: definition.id,
      label: definition.label,
      requiredPermissions: definition.requiredPermissions,
      section: definition.section,
    };
  });
}

export function ipdActionRailAction(
  actions: readonly ResolvedIpdActionRailAction[],
  id: IpdActionRailActionId,
): ResolvedIpdActionRailAction {
  const action = actions.find((candidate) => candidate.id === id);
  if (!action) {
    throw new Error(`Missing IPD action rail definition: ${id}`);
  }
  return action;
}

export function ipdWorkspaceTabForOrderBasket(
  tab: IpdOrderBasketTab,
): "prescriptions" | "investigations" {
  return tab === "drug" ? "prescriptions" : "investigations";
}

export function ipdActionRailSectionsForTab(tab: string): readonly IpdActionRailSection[] {
  switch (tab) {
    case "prescriptions":
    case "investigations":
    case "mar":
      return ["orders", "handoffs"];
    case "billing-tab":
    case "insurance-pa":
      return ["finance", "handoffs"];
    case "clinical-docs":
    case "checklist":
    case "mlc-tab":
      return ["mrd", "handoffs"];
    case "discharge-summary":
    case "discharge":
    case "discharge-tat":
    case "death-summary":
    case "birth-records":
      return ["discharge", "admission", "handoffs"];
    case "transfer":
    case "attenders":
    case "diet-tab":
    case "consents-tab":
      return ["admission", "handoffs"];
    default:
      return ["handoffs", "admission"];
  }
}

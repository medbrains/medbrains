import type {
  Admission,
  ClinicalEventName,
  InvestigationsResponse,
  Invoice,
  InvoiceStatus,
  IpdDischargeSummary,
  MrdCaseSheetPacket,
  PharmacyOrder,
  PrescriptionWithItems,
  WorkflowSignalShape,
  WorkflowSignalTone,
} from "@medbrains/types";
import { hasReviewedPatientPharmacyPrescriptionForJourney, P } from "@medbrains/types";

export type IpdActionRailSection =
  | "handoffs"
  | "orders"
  | "mrd"
  | "admission"
  | "finance"
  | "discharge";

export const IPD_ACTION_RAIL_SECTIONS: readonly IpdActionRailSection[] = [
  "handoffs",
  "orders",
  "mrd",
  "admission",
  "finance",
  "discharge",
];

export type IpdOrderBasketTab = "drug" | "lab" | "radiology";

export type IpdActionRailActionId =
  | "order_medicines"
  | "order_lab"
  | "order_imaging"
  | "open_patient_ledger"
  | "generate_mrd_case_sheet"
  | "open_mrd_packet"
  | "print_wristband"
  | "refer_out"
  | "dama_lama"
  | "mark_death"
  | "create_discharge_summary"
  | "discharge_patient"
  | "view_discharge_tat";

export type IpdActionRailBlocker = "activation" | "permission" | "state" | null;
export type IpdActionRailSignalPhase =
  | "blocked_by_permission"
  | "blocked_by_state"
  | "ready"
  | "waiting_for_event";
export type IpdActionRailSignalShape = Extract<WorkflowSignalShape, "diamond" | "pill" | "token">;
export type IpdActionRailSignalTone = Extract<WorkflowSignalTone, "blocked" | "ready" | "risk">;

export interface IpdActionRailSignal {
  phase: IpdActionRailSignalPhase;
  shape: IpdActionRailSignalShape;
  tone: IpdActionRailSignalTone;
}

export interface IpdActionRailContext {
  admissionHasAssignedBed: boolean;
  admissionIsActive: boolean;
  canCreateDischargeSummary: boolean;
  canCreateTransfer: boolean;
  canDischarge: boolean;
  canGenerateMrdCaseSheet: boolean;
  canManageDeathRecords: boolean;
  canOrder: boolean;
  canPrintWristband: boolean;
  canViewBillingLedger: boolean;
  canViewDischargeTat: boolean;
  canViewMrdCaseSheets: boolean;
  completedEvents?: readonly ClinicalEventName[];
  hasMrdCaseSheet: boolean;
}

interface IpdActionRailActionDefinition {
  id: IpdActionRailActionId;
  label: string;
  requiredPermissions: readonly string[];
  activatesAfter: readonly ClinicalEventName[];
  section: IpdActionRailSection;
}

export interface ResolvedIpdActionRailAction extends IpdActionRailActionDefinition {
  blocker: IpdActionRailBlocker;
  disabledReasonKey: string | null;
  disabledReasonText: string | null;
  disabledReasonValues: Readonly<Record<string, string>>;
  enabled: boolean;
  signal: IpdActionRailSignal;
}

export interface IpdActionRailSectionSummary {
  blockedActions: number;
  enabledActions: number;
  focused: boolean;
  section: IpdActionRailSection;
  totalActions: number;
}

export interface IpdWorkspaceNavigationTab {
  section: string;
  value: string;
}

export interface IpdWorkspaceTabReadinessSummary {
  actionSections: readonly IpdActionRailSection[];
  blockedReasons: readonly string[];
  blockedActions: number;
  enabledActions: number;
  primaryBlockedReason: string | null;
  tab: string;
  totalActions: number;
}

const ADMISSION_CREATED: readonly ClinicalEventName[] = ["ipd.admission.created"];
const ADMISSION_WITH_BED: readonly ClinicalEventName[] = ["ipd.admission.created", "bed.assigned"];
const FINALIZED_INVOICE_STATUSES: readonly InvoiceStatus[] = ["issued", "partially_paid", "paid"];
const OPEN_INVOICE_STATUSES: readonly InvoiceStatus[] = ["draft", "issued", "partially_paid"];
const ACTIVE_ADMISSION_ACTIONS = new Set<IpdActionRailActionId>([
  "order_medicines",
  "order_lab",
  "order_imaging",
  "print_wristband",
  "refer_out",
  "dama_lama",
  "mark_death",
  "create_discharge_summary",
  "discharge_patient",
]);

interface IpdJourneyEventSources {
  admission: Admission | null | undefined;
  dischargeSummary: IpdDischargeSummary | null | undefined;
  investigations: InvestigationsResponse | null | undefined;
  invoices: readonly Invoice[];
  mrdCaseSheetPackets: readonly MrdCaseSheetPacket[];
  pharmacyOrders: readonly PharmacyOrder[];
  prescriptions: readonly PrescriptionWithItems[];
}

function parseMoney(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function invoiceHasBalance(invoice: Invoice): boolean {
  return parseMoney(invoice.total_amount) - parseMoney(invoice.paid_amount) > 0.004;
}

function invoiceIsOpen(invoice: Invoice): boolean {
  return OPEN_INVOICE_STATUSES.includes(invoice.status);
}

export function activeIpdInvoiceIdForJourney(invoices: readonly Invoice[]): string | null {
  return (
    invoices.find((invoice) => invoiceIsOpen(invoice) && invoiceHasBalance(invoice))?.id ??
    invoices.find((invoice) => invoiceIsOpen(invoice))?.id ??
    invoices.find((invoice) => invoice.status !== "cancelled" && invoice.status !== "refunded")
      ?.id ??
    null
  );
}

export function activeIpdPharmacyOrderIdForJourney({
  pharmacyOrders,
  prescriptions,
}: {
  pharmacyOrders: readonly PharmacyOrder[];
  prescriptions: readonly PrescriptionWithItems[];
}): string | null {
  return (
    prescriptions.find((prescription) => prescription.pharmacy_order_id)?.pharmacy_order_id ??
    pharmacyOrders.find((order) => order.status === "ordered")?.id ??
    pharmacyOrders.find((order) => order.status === "dispensed")?.id ??
    pharmacyOrders[0]?.id ??
    null
  );
}

export function activeIpdPharmacyRxQueueIdForJourney(
  prescriptions: readonly PrescriptionWithItems[],
): string | null {
  return (
    prescriptions.find(
      (prescription) =>
        !prescription.pharmacy_order_id &&
        prescription.pharmacy_rx_queue_id &&
        prescription.items.some((item) => item.item_status !== "discontinued"),
    )?.pharmacy_rx_queue_id ??
    prescriptions.find(
      (prescription) => !prescription.pharmacy_order_id && prescription.pharmacy_rx_queue_id,
    )?.pharmacy_rx_queue_id ??
    null
  );
}

export function deriveIpdJourneyCompletedEvents({
  admission,
  dischargeSummary,
  investigations,
  invoices,
  mrdCaseSheetPackets,
  pharmacyOrders,
  prescriptions,
}: IpdJourneyEventSources): readonly ClinicalEventName[] {
  const events: ClinicalEventName[] = [];
  const hasOrders =
    prescriptions.length > 0 ||
    pharmacyOrders.length > 0 ||
    (investigations?.lab_orders.length ?? 0) > 0 ||
    (investigations?.radiology_orders.length ?? 0) > 0;

  if (admission) {
    events.push("ipd.admission.created");
  }
  if (admission?.bed_id) {
    events.push("bed.assigned");
  }
  if (admission?.status === "transferred") {
    events.push("bed.transferred");
  }
  if (admission && (admission.status !== "admitted" || admission.discharged_at)) {
    events.push("ipd.discharge.completed");
  }
  if (dischargeSummary) {
    events.push("ipd.discharge.initiated");
  }
  if (hasOrders) {
    events.push("order.created");
  }
  if (hasReviewedPatientPharmacyPrescriptionForJourney(prescriptions)) {
    events.push("pharmacy.prescription.reviewed");
  }
  if (invoices.length > 0) {
    events.push("billing.invoice.created");
  }
  if (invoices.some((invoice) => FINALIZED_INVOICE_STATUSES.includes(invoice.status))) {
    events.push("billing.invoice.finalized");
  }
  if (
    invoices.some(
      (invoice) =>
        invoice.status === "partially_paid" ||
        invoice.status === "paid" ||
        parseMoney(invoice.paid_amount) > 0,
    )
  ) {
    events.push("billing.payment.received");
  }
  if (
    pharmacyOrders.some((order) => order.status === "dispensed") ||
    prescriptions.some(
      (prescription) =>
        prescription.pharmacy_status === "dispensed" ||
        prescription.pharmacy_status === "partially_dispensed",
    )
  ) {
    events.push("pharmacy.order.dispensed");
  }
  if (dischargeSummary?.status === "finalized" || dischargeSummary?.finalized_at) {
    events.push("ipd.discharge.finalized");
  }
  if (mrdCaseSheetPackets.length > 0) {
    events.push("mrd.case_sheet.generated");
  }
  if (
    mrdCaseSheetPackets.some((packet) => packet.status === "printed" || packet.printed_at !== null)
  ) {
    events.push("mrd.case_sheet.printed");
  }

  return events;
}

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
    id: "open_patient_ledger",
    label: "Open patient billing ledger",
    requiredPermissions: [P.BILLING.INVOICES_LIST],
    section: "finance",
  },
  {
    activatesAfter: ADMISSION_CREATED,
    id: "generate_mrd_case_sheet",
    label: "Generate MRD case-sheet packet",
    requiredPermissions: [P.MRD.CASE_SHEETS_GENERATE],
    section: "mrd",
  },
  {
    activatesAfter: ["mrd.case_sheet.generated"],
    id: "open_mrd_packet",
    label: "Open MRD case-sheet packet",
    requiredPermissions: [P.MRD.CASE_SHEETS_VIEW],
    section: "mrd",
  },
  {
    activatesAfter: ADMISSION_CREATED,
    id: "print_wristband",
    label: "Print patient wristband",
    requiredPermissions: [P.IPD.WRISTBAND_PRINT],
    section: "admission",
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
  {
    activatesAfter: ADMISSION_CREATED,
    id: "create_discharge_summary",
    label: "Create discharge summary",
    requiredPermissions: [P.IPD.DISCHARGE_SUMMARY_CREATE],
    section: "discharge",
  },
  {
    activatesAfter: ADMISSION_CREATED,
    id: "discharge_patient",
    label: "Complete discharge workflow",
    requiredPermissions: [P.IPD.DISCHARGE_CREATE],
    section: "discharge",
  },
  {
    activatesAfter: ADMISSION_CREATED,
    id: "view_discharge_tat",
    label: "View discharge TAT",
    requiredPermissions: [P.IPD.DISCHARGE_TAT_VIEW],
    section: "discharge",
  },
];

function permissionAllowed(action: IpdActionRailActionId, context: IpdActionRailContext): boolean {
  switch (action) {
    case "order_medicines":
    case "order_lab":
    case "order_imaging":
      return context.canOrder;
    case "open_patient_ledger":
      return context.canViewBillingLedger;
    case "generate_mrd_case_sheet":
      return context.canGenerateMrdCaseSheet;
    case "open_mrd_packet":
      return context.canViewMrdCaseSheets;
    case "print_wristband":
      return context.canPrintWristband;
    case "refer_out":
      return context.canCreateTransfer;
    case "dama_lama":
      return context.canDischarge;
    case "mark_death":
      return context.canManageDeathRecords;
    case "create_discharge_summary":
      return context.canCreateDischargeSummary;
    case "discharge_patient":
      return context.canDischarge;
    case "view_discharge_tat":
      return context.canViewDischargeTat;
  }
}

function permissionReason(definition: IpdActionRailActionDefinition): string {
  return `Requires ${definition.requiredPermissions.join(" + ")}`;
}

function permissionReasonValues(
  definition: IpdActionRailActionDefinition,
): Readonly<Record<string, string>> {
  return { permissions: definition.requiredPermissions.join(" + ") };
}

function stateReasonText(
  definition: IpdActionRailActionDefinition,
  context: IpdActionRailContext,
): string | null {
  if (ACTIVE_ADMISSION_ACTIONS.has(definition.id) && !context.admissionIsActive) {
    return `${definition.label} needs an active admission`;
  }

  if (definition.section === "orders" && !context.admissionHasAssignedBed) {
    return "Assign a bed before inpatient orders";
  }

  if (definition.id === "open_mrd_packet" && !context.hasMrdCaseSheet) {
    return "Generate an MRD case-sheet packet before opening it";
  }

  return null;
}

function stateReasonKey(
  definition: IpdActionRailActionDefinition,
  context: IpdActionRailContext,
): string | null {
  if (ACTIVE_ADMISSION_ACTIONS.has(definition.id) && !context.admissionIsActive) {
    return "actionRail.reason.activeAdmission";
  }

  if (definition.section === "orders" && !context.admissionHasAssignedBed) {
    return "actionRail.reason.assignBedBeforeOrders";
  }

  if (definition.id === "open_mrd_packet" && !context.hasMrdCaseSheet) {
    return "actionRail.reason.generateMrdBeforeOpen";
  }

  return null;
}

function actionRailCompletedEvents(context: IpdActionRailContext): ReadonlySet<ClinicalEventName> {
  const events = new Set<ClinicalEventName>(context.completedEvents ?? []);
  events.add("ipd.admission.created");

  if (context.admissionHasAssignedBed) {
    events.add("bed.assigned");
  }
  if (!context.admissionIsActive) {
    events.add("ipd.discharge.completed");
  }
  if (context.hasMrdCaseSheet) {
    events.add("mrd.case_sheet.generated");
  }

  return events;
}

function activationReason(
  definition: IpdActionRailActionDefinition,
  completedEvents: ReadonlySet<ClinicalEventName>,
): string | null {
  if (definition.activatesAfter.some((eventName) => completedEvents.has(eventName))) {
    return null;
  }

  return `Available after ${definition.activatesAfter
    .map((eventName) => eventName.replace(/\./g, " "))
    .join(" or ")}`;
}

function activationReasonValues(
  definition: IpdActionRailActionDefinition,
): Readonly<Record<string, string>> {
  return {
    events: definition.activatesAfter
      .map((eventName) => eventName.replace(/\./g, " "))
      .join(" or "),
  };
}

export function ipdActionRailSignal(blocker: IpdActionRailBlocker): IpdActionRailSignal {
  switch (blocker) {
    case "activation":
      return {
        phase: "waiting_for_event",
        shape: "token",
        tone: "blocked",
      };
    case "permission":
      return {
        phase: "blocked_by_permission",
        shape: "diamond",
        tone: "risk",
      };
    case "state":
      return {
        phase: "blocked_by_state",
        shape: "diamond",
        tone: "blocked",
      };
    case null:
      return {
        phase: "ready",
        shape: "pill",
        tone: "ready",
      };
  }
}

export function resolveIpdActionRailActions(
  context: IpdActionRailContext,
): readonly ResolvedIpdActionRailAction[] {
  const completedEvents = actionRailCompletedEvents(context);

  return IPD_ACTION_RAIL_ACTIONS.map((definition) => {
    const hasPermission = permissionAllowed(definition.id, context);
    const blockedByState = stateReasonText(definition, context);
    const blockedByStateKey = stateReasonKey(definition, context);
    const blockedByActivation = activationReason(definition, completedEvents);
    const enabled = hasPermission && blockedByState === null && blockedByActivation === null;
    const blocker: IpdActionRailBlocker = !hasPermission
      ? "permission"
      : blockedByState
        ? "state"
        : blockedByActivation
          ? "activation"
          : null;
    const disabledReasonKey = !hasPermission
      ? "actionRail.reason.permission"
      : (blockedByStateKey ?? (blockedByActivation ? "actionRail.reason.availableAfter" : null));

    return {
      activatesAfter: definition.activatesAfter,
      blocker,
      disabledReasonKey,
      disabledReasonText: hasPermission
        ? (blockedByState ?? blockedByActivation)
        : permissionReason(definition),
      disabledReasonValues: !hasPermission
        ? permissionReasonValues(definition)
        : blockedByActivation
          ? activationReasonValues(definition)
          : {},
      enabled,
      id: definition.id,
      label: definition.label,
      requiredPermissions: definition.requiredPermissions,
      section: definition.section,
      signal: ipdActionRailSignal(blocker),
    };
  });
}

export function summarizeIpdActionRailSections(
  actions: readonly ResolvedIpdActionRailAction[],
  focusedSections: readonly IpdActionRailSection[],
): readonly IpdActionRailSectionSummary[] {
  const focused = new Set(focusedSections);

  return IPD_ACTION_RAIL_SECTIONS.map((section) => {
    const sectionActions = actions.filter((action) => action.section === section);
    const enabledActions = sectionActions.filter((action) => action.enabled).length;

    return {
      blockedActions: sectionActions.length - enabledActions,
      enabledActions,
      focused: focused.has(section),
      section,
      totalActions: sectionActions.length,
    };
  });
}

export function summarizeIpdWorkspaceTabReadiness(
  tabs: readonly IpdWorkspaceNavigationTab[],
  sectionSummaries: readonly IpdActionRailSectionSummary[],
  actions: readonly ResolvedIpdActionRailAction[] = [],
): readonly IpdWorkspaceTabReadinessSummary[] {
  const summaryBySection = new Map(
    sectionSummaries.map((summary) => [summary.section, summary] as const),
  );

  return tabs.map((tab) => {
    const actionSections = ipdActionRailSectionsForTab(tab.value);
    const actionSectionSet = new Set(actionSections);
    const summaries = actionSections
      .map((section) => summaryBySection.get(section))
      .filter((summary): summary is IpdActionRailSectionSummary => Boolean(summary));
    const blockedReasons = [
      ...new Set(
        actions
          .filter(
            (action) =>
              actionSectionSet.has(action.section) &&
              !action.enabled &&
              action.disabledReasonText !== null,
          )
          .map((action) => action.disabledReasonText)
          .filter((reason): reason is string => Boolean(reason)),
      ),
    ];

    return {
      actionSections,
      blockedReasons,
      blockedActions: summaries.reduce((sum, summary) => sum + summary.blockedActions, 0),
      enabledActions: summaries.reduce((sum, summary) => sum + summary.enabledActions, 0),
      primaryBlockedReason: blockedReasons[0] ?? null,
      tab: tab.value,
      totalActions: summaries.reduce((sum, summary) => sum + summary.totalActions, 0),
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

export function ipdOrderBasketTabFromSearchParams(
  searchParams: URLSearchParams,
): IpdOrderBasketTab | null {
  const value = searchParams.get("order");
  if (value === "drug" || value === "lab" || value === "radiology") return value;
  return null;
}

export function ipdAdmissionWorkspaceTabRoute(admissionId: string, tab: string): string {
  return `/ipd/admissions/${admissionId}#${tab}`;
}

export function ipdAdmissionOrderBasketRoute(admissionId: string, tab: IpdOrderBasketTab): string {
  return `/ipd/admissions/${admissionId}?order=${tab}#${ipdWorkspaceTabForOrderBasket(tab)}`;
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

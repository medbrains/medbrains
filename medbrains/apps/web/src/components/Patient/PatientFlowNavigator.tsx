import { Badge, Button, Group, Stack, Text, Tooltip } from "@mantine/core";
import { usePermissionStore } from "@medbrains/stores";
import type {
  ClinicalJourneyActionId,
  ClinicalJourneyContext,
  ClinicalOrderContext,
  ResolvedClinicalJourneyAction,
} from "@medbrains/types";
import { P, resolveClinicalJourneyActions } from "@medbrains/types";
import {
  IconBed,
  IconBuildingStore,
  IconCash,
  IconFileInvoice,
  IconFirstAidKit,
  IconPill,
  IconStethoscope,
  IconUser,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import styles from "./patient-flow-navigator.module.scss";

export type PatientFlowModule =
  | "patient"
  | "opd"
  | "ipd"
  | "emergency"
  | "camp"
  | "pharmacy"
  | "billing";

interface PatientFlowNavigatorProps {
  patientId: string | null | undefined;
  active: PatientFlowModule;
  activeEncounterId?: string | null;
  activeAdmissionId?: string | null;
  activeAdmissionStatus?: string | null;
  activeEmergencyVisitId?: string | null;
  activeOrderContext?: ClinicalOrderContext | null;
  isDeceased?: boolean;
  compact?: boolean;
}

interface FlowItem {
  id: PatientFlowModule;
  label: string;
  description: string;
  href: string;
  color: string;
  icon: ReactNode;
  enabled: boolean;
  disabledReason: string | null;
  activationEvents: readonly string[];
  emittedEvent: string | null;
  requiredPermissions: readonly string[];
}

const OPD_FLOW_ACTION = "opd.open_visit" satisfies ClinicalJourneyActionId;
const EMERGENCY_FLOW_ACTION = "emergency.open_visit" satisfies ClinicalJourneyActionId;
const CAMP_FLOW_ACTION = "camp.open_context" satisfies ClinicalJourneyActionId;
const PHARMACY_FLOW_ACTION = "pharmacy.open_patient_queue" satisfies ClinicalJourneyActionId;
const BILLING_FLOW_ACTION = "billing.open_ledger" satisfies ClinicalJourneyActionId;

function resolvedActionMap(actions: ResolvedClinicalJourneyAction[]) {
  return new Map(actions.map((action) => [action.id, action]));
}

function itemState(
  action: ResolvedClinicalJourneyAction | undefined,
  fallbackEnabled: boolean,
  fallbackReason = "Permission required",
  fallbackActivationEvents: readonly string[] = [],
  fallbackPermissions: readonly string[] = [],
) {
  if (!action) {
    return {
      enabled: fallbackEnabled,
      disabledReason: fallbackEnabled ? null : fallbackReason,
      activationEvents: fallbackActivationEvents,
      emittedEvent: null,
      requiredPermissions: fallbackPermissions,
    };
  }

  return {
    enabled: action.enabled,
    disabledReason: action.enabled ? null : action.disabledReasonText,
    activationEvents: action.activatesAfter,
    emittedEvent: action.emitsEvent ?? null,
    requiredPermissions: action.requiredPermissions,
  };
}

function eventLabel(eventName: string) {
  return eventName.replace(/\./g, " ");
}

function FlowTooltip({ item }: { item: FlowItem }) {
  return (
    <Stack gap={5}>
      <Text size="xs" fw={700}>
        {item.enabled ? item.description : item.disabledReason}
      </Text>
      <Group gap={4}>
        {item.activationEvents.length > 0 ? (
          item.activationEvents.map((eventName) => (
            <Badge key={eventName} size="xs" color="blue" variant="light">
              after {eventLabel(eventName)}
            </Badge>
          ))
        ) : (
          <Badge size="xs" color="gray" variant="light">
            always
          </Badge>
        )}
      </Group>
      {item.emittedEvent && (
        <Badge size="xs" color="green" variant="light">
          emits {eventLabel(item.emittedEvent)}
        </Badge>
      )}
      {item.requiredPermissions.length > 0 && (
        <Text size="xs" c="dimmed">
          Permission: {item.requiredPermissions.join(" / ")}
        </Text>
      )}
    </Stack>
  );
}

export function PatientFlowNavigator({
  patientId,
  active,
  activeEncounterId,
  activeAdmissionId,
  activeAdmissionStatus,
  activeEmergencyVisitId,
  activeOrderContext,
  isDeceased = false,
  compact = false,
}: PatientFlowNavigatorProps) {
  const navigate = useNavigate();
  const hasPermission = usePermissionStore((state) => state.hasPermission);

  if (!patientId) return null;

  const context: ClinicalJourneyContext = {
    patientId,
    isDeceased,
    activeEncounterId,
    activeAdmissionId,
    activeEmergencyVisitId,
    activeAdmissionStatus: activeAdmissionStatus ?? (activeAdmissionId ? "admitted" : null),
    activeOrderContext:
      activeOrderContext ?? (activeEncounterId ? "opd" : activeAdmissionId ? "ipd" : null),
  };
  const actions = resolvedActionMap(resolveClinicalJourneyActions(context, hasPermission, "web"));
  const patientState = itemState(
    undefined,
    hasPermission(P.PATIENTS.VIEW),
    "Permission required",
    ["patient.created"],
    [P.PATIENTS.VIEW],
  );
  const opdState = itemState(
    actions.get(OPD_FLOW_ACTION),
    hasPermission(P.OPD.VISIT_CREATE),
    "Permission required",
    ["patient.created"],
    [P.OPD.VISIT_CREATE],
  );
  const ipdAction = actions.get(activeAdmissionId ? "ipd.open_admission" : "ipd.admit");
  const ipdState = itemState(
    ipdAction,
    activeAdmissionId
      ? hasPermission(P.IPD.ADMISSIONS_VIEW)
      : hasPermission(P.IPD.ADMISSIONS_CREATE),
    "Permission required",
    activeAdmissionId ? ["bed.assigned"] : ["patient.created"],
    activeAdmissionId ? [P.IPD.ADMISSIONS_VIEW] : [P.IPD.ADMISSIONS_CREATE],
  );
  const emergencyState = itemState(
    actions.get(EMERGENCY_FLOW_ACTION),
    hasPermission(P.EMERGENCY.VISITS_CREATE),
    "Permission required",
    ["patient.created"],
    [P.EMERGENCY.VISITS_CREATE],
  );
  const campAllowed =
    hasPermission(P.CAMP.LIST) ||
    hasPermission(P.CAMP.REGISTRATIONS_LIST) ||
    hasPermission(P.CAMP.REGISTRATIONS_CREATE);
  const campState = itemState(
    actions.get(CAMP_FLOW_ACTION),
    campAllowed,
    "Permission required",
    ["patient.created", "camp.registration.created", "camp.screening.completed"],
    [P.CAMP.LIST, P.CAMP.REGISTRATIONS_LIST, P.CAMP.REGISTRATIONS_CREATE],
  );
  const pharmacyState = itemState(
    actions.get(PHARMACY_FLOW_ACTION),
    hasPermission(P.PHARMACY.PRESCRIPTIONS_LIST),
    "Permission required",
    ["order.created", "pharmacy.order.dispensed"],
    [P.PHARMACY.PRESCRIPTIONS_LIST],
  );
  const billingState = itemState(
    actions.get(BILLING_FLOW_ACTION),
    hasPermission(P.BILLING.INVOICES_LIST),
    "Permission required",
    ["patient.created", "order.created", "billing.invoice.created"],
    [P.BILLING.INVOICES_LIST],
  );

  const items: FlowItem[] = [
    {
      id: "patient",
      label: "Patient",
      description: "Open patient registration and longitudinal record.",
      href: `/patients/${patientId}#overview`,
      color: "primary",
      icon: <IconUser size={14} />,
      enabled: patientState.enabled,
      disabledReason: patientState.disabledReason,
      activationEvents: patientState.activationEvents,
      emittedEvent: patientState.emittedEvent,
      requiredPermissions: patientState.requiredPermissions,
    },
    {
      id: "opd",
      label: "OPD",
      description: activeEncounterId ? "Open active OPD encounter." : "Start an OPD visit.",
      href: activeEncounterId
        ? `/opd/encounters/${activeEncounterId}#consultation`
        : `/opd/new?patient_id=${patientId}`,
      color: "teal",
      icon: <IconStethoscope size={14} />,
      enabled: opdState.enabled,
      disabledReason: opdState.disabledReason,
      activationEvents: opdState.activationEvents,
      emittedEvent: opdState.emittedEvent,
      requiredPermissions: opdState.requiredPermissions,
    },
    {
      id: "ipd",
      label: "IPD",
      description: activeAdmissionId ? "Open active IPD admission." : "Start an IPD admission.",
      href: activeAdmissionId
        ? `/ipd/admissions/${activeAdmissionId}#overview`
        : `/ipd/new?patient_id=${patientId}`,
      color: "indigo",
      icon: <IconBed size={14} />,
      enabled: ipdState.enabled,
      disabledReason: ipdState.disabledReason,
      activationEvents: ipdState.activationEvents,
      emittedEvent: ipdState.emittedEvent,
      requiredPermissions: ipdState.requiredPermissions,
    },
    {
      id: "emergency",
      label: "ER",
      description: activeEmergencyVisitId ? "Open emergency visit." : "Register emergency visit.",
      href: activeEmergencyVisitId
        ? `/emergency/visits/${activeEmergencyVisitId}`
        : `/emergency/visits/new?patient_id=${patientId}`,
      color: "red",
      icon: <IconFirstAidKit size={14} />,
      enabled: emergencyState.enabled,
      disabledReason: emergencyState.disabledReason,
      activationEvents: emergencyState.activationEvents,
      emittedEvent: emergencyState.emittedEvent,
      requiredPermissions: emergencyState.requiredPermissions,
    },
    {
      id: "camp",
      label: "Camp",
      description: "Open camp registration and screening workspace.",
      href: `/camp?patient_id=${patientId}`,
      color: "green",
      icon: <IconBuildingStore size={14} />,
      enabled: campState.enabled,
      disabledReason: campState.disabledReason,
      activationEvents: campState.activationEvents,
      emittedEvent: campState.emittedEvent,
      requiredPermissions: campState.requiredPermissions,
    },
    {
      id: "pharmacy",
      label: "Pharmacy",
      description: "Open patient pharmacy orders and dispensing queue.",
      href: `/pharmacy?tab=orders&patient_id=${patientId}`,
      color: "lime",
      icon: <IconPill size={14} />,
      enabled: pharmacyState.enabled,
      disabledReason: pharmacyState.disabledReason,
      activationEvents: pharmacyState.activationEvents,
      emittedEvent: pharmacyState.emittedEvent,
      requiredPermissions: pharmacyState.requiredPermissions,
    },
    {
      id: "billing",
      label: "Billing",
      description: "Open patient billing ledger and invoice queue.",
      href: `/billing?tab=invoices&patient_id=${patientId}`,
      color: "orange",
      icon: <IconFileInvoice size={14} />,
      enabled: billingState.enabled,
      disabledReason: billingState.disabledReason,
      activationEvents: billingState.activationEvents,
      emittedEvent: billingState.emittedEvent,
      requiredPermissions: billingState.requiredPermissions,
    },
  ];

  return (
    <div className={styles.wrapper} data-compact={compact || undefined}>
      <Group justify="space-between" gap="xs" align="center" className={styles.header}>
        <Group gap={6}>
          <IconCash size={14} />
          <Text size="xs" fw={700}>
            Patient Flow
          </Text>
        </Group>
        <Badge size="xs" color="blue" variant="light">
          event activated
        </Badge>
      </Group>
      <Group gap="xs" wrap="wrap">
        {items.map((item) => {
          const isActive = item.id === active;
          const button = (
            <Button
              key={item.id}
              size="xs"
              radius="xl"
              color={item.color}
              variant={isActive ? "filled" : "light"}
              leftSection={item.icon}
              disabled={!item.enabled}
              onClick={() => navigate(item.href)}
            >
              {item.label}
            </Button>
          );
          return (
            <Tooltip key={item.id} label={<FlowTooltip item={item} />} multiline w={280}>
              <span>{button}</span>
            </Tooltip>
          );
        })}
      </Group>
    </div>
  );
}

import { Button, Group, Text, Tooltip } from "@mantine/core";
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
}

const OPD_FLOW_ACTION = "opd.open_visit" satisfies ClinicalJourneyActionId;
const EMERGENCY_FLOW_ACTION = "emergency.open_visit" satisfies ClinicalJourneyActionId;
const PHARMACY_FLOW_ACTION = "pharmacy.open_patient_queue" satisfies ClinicalJourneyActionId;
const BILLING_FLOW_ACTION = "billing.open_ledger" satisfies ClinicalJourneyActionId;

function resolvedActionMap(actions: ResolvedClinicalJourneyAction[]) {
  return new Map(actions.map((action) => [action.id, action]));
}

function itemState(
  action: ResolvedClinicalJourneyAction | undefined,
  fallbackEnabled: boolean,
  fallbackReason = "Permission required",
) {
  if (!action) {
    return {
      enabled: fallbackEnabled,
      disabledReason: fallbackEnabled ? null : fallbackReason,
    };
  }

  return {
    enabled: action.enabled,
    disabledReason: action.enabled ? null : action.disabledReasonText,
  };
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
    activeAdmissionStatus: activeAdmissionStatus ?? (activeAdmissionId ? "admitted" : null),
    activeOrderContext:
      activeOrderContext ?? (activeEncounterId ? "opd" : activeAdmissionId ? "ipd" : null),
  };
  const actions = resolvedActionMap(resolveClinicalJourneyActions(context, hasPermission, "web"));
  const patientState = itemState(undefined, hasPermission(P.PATIENTS.VIEW));
  const opdState = itemState(actions.get(OPD_FLOW_ACTION), hasPermission(P.OPD.VISIT_CREATE));
  const ipdAction = actions.get(activeAdmissionId ? "ipd.open_admission" : "ipd.admit");
  const ipdState = itemState(
    ipdAction,
    activeAdmissionId
      ? hasPermission(P.IPD.ADMISSIONS_VIEW)
      : hasPermission(P.IPD.ADMISSIONS_CREATE),
  );
  const emergencyState = itemState(
    actions.get(EMERGENCY_FLOW_ACTION),
    hasPermission(P.EMERGENCY.VISITS_CREATE),
  );
  const campAllowed =
    hasPermission(P.CAMP.LIST) ||
    hasPermission(P.CAMP.REGISTRATIONS_LIST) ||
    hasPermission(P.CAMP.REGISTRATIONS_CREATE);
  const campState = {
    enabled: campAllowed && !isDeceased,
    disabledReason: !campAllowed
      ? "Permission required"
      : isDeceased
        ? "Unavailable for deceased patient records"
        : null,
  };
  const pharmacyState = itemState(
    actions.get(PHARMACY_FLOW_ACTION),
    hasPermission(P.PHARMACY.PRESCRIPTIONS_LIST),
  );
  const billingState = itemState(
    actions.get(BILLING_FLOW_ACTION),
    hasPermission(P.BILLING.INVOICES_LIST),
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
            <Tooltip
              key={item.id}
              label={item.enabled ? item.description : item.disabledReason}
              multiline
              w={220}
            >
              <span>{button}</span>
            </Tooltip>
          );
        })}
      </Group>
    </div>
  );
}

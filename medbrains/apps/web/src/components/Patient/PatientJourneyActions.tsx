import { ActionIcon, Button, Group, Tooltip } from "@mantine/core";
import { usePermissionStore } from "@medbrains/stores";
import type {
  ClinicalJourneyActionId,
  ClinicalJourneyActionIntent,
  ClinicalJourneyContext,
  ResolvedClinicalJourneyAction,
} from "@medbrains/types";
import { resolveClinicalJourneyActions } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBed,
  IconEdit,
  IconFileInvoice,
  IconFlask,
  IconPill,
  IconPrinter,
  IconRadioactive,
  IconShare,
  IconStethoscope,
} from "@tabler/icons-react";
import { useNavigate } from "react-router";

type PatientOrderTab = "drug" | "lab" | "radiology";

interface PatientJourneyActionsProps {
  context: ClinicalJourneyContext;
  onEdit: () => void;
  onOpenOrderBasket: (tab: PatientOrderTab) => void;
  onShare: () => void;
  onPrintPatientCard: () => void;
}

const ORDER_TABS: Partial<Record<ClinicalJourneyActionId, PatientOrderTab>> = {
  "orders.medication": "drug",
  "orders.lab": "lab",
  "orders.radiology": "radiology",
};

function actionIcon(actionId: ClinicalJourneyActionId) {
  switch (actionId) {
    case "patient.edit":
      return <IconEdit size={14} />;
    case "opd.open_visit":
      return <IconStethoscope size={14} />;
    case "orders.medication":
      return <IconPill size={14} />;
    case "orders.lab":
      return <IconFlask size={14} />;
    case "orders.radiology":
      return <IconRadioactive size={14} />;
    case "ipd.open_admission":
    case "ipd.admit":
      return <IconBed size={14} />;
    case "emergency.open_visit":
      return <IconAlertTriangle size={14} />;
    case "billing.open_ledger":
      return <IconFileInvoice size={14} />;
    case "patient.share":
      return <IconShare size={14} />;
    case "patient.print_card":
      return <IconPrinter size={16} />;
    case "pharmacy.open_patient_queue":
      return <IconPill size={14} />;
  }
}

function actionColor(intent: ClinicalJourneyActionIntent) {
  switch (intent) {
    case "primary":
      return "primary";
    case "clinical":
      return "teal";
    case "finance":
      return "orange";
    case "warning":
      return "warning";
    case "danger":
      return "danger";
    case "secondary":
      return "slate";
  }
}

function actionVariant(intent: ClinicalJourneyActionIntent) {
  return intent === "primary" ? "filled" : "light";
}

export function PatientJourneyActions({
  context,
  onEdit,
  onOpenOrderBasket,
  onShare,
  onPrintPatientCard,
}: PatientJourneyActionsProps) {
  const navigate = useNavigate();
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const actions = resolveClinicalJourneyActions(context, hasPermission, "web");

  function handleAction(actionId: ClinicalJourneyActionId) {
    switch (actionId) {
      case "patient.edit":
        onEdit();
        return;
      case "opd.open_visit":
        navigate(
          context.activeEncounterId
            ? `/opd/encounters/${context.activeEncounterId}#consultation`
            : `/opd/new?patient_id=${context.patientId}`,
        );
        return;
      case "orders.medication":
      case "orders.lab":
      case "orders.radiology": {
        if (context.activeOrderContext === "ipd" && context.activeAdmissionId) {
          navigate(`/ipd/admissions/${context.activeAdmissionId}#overview`);
          return;
        }
        const tab = ORDER_TABS[actionId];
        if (tab) {
          onOpenOrderBasket(tab);
        }
        return;
      }
      case "ipd.open_admission":
        if (context.activeAdmissionId) {
          navigate(`/ipd/admissions/${context.activeAdmissionId}#overview`);
        }
        return;
      case "ipd.admit":
        navigate(`/ipd/new?patient_id=${context.patientId}`);
        return;
      case "emergency.open_visit":
        navigate(`/emergency/visits/new?patient_id=${context.patientId}`);
        return;
      case "billing.open_ledger":
        navigate(`/billing?tab=invoices&patient_id=${context.patientId}`);
        return;
      case "pharmacy.open_patient_queue":
        navigate(`/pharmacy?tab=orders&patient_id=${context.patientId}`);
        return;
      case "patient.share":
        onShare();
        return;
      case "patient.print_card":
        onPrintPatientCard();
        return;
    }
  }

  return (
    <Group gap="xs" wrap="wrap">
      {actions.map((action) => (
        <PatientJourneyActionButton
          key={action.id}
          action={action}
          onClick={() => handleAction(action.id)}
        />
      ))}
    </Group>
  );
}

function PatientJourneyActionButton({
  action,
  onClick,
}: {
  action: ResolvedClinicalJourneyAction;
  onClick: () => void;
}) {
  const disabled = !action.enabled;
  const tooltip = disabled ? action.disabledReasonText : action.description;

  if (action.id === "patient.print_card") {
    const icon = (
      <ActionIcon
        variant="light"
        color={actionColor(action.intent)}
        onClick={onClick}
        disabled={disabled}
        aria-label={action.label}
      >
        {actionIcon(action.id)}
      </ActionIcon>
    );
    return tooltip ? (
      <Tooltip label={tooltip}>
        <span>{icon}</span>
      </Tooltip>
    ) : (
      icon
    );
  }

  const button = (
    <Button
      variant={actionVariant(action.intent)}
      color={actionColor(action.intent)}
      size="sm"
      leftSection={actionIcon(action.id)}
      onClick={onClick}
      disabled={disabled}
    >
      {action.shortLabel}
    </Button>
  );

  return tooltip ? (
    <Tooltip label={tooltip} multiline w={260}>
      <span>{button}</span>
    </Tooltip>
  ) : (
    button
  );
}

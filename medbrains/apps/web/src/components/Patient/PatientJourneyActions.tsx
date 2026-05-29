import { ActionIcon, Badge, Button, Group, Stack, Text, Tooltip } from "@mantine/core";
import { usePermissionStore } from "@medbrains/stores";
import type {
  ClinicalJourneyActionId,
  ClinicalJourneyActionIntent,
  ClinicalJourneyContext,
  ClinicalOrderContext,
  ResolvedClinicalJourneyAction,
} from "@medbrains/types";
import { resolveClinicalJourneyActions } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBed,
  IconBuildingStore,
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
import { useClinicalEventStore } from "@/components/clinical-event-store";
import { mergeJourneyEventNames } from "./patient-journey-events";

type PatientOrderTab = "drug" | "lab" | "radiology";
type PatientJourneyActionSize = "xs" | "sm";

interface PatientJourneyActionsProps {
  context: ClinicalJourneyContext;
  localOrderContext?: ClinicalOrderContext;
  hiddenActionIds?: readonly ClinicalJourneyActionId[];
  size?: PatientJourneyActionSize;
  onEdit?: () => void;
  onOpenOrderBasket?: (tab: PatientOrderTab) => void;
  onShare?: () => void;
  onPrintPatientCard?: () => void;
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
    case "camp.open_context":
      return <IconBuildingStore size={14} />;
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

function supportsAction(
  actionId: ClinicalJourneyActionId,
  handlers: Pick<
    PatientJourneyActionsProps,
    "onOpenOrderBasket" | "onPrintPatientCard" | "onShare"
  >,
) {
  switch (actionId) {
    case "patient.share":
      return Boolean(handlers.onShare);
    case "patient.print_card":
      return Boolean(handlers.onPrintPatientCard);
    case "orders.medication":
    case "orders.lab":
    case "orders.radiology":
      return Boolean(handlers.onOpenOrderBasket);
    default:
      return true;
  }
}

function eventLabel(eventName: string) {
  return eventName.replace(/\./g, " ");
}

function ActionTooltip({ action }: { action: ResolvedClinicalJourneyAction }) {
  return (
    <Stack gap={5}>
      <Text size="xs" fw={700}>
        {action.enabled ? action.description : action.disabledReasonText}
      </Text>
      <Group gap={4}>
        {action.activatesAfter.map((eventName) => (
          <Badge key={eventName} size="xs" color="blue" variant="light">
            after {eventLabel(eventName)}
          </Badge>
        ))}
      </Group>
      {action.emitsEvent && (
        <Badge size="xs" color="green" variant="light">
          emits {eventLabel(action.emitsEvent)}
        </Badge>
      )}
      <Text size="xs" c="dimmed">
        Permission: {action.requiredPermissions.join(" / ")}
      </Text>
    </Stack>
  );
}

export function PatientJourneyActions({
  context,
  localOrderContext,
  hiddenActionIds = [],
  size = "sm",
  onEdit,
  onOpenOrderBasket,
  onShare,
  onPrintPatientCard,
}: PatientJourneyActionsProps) {
  const navigate = useNavigate();
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const recentEvents = useClinicalEventStore((state) => state.recentEvents);
  const journeyContext: ClinicalJourneyContext = {
    ...context,
    completedEvents: mergeJourneyEventNames(context, recentEvents),
  };
  const hiddenActions = new Set(hiddenActionIds);
  const actions = resolveClinicalJourneyActions(journeyContext, hasPermission, "web").filter(
    (action) =>
      !hiddenActions.has(action.id) &&
      supportsAction(action.id, { onOpenOrderBasket, onPrintPatientCard, onShare }),
  );

  function handleAction(actionId: ClinicalJourneyActionId) {
    switch (actionId) {
      case "patient.edit":
        if (onEdit) {
          onEdit();
          return;
        }
        navigate(`/patients/${journeyContext.patientId}/edit`);
        return;
      case "opd.open_visit":
        navigate(
          journeyContext.activeEncounterId
            ? `/opd/encounters/${journeyContext.activeEncounterId}#consultation`
            : `/opd/new?patient_id=${journeyContext.patientId}`,
        );
        return;
      case "orders.medication":
      case "orders.lab":
      case "orders.radiology": {
        const tab = ORDER_TABS[actionId];
        if (tab && onOpenOrderBasket && journeyContext.activeOrderContext === localOrderContext) {
          onOpenOrderBasket(tab);
          return;
        }
        if (journeyContext.activeOrderContext === "ipd" && journeyContext.activeAdmissionId) {
          navigate(`/ipd/admissions/${journeyContext.activeAdmissionId}#overview`);
          return;
        }
        if (tab) {
          onOpenOrderBasket?.(tab);
        }
        return;
      }
      case "ipd.open_admission":
        if (journeyContext.activeAdmissionId) {
          navigate(`/ipd/admissions/${journeyContext.activeAdmissionId}#overview`);
        }
        return;
      case "ipd.admit":
        navigate(`/ipd/new?patient_id=${journeyContext.patientId}`);
        return;
      case "emergency.open_visit":
        navigate(
          journeyContext.activeEmergencyVisitId
            ? `/emergency/visits/${journeyContext.activeEmergencyVisitId}`
            : `/emergency/visits/new?patient_id=${journeyContext.patientId}`,
        );
        return;
      case "camp.open_context":
        navigate(`/camp?patient_id=${journeyContext.patientId}`);
        return;
      case "billing.open_ledger":
        navigate(`/billing?tab=invoices&patient_id=${journeyContext.patientId}`);
        return;
      case "pharmacy.open_patient_queue":
        navigate(`/pharmacy?tab=orders&patient_id=${journeyContext.patientId}`);
        return;
      case "patient.share":
        onShare?.();
        return;
      case "patient.print_card":
        onPrintPatientCard?.();
        return;
    }
  }

  return (
    <Group gap="xs" wrap="wrap">
      {actions.map((action) => (
        <PatientJourneyActionButton
          key={action.id}
          action={action}
          size={size}
          onClick={() => handleAction(action.id)}
        />
      ))}
    </Group>
  );
}

function PatientJourneyActionButton({
  action,
  size,
  onClick,
}: {
  action: ResolvedClinicalJourneyAction;
  size: PatientJourneyActionSize;
  onClick: () => void;
}) {
  const disabled = !action.enabled;
  const tooltip = <ActionTooltip action={action} />;

  if (action.id === "patient.print_card") {
    const icon = (
      <ActionIcon
        variant="light"
        color={actionColor(action.intent)}
        size={size}
        onClick={onClick}
        disabled={disabled}
        aria-label={action.label}
      >
        {actionIcon(action.id)}
      </ActionIcon>
    );
    return (
      <Tooltip label={tooltip} multiline w={280}>
        <span>{icon}</span>
      </Tooltip>
    );
  }

  const button = (
    <Button
      variant={actionVariant(action.intent)}
      color={actionColor(action.intent)}
      size={size}
      leftSection={actionIcon(action.id)}
      onClick={onClick}
      disabled={disabled}
    >
      {action.shortLabel}
    </Button>
  );

  return (
    <Tooltip label={tooltip} multiline w={280}>
      <span>{button}</span>
    </Tooltip>
  );
}

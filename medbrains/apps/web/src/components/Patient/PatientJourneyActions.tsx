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
import styles from "./patient-journey-actions.module.scss";
import { mergeJourneyEventNames } from "./patient-journey-events";
import { patientJourneyActionRoute } from "./patient-journey-routes";

type PatientOrderTab = "drug" | "lab" | "radiology";
type PatientJourneyActionSize = "xs" | "sm";
type PatientJourneyActionLayout = "inline" | "rail";

interface PatientJourneyActionsProps {
  context: ClinicalJourneyContext;
  localOrderContext?: ClinicalOrderContext;
  hiddenActionIds?: readonly ClinicalJourneyActionId[];
  size?: PatientJourneyActionSize;
  layout?: PatientJourneyActionLayout;
  showUnavailable?: boolean;
  emptyLabel?: string;
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
    case "billing.prepare_discharge_bill":
    case "billing.collect_payment":
      return <IconFileInvoice size={14} />;
    case "pharmacy.dispense_order":
      return <IconPill size={14} />;
    case "ipd.open_admission":
    case "ipd.admit":
      return <IconBed size={14} />;
    case "emergency.open_visit":
      return <IconAlertTriangle size={14} />;
    case "emergency.open_mlc":
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
    case "mrd.open_case_sheet":
      return <IconPrinter size={14} />;
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
  context: ClinicalJourneyContext,
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
      return (
        Boolean(handlers.onOpenOrderBasket) || patientJourneyActionRoute(actionId, context) !== null
      );
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
  layout = "inline",
  showUnavailable,
  emptyLabel = "No available handoffs",
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
  const includePermissionDenied = showUnavailable ?? layout === "rail";
  const actions = resolveClinicalJourneyActions(journeyContext, hasPermission, "web", {
    includePermissionDenied,
  }).filter(
    (action) =>
      !hiddenActions.has(action.id) &&
      supportsAction(action.id, journeyContext, {
        onOpenOrderBasket,
        onPrintPatientCard,
        onShare,
      }),
  );

  function handleAction(actionId: ClinicalJourneyActionId) {
    if (actionId === "patient.edit" && onEdit) {
      onEdit();
      return;
    }

    if (actionId === "patient.share") {
      onShare?.();
      return;
    }

    if (actionId === "patient.print_card") {
      onPrintPatientCard?.();
      return;
    }

    switch (actionId) {
      case "orders.medication":
      case "orders.lab":
      case "orders.radiology": {
        const tab = ORDER_TABS[actionId];
        if (tab && onOpenOrderBasket && journeyContext.activeOrderContext === localOrderContext) {
          onOpenOrderBasket(tab);
          return;
        }
        const route = patientJourneyActionRoute(actionId, journeyContext);
        if (route) {
          navigate(route);
          return;
        }
        if (tab) {
          onOpenOrderBasket?.(tab);
        }
        return;
      }
      default: {
        const route = patientJourneyActionRoute(actionId, journeyContext);
        if (route) navigate(route);
      }
    }
  }

  if (layout === "rail") {
    if (actions.length === 0) {
      return (
        <Text size="xs" c="dimmed" className={styles.emptyState}>
          {emptyLabel}
        </Text>
      );
    }

    return (
      <Stack gap={6} className={styles.railActions}>
        {actions.map((action) => (
          <PatientJourneyActionButton
            key={action.id}
            action={action}
            size={size}
            layout={layout}
            onClick={() => handleAction(action.id)}
          />
        ))}
      </Stack>
    );
  }

  return (
    <Group gap="xs" wrap="wrap">
      {actions.map((action) => (
        <PatientJourneyActionButton
          key={action.id}
          action={action}
          size={size}
          layout={layout}
          onClick={() => handleAction(action.id)}
        />
      ))}
    </Group>
  );
}

function PatientJourneyActionButton({
  action,
  size,
  layout,
  onClick,
}: {
  action: ResolvedClinicalJourneyAction;
  size: PatientJourneyActionSize;
  layout: PatientJourneyActionLayout;
  onClick: () => void;
}) {
  const disabled = !action.enabled;
  const tooltip = <ActionTooltip action={action} />;

  if (layout === "rail") {
    const metaText = action.enabled
      ? action.activatesAfter.length > 0
        ? `After ${action.activatesAfter.map(eventLabel).join(" or ")}`
        : "Available"
      : action.disabledReasonText;
    const button = (
      <Button
        variant={actionVariant(action.intent)}
        color={actionColor(action.intent)}
        size={size}
        leftSection={actionIcon(action.id)}
        onClick={onClick}
        disabled={disabled}
        fullWidth
        className={styles.railButton}
      >
        {action.label}
      </Button>
    );

    return (
      <Tooltip label={tooltip} multiline w={280}>
        <Stack gap={3} className={styles.railItem} data-disabled={disabled || undefined}>
          {button}
          {metaText && (
            <Text
              size="xs"
              className={styles.railMeta}
              data-disabled={disabled || undefined}
              title={metaText}
            >
              {metaText}
            </Text>
          )}
        </Stack>
      </Tooltip>
    );
  }

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

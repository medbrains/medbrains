import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Menu,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { usePermissionStore } from "@medbrains/stores";
import type {
  ClinicalJourneyActionId,
  ClinicalJourneyActionIntent,
  ClinicalJourneyActionReadinessSummary,
  ClinicalJourneyBlockedReason,
  ClinicalJourneyContext,
  ClinicalOrderContext,
  ResolvedClinicalJourneyAction,
} from "@medbrains/types";
import {
  patientJourneyActionRoute,
  resolveClinicalJourneyActions,
  summarizeClinicalJourneyActions,
} from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBed,
  IconBuildingStore,
  IconChevronDown,
  IconEdit,
  IconFileInvoice,
  IconFlask,
  IconPill,
  IconPrinter,
  IconRadioactive,
  IconShare,
  IconStethoscope,
} from "@tabler/icons-react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useClinicalEventStore } from "@/components/clinical-event-store";
import styles from "./patient-journey-actions.module.scss";
import { mergeJourneyEventNames } from "./patient-journey-events";
import {
  clinicalEventLabel,
  journeyActionDescription,
  journeyActionDisabledReason,
  journeyActionLabel,
  journeyActionShortLabel,
  journeyBlockedReasonLabel,
} from "./patient-journey-i18n";

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

function blockedReasonColor(reason: ClinicalJourneyBlockedReason | null) {
  switch (reason) {
    case "configuration":
      return "grape";
    case "context":
      return "orange";
    case "event":
      return "blue";
    case "masking":
      return "violet";
    case "permission":
      return "red";
    case "regulatory":
      return "yellow";
    default:
      return "gray";
  }
}

function ActionTooltip({ action, t }: { action: ResolvedClinicalJourneyAction; t: TFunction }) {
  const blockedLabel = journeyBlockedReasonLabel(t, action.blockedReason);

  return (
    <Stack gap={5}>
      <Text size="xs" fw={700}>
        {action.enabled
          ? journeyActionDescription(t, action.id)
          : journeyActionDisabledReason(t, action)}
      </Text>
      {blockedLabel && (
        <Badge size="xs" color={blockedReasonColor(action.blockedReason)} variant="light">
          {t("patientJourney.tooltip.blockedBy", { reason: blockedLabel })}
        </Badge>
      )}
      <Group gap={4}>
        {action.activatesAfter.map((eventName) => (
          <Badge key={eventName} size="xs" color="blue" variant="light">
            {t("patientJourney.badges.afterEvent", {
              event: clinicalEventLabel(t, eventName),
            })}
          </Badge>
        ))}
      </Group>
      {action.emitsEvent && (
        <Badge size="xs" color="green" variant="light">
          {t("patientJourney.badges.emitsEvent", {
            event: clinicalEventLabel(t, action.emitsEvent),
          })}
        </Badge>
      )}
      <Text size="xs" c="dimmed">
        {t("patientJourney.tooltip.permissions", {
          permissions: action.requiredPermissions.join(" / "),
        })}
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
  emptyLabel,
  onEdit,
  onOpenOrderBasket,
  onShare,
  onPrintPatientCard,
}: PatientJourneyActionsProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("clinical");
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
  const readinessSummary = summarizeClinicalJourneyActions(actions);

  // In inline layout (directory tables), hide disabled actions to keep rows compact.
  // Rail layout always shows all resolved actions with their state.
  const visibleActions =
    layout === "inline" && !showUnavailable ? actions.filter((a) => a.enabled) : actions;

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
          {emptyLabel ?? t("patientJourney.emptyState")}
        </Text>
      );
    }

    return (
      <Stack gap={6} className={styles.railActions}>
        <JourneyReadinessSummary summary={readinessSummary} t={t} />
        {actions.map((action) => (
          <PatientJourneyActionButton
            key={action.id}
            action={action}
            size={size}
            layout={layout}
            t={t}
            onClick={() => handleAction(action.id)}
          />
        ))}
      </Stack>
    );
  }

  if (visibleActions.length === 0) {
    return emptyLabel !== undefined ? (
      <Text size="xs" c="dimmed">
        {emptyLabel}
      </Text>
    ) : null;
  }

  // Directory rows: one compact blue "Actions" button opening a keyboard-
  // accessible menu (Mantine Menu = arrow keys / Enter / Esc, ARIA built-in),
  // instead of a stack of colour-coded buttons.
  const actionsLabel = t("patientJourney.actionsButton", { defaultValue: "Actions" });
  return (
    <Menu position="bottom-end" withinPortal shadow="md" width={280}>
      <Menu.Target>
        <Button
          variant="filled"
          color="blue"
          size={size}
          rightSection={<IconChevronDown size={14} />}
          aria-label={actionsLabel}
        >
          {actionsLabel}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{actionsLabel}</Menu.Label>
        <SimpleGrid cols={3} spacing={4} p={4} w={264}>
          {visibleActions.map((action) => (
            <Menu.Item
              key={action.id}
              onClick={() => handleAction(action.id)}
              disabled={!action.enabled}
              style={{ height: 76 }}
            >
              <Stack gap={4} align="center" justify="center">
                {actionIcon(action.id)}
                <Text size="xs" ta="center" lineClamp={2}>
                  {journeyActionLabel(t, action.id)}
                </Text>
              </Stack>
            </Menu.Item>
          ))}
        </SimpleGrid>
      </Menu.Dropdown>
    </Menu>
  );
}

function JourneyReadinessSummary({
  summary,
  t,
}: {
  summary: ClinicalJourneyActionReadinessSummary;
  t: TFunction;
}) {
  return (
    <Group gap={4} wrap="wrap" className={styles.railSummary}>
      <Badge size="xs" color="green" variant="light">
        {t("patientJourney.summary.ready", {
          enabled: summary.enabled,
          total: summary.total,
        })}
      </Badge>
      {summary.blocked > 0 && (
        <Badge size="xs" color="orange" variant="light">
          {t("patientJourney.summary.blocked", { count: summary.blocked })}
        </Badge>
      )}
      {summary.permissionBlocked > 0 && (
        <Badge size="xs" color="red" variant="light">
          {t("patientJourney.summary.permission", { count: summary.permissionBlocked })}
        </Badge>
      )}
      {summary.eventBlocked > 0 && (
        <Badge size="xs" color="blue" variant="light">
          {t("patientJourney.summary.awaitingEvent", { count: summary.eventBlocked })}
        </Badge>
      )}
      {summary.configurationBlocked > 0 && (
        <Badge size="xs" color="grape" variant="light">
          {t("patientJourney.summary.configuration", {
            count: summary.configurationBlocked,
          })}
        </Badge>
      )}
      {summary.maskingBlocked > 0 && (
        <Badge size="xs" color="violet" variant="light">
          {t("patientJourney.summary.masking", { count: summary.maskingBlocked })}
        </Badge>
      )}
      {summary.regulatoryBlocked > 0 && (
        <Badge size="xs" color="yellow" variant="light">
          {t("patientJourney.summary.regulatory", { count: summary.regulatoryBlocked })}
        </Badge>
      )}
    </Group>
  );
}

function PatientJourneyActionButton({
  action,
  size,
  layout,
  t,
  onClick,
}: {
  action: ResolvedClinicalJourneyAction;
  size: PatientJourneyActionSize;
  layout: PatientJourneyActionLayout;
  t: TFunction;
  onClick: () => void;
}) {
  const disabled = !action.enabled;
  const tooltip = <ActionTooltip action={action} t={t} />;

  if (layout === "rail") {
    // Clean button per action — readiness + trigger/permission detail live in
    // the hover tooltip, not a per-row "Ready" badge + meta line.
    return (
      <Tooltip label={tooltip} multiline w={280}>
        <div className={styles.railItem} data-disabled={disabled || undefined}>
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
            {journeyActionLabel(t, action.id)}
          </Button>
        </div>
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
        aria-label={journeyActionLabel(t, action.id)}
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
      {journeyActionShortLabel(t, action.id)}
    </Button>
  );

  return (
    <Tooltip label={tooltip} multiline w={280}>
      <span>{button}</span>
    </Tooltip>
  );
}

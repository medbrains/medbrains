// Ipd action-rail + workspace-tab apparatus — split from ipd.tsx (pure move).

import { Group, Stack, Text, Tooltip } from "@mantine/core";
import type { ClinicalJourneyActionId } from "@medbrains/types";
import { journeyActionSignalLabel } from "@medbrains/types";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { OperationalSignal } from "@/components";
import { Button, type ButtonTone } from "@/components/ui";
import classes from "../ipd.module.scss";
import type {
  IpdActionRailSection,
  IpdActionRailSectionSummary,
  IpdWorkspaceTabReadinessSummary,
  ResolvedIpdActionRailAction,
} from "../ipd-workspace";

type IpdTranslate = ReturnType<typeof useTranslation>["t"];

export const IPD_WORKSPACE_TABS = [
  { value: "overview", label: "Overview", section: "Command" },
  { value: "notes", label: "Progress Notes", section: "Command" },
  { value: "assessments", label: "Clinical", section: "Command" },
  { value: "scores", label: "Scores", section: "Command" },
  { value: "mar", label: "MAR", section: "Command" },
  { value: "prescriptions", label: "Prescriptions", section: "Command" },
  { value: "io", label: "I/O Chart", section: "Command" },
  { value: "infusions", label: "Infusions", section: "Command" },
  { value: "nursing", label: "Nursing", section: "Command" },
  { value: "attenders", label: "Attenders", section: "Care Context" },
  { value: "clinical-docs", label: "Clinical Docs", section: "Care Context" },
  { value: "checklist", label: "Checklist", section: "Care Context" },
  { value: "transfer", label: "Transfer", section: "Care Context" },
  { value: "investigations", label: "Investigations", section: "Care Context" },
  { value: "consumables", label: "Consumables", section: "Care Context" },
  { value: "billing-tab", label: "Billing", section: "Finance & Admin" },
  { value: "insurance-pa", label: "Insurance/PA", section: "Finance & Admin" },
  { value: "mlc-tab", label: "MLC", section: "Finance & Admin" },
  { value: "diet-tab", label: "Diet", section: "Finance & Admin" },
  { value: "consents-tab", label: "Consents", section: "Finance & Admin" },
  { value: "death-summary", label: "Death Summary", section: "Finance & Admin" },
  { value: "birth-records", label: "Birth Records", section: "Finance & Admin" },
  { value: "discharge-summary", label: "Discharge Summary", section: "Discharge" },
  { value: "discharge", label: "Discharge", section: "Discharge" },
  { value: "discharge-tat", label: "Discharge TAT", section: "Discharge" },
] as const;

export const IPD_WORKSPACE_TAB_VALUES = IPD_WORKSPACE_TABS.map((tab) => tab.value);
export const IPD_WORKSPACE_SECTIONS = [
  "Command",
  "Care Context",
  "Finance & Admin",
  "Discharge",
] as const;

export const IPD_ACTION_RAIL_LOCAL_ACTION_IDS = [
  "patient.edit",
  "patient.share",
  "patient.print_card",
  "opd.open_visit",
  "orders.medication",
  "orders.lab",
  "orders.radiology",
  "ipd.open_admission",
  "ipd.admit",
  "emergency.open_visit",
  "mrd.open_case_sheet",
] satisfies ClinicalJourneyActionId[];

export function firstIpdWorkspaceTabForSection(section: (typeof IPD_WORKSPACE_SECTIONS)[number]) {
  return IPD_WORKSPACE_TABS.find((tab) => tab.section === section)?.value ?? "overview";
}

export function ipdWorkspaceSectionLabel(t: IpdTranslate, section: string): string {
  return t(`workspace.sections.${section}`, { defaultValue: section });
}

export function ipdWorkspaceTabLabel(
  t: IpdTranslate,
  tab: (typeof IPD_WORKSPACE_TABS)[number],
): string {
  return t(`workspace.tabs.${tab.value}`, { defaultValue: tab.label });
}

export function actionRailSectionLabel(t: IpdTranslate, section: IpdActionRailSection): string {
  return t(`actionRail.sections.${section}`, { defaultValue: section });
}

function actionRailActionLabel(t: IpdTranslate, action: ResolvedIpdActionRailAction): string {
  return t(`actionRail.actions.${action.id}`, { defaultValue: action.label });
}

function actionRailDisabledReason(
  t: IpdTranslate,
  action: ResolvedIpdActionRailAction,
): string | null {
  if (!action.disabledReasonKey || !action.disabledReasonText) {
    return null;
  }

  return t(action.disabledReasonKey, {
    ...action.disabledReasonValues,
    action: actionRailActionLabel(t, action),
    defaultValue: action.disabledReasonText,
  });
}

function actionRailStatusLabel(t: IpdTranslate, action: ResolvedIpdActionRailAction): string {
  if (action.signal.phase === "blocked_by_state") {
    return journeyActionSignalLabel(t, "blocked_by_context");
  }

  return journeyActionSignalLabel(t, action.signal.phase);
}

export function workspaceReadinessBlockedReason(
  t: IpdTranslate,
  readiness: IpdWorkspaceTabReadinessSummary | undefined,
  actions: readonly ResolvedIpdActionRailAction[],
): string | null {
  if (!readiness?.primaryBlockedReason) {
    return null;
  }

  const blockedAction = actions.find(
    (action) =>
      readiness.actionSections.includes(action.section) &&
      !action.enabled &&
      action.disabledReasonText === readiness.primaryBlockedReason,
  );

  return blockedAction
    ? actionRailDisabledReason(t, blockedAction)
    : readiness.primaryBlockedReason;
}

function actionRailReadinessLabel(
  summary: Pick<IpdActionRailSectionSummary, "enabledActions" | "totalActions"> | undefined,
  t: ReturnType<typeof useTranslation>["t"],
) {
  if (!summary || summary.totalActions === 0) {
    return null;
  }

  return t("actionRail.readySummary", {
    enabled: summary.enabledActions,
    total: summary.totalActions,
  });
}

export function actionRailReadinessBadge(
  summary:
    | Pick<IpdActionRailSectionSummary, "blockedActions" | "enabledActions" | "totalActions">
    | undefined,
  t: ReturnType<typeof useTranslation>["t"],
) {
  const readiness = actionRailReadinessLabel(summary, t);
  if (!readiness) {
    return null;
  }

  return (
    <OperationalSignal
      label={readiness}
      shape={summary?.blockedActions ? "diamond" : "pill"}
      size="xs"
      tone={summary?.blockedActions ? "blocked" : "ready"}
    />
  );
}

export function ActionRailActionButton({
  action,
  children,
  color,
  leftSection,
  loading,
  onClick,
  variant = "light",
}: {
  action: ResolvedIpdActionRailAction;
  children?: ReactNode;
  color?: string;
  leftSection?: ReactNode;
  loading?: boolean;
  onClick: () => void;
  variant?: "filled" | "light" | "subtle";
}) {
  const { t } = useTranslation("ipd");
  const disabledReason = actionRailDisabledReason(t, action);
  const statusLabel = actionRailStatusLabel(t, action);
  const tooltipLabel = disabledReason ?? actionRailActionLabel(t, action);
  const isDanger = color === "danger";
  const tone: ButtonTone =
    variant === "subtle"
      ? "ghost"
      : variant === "filled"
        ? isDanger
          ? "danger"
          : "primary"
        : isDanger
          ? "subtle-danger"
          : "secondary";

  return (
    <Stack gap={3}>
      <Tooltip label={tooltipLabel}>
        <span className={classes.actionRailButtonTarget}>
          <Button
            tone={tone}
            size="xs"
            leftSection={leftSection}
            disabled={!action.enabled}
            loading={loading}
            onClick={onClick}
            fullWidth
          >
            {children ?? actionRailActionLabel(t, action)}
          </Button>
        </span>
      </Tooltip>
      <Group gap={4} wrap="nowrap">
        <OperationalSignal
          label={statusLabel}
          shape={action.signal.shape}
          size="xs"
          tone={action.signal.tone}
        />
        {!action.enabled && disabledReason && (
          <Text size="10px" c="dimmed" lineClamp={2}>
            {disabledReason}
          </Text>
        )}
      </Group>
    </Stack>
  );
}

export function ActionRailSectionHeading({
  summary,
  title,
}: {
  summary: IpdActionRailSectionSummary | undefined;
  title: string;
}) {
  const { t } = useTranslation("ipd");
  const readiness = actionRailReadinessLabel(summary, t);

  return (
    <Group justify="space-between" gap="xs" align="center" wrap="nowrap">
      <Text size="xs" fw={700} c="dimmed" tt="uppercase">
        {title}
      </Text>
      <Group gap={4} wrap="nowrap">
        {summary?.focused && (
          <OperationalSignal label={t("actionRail.focus")} shape="token" size="xs" tone="active" />
        )}
        {readiness && actionRailReadinessBadge(summary, t)}
      </Group>
    </Group>
  );
}

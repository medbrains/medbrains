import {
  Badge,
  Box,
  Button,
  Card,
  Grid,
  Group,
  NavLink,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import { usePermissionStore } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconChartBar,
  IconDeviceTv,
  IconPlug,
  IconSearch,
  IconShieldCheck,
  IconShieldLock,
} from "@tabler/icons-react";
import { createElement, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components";
import { SETTINGS_TAB_ICON_MAP, SETTINGS_TABS } from "@/config/settings-tabs";
import { useHashTabs } from "@/hooks/useHashTabs";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import classes from "./settings.module.scss";

const SETTINGS_GROUP_ORDER = [
  "Start",
  "Hospital Setup",
  "Clinical Setup",
  "Operations",
  "Interoperability",
  "System",
] as const;

type SettingsGroup = (typeof SETTINGS_GROUP_ORDER)[number];

type SettingsNavKind = "overview" | "master" | "configuration" | "rule" | "template" | "support";
type SettingsKindFilter = "all" | "master" | "configuration" | "logic" | "support";

const SETTINGS_KIND_FILTER_OPTIONS: { value: SettingsKindFilter; label: string }[] = [
  { value: "master", label: "Masters & setup" },
  { value: "configuration", label: "Config only" },
  { value: "logic", label: "Rules/templates" },
  { value: "support", label: "Advanced/support" },
  { value: "all", label: "All settings" },
];

const SETTINGS_NAV_META: Record<
  string,
  { group: SettingsGroup; description: string; kind: SettingsNavKind }
> = {
  "master-data": {
    group: "Start",
    description: "Readiness map for all shared masters",
    kind: "overview",
  },
  general: {
    group: "Start",
    description: "Hospital identity and core defaults",
    kind: "configuration",
  },
  "access-matrix": {
    group: "Start",
    description: "Effective role, user, group, and SpiceDB access view",
    kind: "configuration",
  },
  facilities: {
    group: "Hospital Setup",
    description: "Facilities, branches, and shared services",
    kind: "master",
  },
  locations: {
    group: "Hospital Setup",
    description: "Campus, building, floor, room, and bed hierarchy",
    kind: "master",
  },
  departments: {
    group: "Hospital Setup",
    description: "Clinical and administrative departments",
    kind: "master",
  },
  modules: {
    group: "Hospital Setup",
    description: "Tenant module enablement",
    kind: "configuration",
  },
  sequences: {
    group: "Hospital Setup",
    description: "UHID, invoices, orders, and document numbers",
    kind: "master",
  },
  services: {
    group: "Hospital Setup",
    description: "Billable and operational services",
    kind: "master",
  },
  "clinical-masters": {
    group: "Clinical Setup",
    description: "Demographics, relations, occupations, and TPA",
    kind: "master",
  },
  "bed-types": {
    group: "Clinical Setup",
    description: "IPD bed classes used by ward and tariff setup",
    kind: "master",
  },
  billing: {
    group: "Clinical Setup",
    description: "Tax categories and payment methods",
    kind: "master",
  },
  "drug-interactions": {
    group: "Clinical Setup",
    description: "Prescription safety rules",
    kind: "rule",
  },
  "critical-values": {
    group: "Clinical Setup",
    description: "Lab escalation thresholds",
    kind: "rule",
  },
  "clinical-protocols": {
    group: "Clinical Setup",
    description: "Care pathways and clinical decision support",
    kind: "rule",
  },
  "consultation-templates": {
    group: "Clinical Setup",
    description: "OPD note presets and specialty templates",
    kind: "template",
  },
  "clinical-config": {
    group: "Clinical Setup",
    description: "ROS, checklists, and clinical screen defaults",
    kind: "configuration",
  },
  "print-templates": {
    group: "Operations",
    description: "Letterheads, labels, forms, and print layouts",
    kind: "template",
  },
  branding: {
    group: "Operations",
    description: "Logo and visual identity",
    kind: "configuration",
  },
  geo: {
    group: "Operations",
    description: "Country, state, and district defaults",
    kind: "configuration",
  },
  units: {
    group: "Operations",
    description: "Units, locale, timezone, and currency",
    kind: "configuration",
  },
  compliance: {
    group: "Operations",
    description: "Regulatory and privacy toggles",
    kind: "support",
  },
  standards: {
    group: "Interoperability",
    description: "FHIR, ABDM, DICOM, ICD, SNOMED, LOINC readiness",
    kind: "support",
  },
  "device-integrations": {
    group: "Interoperability",
    description: "PACS, lab analyzer, biometric, and print agents",
    kind: "support",
  },
  "offline-mode": {
    group: "Interoperability",
    description: "Edge appliance and offline-tolerant mode",
    kind: "support",
  },
  "system-health": {
    group: "System",
    description: "Completeness, import, export, and health checks",
    kind: "support",
  },
};

const DEFAULT_SETTINGS_META: {
  group: SettingsGroup;
  description: string;
  kind: SettingsNavKind;
} = {
  group: "System",
  description: "Configuration panel",
  kind: "configuration",
};

function settingsTabPermissions(tab: (typeof SETTINGS_TABS)[number]) {
  return [tab.requiredPermission, ...(tab.requiredPermissions ?? [])].filter(
    (permission): permission is string => typeof permission === "string",
  );
}

function settingsMeta(value: string) {
  return SETTINGS_NAV_META[value] ?? DEFAULT_SETTINGS_META;
}

function settingsKindColor(kind: SettingsNavKind) {
  if (kind === "overview") return "blue";
  if (kind === "master") return "teal";
  if (kind === "rule") return "orange";
  if (kind === "template") return "indigo";
  if (kind === "support") return "grape";
  return "gray";
}

function settingsKindLabel(kind: SettingsNavKind) {
  if (kind === "overview") return "Overview";
  if (kind === "master") return "Master";
  if (kind === "rule") return "Rule";
  if (kind === "template") return "Template";
  if (kind === "support") return "Support";
  return "Config";
}

function settingsKindCountLabel(kind: SettingsNavKind) {
  if (kind === "overview") return "overview";
  if (kind === "master") return "masters";
  if (kind === "rule" || kind === "template") return "rules/templates";
  if (kind === "support") return "support";
  return "config";
}

function isSettingsKindFilter(value: string | null): value is SettingsKindFilter {
  return SETTINGS_KIND_FILTER_OPTIONS.some((option) => option.value === value);
}

function settingsKindMatches(kind: SettingsNavKind, filter: SettingsKindFilter) {
  if (filter === "all") return true;
  if (filter === "logic") return kind === "rule" || kind === "template";
  if (filter === "master") return kind === "master" || kind === "overview";
  return kind === filter;
}

function currentHashTab() {
  if (typeof window === "undefined") return "";
  return window.location.hash.replace("#", "").split("--")[0] ?? "";
}

function initialSettingsKindFilter(): SettingsKindFilter {
  const hashTab = currentHashTab();
  if (!hashTab) return "master";
  const kind = settingsMeta(hashTab).kind;
  return kind === "overview" || kind === "master" ? "master" : "all";
}

export function SettingsPage() {
  const { t } = useTranslation("admin");
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const [settingsSearch, setSettingsSearch] = useState("");
  const [settingsKindFilter, setSettingsKindFilter] =
    useState<SettingsKindFilter>(initialSettingsKindFilter);

  const visibleTabs = useMemo(
    () => SETTINGS_TABS.filter((tab) => settingsTabPermissions(tab).some(hasPermission)),
    [hasPermission],
  );

  useRequirePermission(
    visibleTabs[0] ? settingsTabPermissions(visibleTabs[0]) : P.ADMIN.SETTINGS.GENERAL.MANAGE,
  );

  const validValues = useMemo(() => visibleTabs.map((tab) => tab.value), [visibleTabs]);
  const defaultTab =
    visibleTabs.find((visibleTab) => visibleTab.value === "master-data")?.value ??
    visibleTabs[0]?.value ??
    "general";
  const [tab, setTab] = useHashTabs(defaultTab, validValues);
  const activeConfig = visibleTabs.find((cfg) => cfg.value === tab) ?? visibleTabs[0];
  const ActiveComponent = activeConfig?.component;
  const activeMeta = settingsMeta(activeConfig?.value ?? defaultTab);

  const groupedTabs = useMemo(() => {
    const searchText = settingsSearch.trim().toLowerCase();
    const filteredTabs = visibleTabs.filter((cfg) => {
      const meta = settingsMeta(cfg.value);
      if (!settingsKindMatches(meta.kind, settingsKindFilter)) return false;
      if (!searchText) return true;
      return [t(cfg.i18nKey), cfg.value, meta.group, meta.description]
        .join(" ")
        .toLowerCase()
        .includes(searchText);
    });

    return SETTINGS_GROUP_ORDER.map((group) => ({
      group,
      tabs: filteredTabs.filter((cfg) => settingsMeta(cfg.value).group === group),
    })).filter((entry) => entry.tabs.length > 0);
  }, [settingsKindFilter, settingsSearch, t, visibleTabs]);

  const settingsKindCounts = useMemo(() => {
    const counts: Record<SettingsNavKind, number> = {
      overview: 0,
      master: 0,
      configuration: 0,
      rule: 0,
      template: 0,
      support: 0,
    };
    for (const cfg of visibleTabs) {
      counts[settingsMeta(cfg.value).kind] += 1;
    }
    return counts;
  }, [visibleTabs]);

  const hiddenAdvancedCount = visibleTabs.filter(
    (cfg) => !settingsKindMatches(settingsMeta(cfg.value).kind, settingsKindFilter),
  ).length;
  const hasVisibleTab = (value: string) =>
    visibleTabs.some((visibleTab) => visibleTab.value === value);
  const quickLinks = [
    hasVisibleTab("access-matrix")
      ? {
          label: "Access Matrix",
          description: "Role, user, field masking, action and event activation coverage.",
          color: "orange",
          icon: <IconShieldLock size={14} />,
          onClick: () => setTab("access-matrix"),
        }
      : null,
    hasPermission(P.ANALYTICS.VIEW)
      ? {
          label: "Reports",
          description: "Operational reports, KPI workbenches, and source-data readiness.",
          color: "blue",
          href: "/reports",
          icon: <IconChartBar size={14} />,
        }
      : null,
    hasPermission(P.QUALITY.INDICATORS_LIST)
      ? {
          label: "NABH",
          description: "Quality indicators with live and pending evidence coverage.",
          color: "teal",
          href: "/admin/nabh-indicators",
          icon: <IconShieldCheck size={14} />,
        }
      : null,
    hasPermission(P.INTEGRATION.LIST)
      ? {
          label: "Pipelines",
          description: "Code-reviewed event subscribers and cross-module side effects.",
          color: "grape",
          href: "/admin/integration-hub",
          icon: <IconPlug size={14} />,
        }
      : null,
    hasVisibleTab("device-integrations") || hasVisibleTab("offline-mode")
      ? {
          label: "Edge Devices",
          description: "Device agents, TV/kiosk channels, offline and edge runtime settings.",
          color: "indigo",
          icon: <IconDeviceTv size={14} />,
          onClick: () =>
            setTab(hasVisibleTab("device-integrations") ? "device-integrations" : "offline-mode"),
        }
      : null,
  ].filter((link): link is NonNullable<typeof link> => link !== null);

  return (
    <Stack className={classes.settingsWorkspace}>
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <Card withBorder className={classes.settingsCommandBar}>
        <Group justify="space-between" align="flex-start" gap="md">
          <Stack gap={4}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              Configuration command center
            </Text>
            <Group gap="xs">
              <Badge color="teal" variant="light">
                {visibleTabs.length} visible panels
              </Badge>
              <Badge color={settingsKindColor(activeMeta.kind)} variant="light">
                {activeMeta.group} · {settingsKindLabel(activeMeta.kind)}
              </Badge>
              <Badge color="blue" variant="light">
                {settingsKindCounts.master + settingsKindCounts.overview} setup panels
              </Badge>
              <Badge color="orange" variant="light">
                {settingsKindCounts.rule + settingsKindCounts.template} rules/templates
              </Badge>
            </Group>
          </Stack>
          <Group gap="xs" className={classes.commandActions}>
            {quickLinks.map((link) =>
              "href" in link ? (
                <Button
                  key={link.label}
                  component="a"
                  href={link.href}
                  size="xs"
                  variant="light"
                  color={link.color}
                  leftSection={link.icon}
                  title={link.description}
                >
                  {link.label}
                </Button>
              ) : (
                <Button
                  key={link.label}
                  size="xs"
                  variant="light"
                  color={link.color}
                  leftSection={link.icon}
                  title={link.description}
                  onClick={link.onClick}
                >
                  {link.label}
                </Button>
              ),
            )}
          </Group>
        </Group>
      </Card>

      <Grid gap="lg" align="flex-start" className={classes.settingsGrid}>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Card withBorder padding="sm" radius="md" className={classes.settingsNavCard}>
            <Stack gap="sm">
              <TextInput
                aria-label="Find settings"
                placeholder="Find settings"
                leftSection={<IconSearch size={14} />}
                value={settingsSearch}
                onChange={(event) => setSettingsSearch(event.currentTarget.value)}
              />
              <Select
                aria-label="Settings category"
                data={SETTINGS_KIND_FILTER_OPTIONS}
                value={settingsKindFilter}
                onChange={(value) => {
                  if (isSettingsKindFilter(value)) setSettingsKindFilter(value);
                }}
                allowDeselect={false}
                size="xs"
              />
              <Group gap={4}>
                {(
                  ["overview", "master", "configuration", "rule", "template", "support"] as const
                ).map((kind) =>
                  settingsKindCounts[kind] > 0 ? (
                    <Badge key={kind} size="xs" variant="light" color={settingsKindColor(kind)}>
                      {settingsKindCounts[kind]} {settingsKindCountLabel(kind)}
                    </Badge>
                  ) : null,
                )}
              </Group>
              {hiddenAdvancedCount > 0 && settingsKindFilter === "master" && (
                <Text size="xs" c="dimmed">
                  {hiddenAdvancedCount} config/support panels are hidden here. Change category only
                  when you need integrations, health, branding, standards, or offline controls.
                </Text>
              )}

              <ScrollArea.Autosize mah={{ base: 360, md: "calc(100vh - 240px)" }}>
                <Stack gap="md" pr="xs">
                  {groupedTabs.length === 0 ? (
                    <Card withBorder padding="sm" radius="sm">
                      <Text size="sm" c="dimmed">
                        No settings match this search and category.
                      </Text>
                    </Card>
                  ) : (
                    groupedTabs.map((entry) => (
                      <Stack key={entry.group} gap={4}>
                        <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                          {entry.group}
                        </Text>
                        {entry.tabs.map((cfg) => {
                          const Icon = SETTINGS_TAB_ICON_MAP[cfg.icon];
                          const meta = settingsMeta(cfg.value);
                          return (
                            <NavLink
                              key={cfg.value}
                              active={cfg.value === tab}
                              label={t(cfg.i18nKey)}
                              description={meta.description}
                              leftSection={
                                Icon ? (
                                  <ThemeIcon size="sm" variant="light">
                                    {createElement(Icon, { size: 15 })}
                                  </ThemeIcon>
                                ) : undefined
                              }
                              rightSection={
                                <Text
                                  size="10px"
                                  fw={700}
                                  c={settingsKindColor(meta.kind)}
                                  tt="uppercase"
                                >
                                  {settingsKindLabel(meta.kind)}
                                </Text>
                              }
                              onClick={() => setTab(cfg.value)}
                              variant="light"
                              styles={{
                                root: { borderRadius: "var(--mantine-radius-sm)" },
                                description: { lineHeight: 1.2 },
                              }}
                            />
                          );
                        })}
                      </Stack>
                    ))
                  )}
                </Stack>
              </ScrollArea.Autosize>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 9 }}>
          {activeConfig && ActiveComponent ? (
            <Stack gap="md" className={classes.settingsMain}>
              <Group justify="space-between" align="flex-start" className={classes.panelHeading}>
                <Box>
                  <Text size="xl" fw={700}>
                    {t(activeConfig.i18nKey)}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {settingsMeta(activeConfig.value).description}
                  </Text>
                </Box>
                <Badge color={settingsKindColor(activeMeta.kind)} variant="light">
                  {settingsKindLabel(activeMeta.kind)}
                </Badge>
              </Group>
              <ActiveComponent />
            </Stack>
          ) : (
            <Card withBorder padding="lg">
              <Text c="dimmed">No settings available for your current permissions.</Text>
            </Card>
          )}
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

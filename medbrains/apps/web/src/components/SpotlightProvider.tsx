import { Box, Group, Text } from "@mantine/core";
import {
  SpotlightAction,
  SpotlightActionsGroup,
  SpotlightActionsList,
  SpotlightEmpty,
  SpotlightFooter,
  SpotlightRoot,
  SpotlightSearch,
} from "@mantine/spotlight";
import { usePermissionStore } from "@medbrains/stores";
import {
  IconCornerDownLeft,
  IconFileInvoice,
  IconReportMedical,
  IconSearch,
  IconUserPlus,
} from "@tabler/icons-react";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { NAV_GROUPS, type NavItemConfig, resolveIcon } from "../config/navigation";
import styles from "./SpotlightProvider.module.scss";

interface SpotlightEntry {
  id: string;
  label: string;
  description: string;
  path: string;
  icon: ReactNode;
  group: string;
  requiredPermission?: string;
  keywords?: string[];
}

/** Descriptions for nav entries derived from config — keyed by path. */
const NAV_DESCRIPTIONS: Record<string, string> = {
  "/dashboard": "Overview & analytics",
  "/patients": "Patient registry",
  "/opd": "Outpatient department",
  "/lab": "Laboratory orders & results",
  "/pharmacy": "Prescriptions & dispensing",
  "/ipd": "Inpatient department",
  "/billing": "Invoices & payments",
  "/indent": "Inventory & procurement",
  "/admin/users": "Manage system users",
  "/admin/roles": "Manage roles",
  "/admin/settings": "System configuration",
  "/admin/form-builder": "Build custom forms",
  "/admin/dashboard-builder": "Build custom dashboards",
  "/admin/integration-hub": "Pipelines, sidecars, and execution history",
  "/admin/screen-builder": "Build screens and attach sidecars",
};

/** Build navigation entries from nav config. */
function buildNavEntries(t: (key: string) => string): SpotlightEntry[] {
  const entries: SpotlightEntry[] = [];

  function walk(items: NavItemConfig[]) {
    for (const item of items) {
      // For parent items that only serve as group headers (have children), skip the parent itself
      if (item.children) {
        walk(item.children);
        continue;
      }

      entries.push({
        id: `nav-${item.path.replace(/\//g, "-")}`,
        label: t(item.i18nKey),
        description: NAV_DESCRIPTIONS[item.path] ?? "",
        path: item.path,
        icon: resolveIcon(item.icon, 18, 1.5),
        group: "Navigation",
        requiredPermission: item.requiredPermission,
      });
    }
  }

  for (const group of NAV_GROUPS) {
    walk(group.items);
  }

  return entries;
}

/** Quick action entries (action-oriented, not nav duplication). */
const QUICK_ACTIONS: SpotlightEntry[] = [
  {
    id: "action-new-patient",
    label: "Create New Patient",
    description: "Register a new patient",
    path: "/patients",
    icon: <IconUserPlus size={18} stroke={1.5} />,
    group: "Quick Actions",
    requiredPermission: "patients.create",
    keywords: ["register", "add"],
  },
  {
    id: "action-new-opd",
    label: "New OPD Visit",
    description: "Start an outpatient visit",
    path: "/opd",
    icon: <IconReportMedical size={18} stroke={1.5} />,
    group: "Quick Actions",
    requiredPermission: "opd.visit.create",
    keywords: ["visit", "consultation"],
  },
  {
    id: "action-new-invoice",
    label: "Create Invoice",
    description: "New billing invoice",
    path: "/billing",
    icon: <IconFileInvoice size={18} stroke={1.5} />,
    group: "Quick Actions",
    requiredPermission: "billing.invoices.create",
    keywords: ["bill", "charge"],
  },
];

function filterActions(query: string, entries: SpotlightEntry[]): SpotlightEntry[] {
  const q = query.toLowerCase().trim();
  if (!q) return entries;
  return entries.filter((e) => {
    if (e.label.toLowerCase().includes(q)) return true;
    if (e.description.toLowerCase().includes(q)) return true;
    if (e.keywords?.some((k) => k.toLowerCase().includes(q))) return true;
    return false;
  });
}

export function SpotlightProvider() {
  const navigate = useNavigate();
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const [query, setQuery] = useState("");
  const { t } = useTranslation("nav");

  const allEntries = useMemo(() => [...buildNavEntries(t), ...QUICK_ACTIONS], [t]);

  const permittedEntries = useMemo(
    () => allEntries.filter((e) => !e.requiredPermission || hasPermission(e.requiredPermission)),
    [allEntries, hasPermission],
  );

  const filtered = useMemo(() => filterActions(query, permittedEntries), [query, permittedEntries]);

  // Group filtered entries
  const grouped = useMemo(() => {
    const map = new Map<string, SpotlightEntry[]>();
    for (const entry of filtered) {
      const group = map.get(entry.group) ?? [];
      group.push(entry);
      map.set(entry.group, group);
    }
    return map;
  }, [filtered]);

  const handleAction = (path: string) => {
    navigate(path);
  };

  return (
    <SpotlightRoot
      shortcut={["mod+K", "mod+k"]}
      query={query}
      onQueryChange={setQuery}
      clearQueryOnClose
      scrollable
      maxHeight={420}
      size={560}
      classNames={{
        content: styles.content,
        overlay: styles.overlay,
        inner: styles.inner,
      }}
    >
      <SpotlightSearch
        placeholder="Search pages, actions..."
        leftSection={<IconSearch size={18} stroke={1.5} />}
        className={styles.search}
      />

      <SpotlightActionsList>
        {filtered.length === 0 ? (
          <SpotlightEmpty className={styles.empty}>
            No results for &ldquo;{query}&rdquo;
          </SpotlightEmpty>
        ) : (
          [...grouped.entries()].map(([group, entries]) => (
            <SpotlightActionsGroup key={group} label={group} className={styles.actionsGroup}>
              {entries.map((entry) => (
                <SpotlightAction
                  key={entry.id}
                  className={styles.action}
                  onClick={() => handleAction(entry.path)}
                >
                  <Group gap="md" wrap="nowrap" align="center">
                    <Box className={styles.actionIcon}>{entry.icon}</Box>
                    <div>
                      <Text className={styles.actionLabel}>{entry.label}</Text>
                      <Text className={styles.actionDescription}>{entry.description}</Text>
                    </div>
                  </Group>
                </SpotlightAction>
              ))}
            </SpotlightActionsGroup>
          ))
        )}
      </SpotlightActionsList>

      <SpotlightFooter className={styles.footer}>
        <Group gap="lg">
          <span className={styles.footerHint}>
            <span className={styles.footerKbd}>
              <IconCornerDownLeft size={10} />
            </span>
            <Text size="xs" c="dimmed">
              select
            </Text>
          </span>
          <span className={styles.footerHint}>
            <span className={styles.footerKbd}>↑</span>
            <span className={styles.footerKbd}>↓</span>
            <Text size="xs" c="dimmed">
              navigate
            </Text>
          </span>
          <span className={styles.footerHint}>
            <span className={styles.footerKbd}>esc</span>
            <Text size="xs" c="dimmed">
              close
            </Text>
          </span>
        </Group>
      </SpotlightFooter>
    </SpotlightRoot>
  );
}

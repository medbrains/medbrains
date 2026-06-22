import { Box, Tabs, Text } from "@mantine/core";
import type { ReactNode } from "react";
import railStyles from "./WorkspaceRail.module.scss";

export interface RailItem {
  value: string;
  label: string;
  icon: ReactNode;
}

export interface RailGroup {
  label: string;
  items: RailItem[];
}

export interface WorkspaceRailProps {
  /** Grouped nav items. Groups with no items are dropped (permission-gated callers). */
  groups: RailGroup[];
  active: string | null;
  onChange: (value: string | null) => void;
  /** Right-pane content — typically a set of `<Tabs.Panel>` elements. */
  children: ReactNode;
  /** Optional content pinned above the nav (e.g. patient context, alerts). */
  aside?: ReactNode;
  railWidth?: number;
}

/**
 * OPD-style two-pane workspace: a vertical left rail of grouped, icon-labelled
 * tabs and a scrollable right content panel. Wraps Mantine `Tabs`
 * (orientation="vertical"); colour is theme-token driven, layout lives in the
 * SCSS module. Callers build `groups` with permission gating, so an item the
 * user can't access is simply omitted (and an emptied group disappears).
 */
export function WorkspaceRail({
  groups,
  active,
  onChange,
  children,
  aside,
  railWidth = 240,
}: WorkspaceRailProps) {
  const visibleGroups = groups.filter((group) => group.items.length > 0);

  return (
    <Tabs
      value={active}
      onChange={onChange}
      keepMounted={false}
      orientation="vertical"
      classNames={{
        tab: railStyles.railTab,
        tabSection: railStyles.railTabSection,
        tabLabel: railStyles.railTabLabel,
      }}
      className={railStyles.root}
    >
      <Box component="aside" className={railStyles.rail} style={{ width: railWidth }}>
        {aside}
        <Box className={railStyles.railGroups}>
          {visibleGroups.map((group) => (
            <Box key={group.label} className={railStyles.railGroup}>
              <Text className={railStyles.railSectionLabel}>{group.label}</Text>
              <Tabs.List className={railStyles.railList}>
                {group.items.map((item) => (
                  <Tabs.Tab key={item.value} value={item.value} leftSection={item.icon}>
                    {item.label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Box>
          ))}
        </Box>
      </Box>
      <Box className={railStyles.panel}>{children}</Box>
    </Tabs>
  );
}

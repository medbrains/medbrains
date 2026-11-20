import { AppShell, Box, Divider, ScrollArea, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AnimatedIcon } from "@/components/AnimatedIcon";
import { BuildVersion } from "@/components/BuildVersion";
import classes from "./AppLayout.module.scss";

/** Screens shown without the side panel. The launcher replaces navigation (owner, 2026-11-17). */
const PANEL_FREE_PATHS: ReadonlySet<string> = new Set(["/home"]);

/** Whether the screen at `pathname` shows the side panel: every screen but the launcher. */
export function hasSidePanel(pathname: string): boolean {
  return !PANEL_FREE_PATHS.has(pathname);
}

interface AppNavbarProps {
  isExpanded: boolean;
  onToggle: () => void;
  /** The menu itself, which the layout builds from the viewer's permissions. */
  children: ReactNode;
}

/** The side panel: the menu, the collapse control and the build badge. */
export function AppNavbar({ isExpanded, onToggle, children }: AppNavbarProps) {
  return (
    <AppShell.Navbar
      data-testid="app-sidebar"
      data-mode={isExpanded ? "expanded" : "rail"}
      p={isExpanded ? 8 : 0}
      className={isExpanded ? classes.navbarExpanded : classes.navbarRail}
    >
      <AppShell.Section grow component={ScrollArea} className={classes.navContent}>
        {children}
      </AppShell.Section>

      <NavbarFooter isExpanded={isExpanded} onToggle={onToggle} />
    </AppShell.Navbar>
  );
}

/** The panel's foot: collapse or expand, and which build this is. */
function NavbarFooter({ isExpanded, onToggle }: Omit<AppNavbarProps, "children">) {
  const { t } = useTranslation("nav");
  return (
    <AppShell.Section className={classes.navFooter}>
      <Divider my={4} className={classes.railDivider} />

      {/* Collapse / Expand toggle */}
      <Box visibleFrom="sm" className={classes.footerAction}>
        {isExpanded ? (
          <UnstyledButton
            className={classes.sidebarToggleExpanded}
            onClick={onToggle}
            aria-label={t("collapse")}
          >
            <AnimatedIcon icon={IconLayoutSidebarLeftCollapse} size={18} motion="float" />
            <Text size="xs" c="var(--mb-text-muted)">
              {t("collapse")}
            </Text>
          </UnstyledButton>
        ) : (
          <Tooltip label={t("expand")} position="right" withArrow>
            <UnstyledButton
              className={classes.railItem}
              onClick={onToggle}
              aria-label={t("expand")}
            >
              <AnimatedIcon icon={IconLayoutSidebarLeftExpand} size={20} motion="float" />
            </UnstyledButton>
          </Tooltip>
        )}
      </Box>

      {/* Which build is this?
          The badge here read a hardcoded "v0.1" — the same string on
          every deploy since it was written, which is worse than none:
          it answers the support question confidently and wrongly. It now
          carries the real version, the commit the deploy fingerprints,
          and the build date, so a stale cached bundle is visible rather
          than indistinguishable from a current one. Collapsed to the
          rail there is no room for the commit, so only the version
          shows and the tooltip carries the rest. */}
      <Box className={classes.versionBadge}>
        {isExpanded ? (
          <BuildVersion />
        ) : (
          <Tooltip
            label={`v${__APP_VERSION__} · ${__APP_COMMIT__} · built ${new Date(__APP_BUILT__).toLocaleString()}`}
            position="right"
            withArrow
          >
            <Text size="xs" c="var(--mb-text-muted)" fw={400} ta="center">
              v{__APP_VERSION__}
            </Text>
          </Tooltip>
        )}
      </Box>
    </AppShell.Section>
  );
}

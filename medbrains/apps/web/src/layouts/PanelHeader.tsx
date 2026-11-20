import { Box, Divider, Group, NavLink, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { IconLayoutGrid } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import classes from "./AppLayout.module.scss";

interface PanelHeaderProps {
  /** The app's name, or the core panel's. */
  title: string;
  icon: ReactNode;
  isExpanded: boolean;
  /** Closes the phone drawer once the link is followed. */
  onNavigate: () => void;
}

/**
 * The top of the side panel: which app this is, and the way back to every app. Switching apps
 * happens on the launcher, in search or from favourites, so the panel lists one app only.
 */
export function PanelHeader({ title, icon, isExpanded, onNavigate }: PanelHeaderProps) {
  const { t } = useTranslation("nav");
  if (!isExpanded) {
    return (
      <Box className={classes.railGroup}>
        <Tooltip label={`${t("allApps")} (${title})`} position="right" withArrow>
          <UnstyledButton
            component={Link}
            to="/home"
            aria-label={t("allApps")}
            className={classes.railItem}
            onClick={onNavigate}
          >
            <IconLayoutGrid size={20} stroke={1.5} />
          </UnstyledButton>
        </Tooltip>
        <Divider my={4} className={classes.railDivider} />
      </Box>
    );
  }
  return (
    <Box data-testid="panel-header">
      <Group gap="xs" wrap="nowrap" px="xs" py="xs">
        <Box c="var(--mb-brand-emphasis)" aria-hidden>
          {icon}
        </Box>
        <Text component="h2" fw={600} size="sm" truncate="end">
          {title}
        </Text>
      </Group>
      <NavLink
        component={Link}
        to="/home"
        label={t("allApps")}
        leftSection={<IconLayoutGrid size={20} stroke={1.5} />}
        className={classes.expandedItem}
        onClick={onNavigate}
      />
      <Divider my={4} className={classes.railDivider} />
    </Box>
  );
}

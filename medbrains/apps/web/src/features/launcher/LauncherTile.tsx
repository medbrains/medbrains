import { Group, Text, UnstyledButton } from "@mantine/core";
import { IconStarFilled } from "@tabler/icons-react";
import { Link } from "react-router";
import { Card, IconButton, ModuleBadge } from "@/components/ui";
import { getModuleBadge, resolveIcon } from "@/config/navigation";
import styles from "./launcher.module.scss";

interface LauncherTileProps {
  label: string;
  path: string;
  /** Tabler icon name, used when the screen has no module mark. */
  icon: string;
  /** Shown on a favourite: takes the star off. */
  onUnstar?: () => void;
  /** The unstar control's accessible name. */
  unstarLabel?: string;
  /** A star change is in flight: the control waits, so a double click sends one. */
  isUnstarPending?: boolean;
}

/**
 * One launcher tile: the screen's module mark and name, as a link to it.
 * The unstar control sits beside the link, never inside it, so each has its
 * own focus stop and name.
 */
export function LauncherTile(props: LauncherTileProps) {
  const { label, path, icon, onUnstar, unstarLabel, isUnstarPending } = props;
  const badge = getModuleBadge(path);
  return (
    <Card padding={0} pattern={false} className={styles.tile}>
      <Group gap={0} wrap="nowrap" align="stretch">
        <UnstyledButton component={Link} to={path} className={styles.tileLink}>
          <Group gap="sm" wrap="nowrap">
            {badge ? (
              <ModuleBadge abbr={badge.abbr} color={badge.color} size={32} />
            ) : (
              resolveIcon(icon, 32, 1.5)
            )}
            <Text fw={500} lineClamp={2}>
              {label}
            </Text>
          </Group>
        </UnstyledButton>
        {onUnstar && (
          <IconButton
            tone="accent"
            size="xl"
            className={styles.unstar}
            aria-label={unstarLabel ?? label}
            disabled={isUnstarPending}
            onClick={onUnstar}
          >
            <IconStarFilled size={20} />
          </IconButton>
        )}
      </Group>
    </Card>
  );
}

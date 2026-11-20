import { Group, Text, UnstyledButton } from "@mantine/core";
import { IconStarFilled } from "@tabler/icons-react";
import { Link } from "react-router";
import { Card, IconButton } from "@/components/ui";
import styles from "./launcher.module.scss";

interface FavouriteChipProps {
  label: string;
  path: string;
  /** The app the screen belongs to, shown muted after its name. */
  app?: string;
  /** The star's accessible name: it takes the screen off favourites. */
  unstarLabel: string;
  /** A star change is in flight: the star waits, so a double click sends one. */
  isUnstarPending: boolean;
  onUnstar: () => void;
}

/**
 * One favourite as an inline chip: the purple star (which unstars), then the screen's name and
 * its app as a link. Star and link are separate focus stops, each at least 44px high.
 */
export function FavouriteChip(props: FavouriteChipProps) {
  const { label, path, app, unstarLabel, isUnstarPending, onUnstar } = props;
  // "Pharmacy · Pharmacy" says nothing twice: name the app only when it adds something.
  const appLine = app && !app.toLowerCase().startsWith(label.toLowerCase()) ? app : undefined;
  return (
    <Card p={0} pattern={false}>
      <Group gap={0} wrap="nowrap">
        <IconButton
          tone="accent"
          size="xl"
          aria-label={unstarLabel}
          disabled={isUnstarPending}
          onClick={onUnstar}
        >
          <IconStarFilled size={16} />
        </IconButton>
        <UnstyledButton component={Link} to={path} className={styles.chipLink}>
          <Text fw={600} span>
            {label}
          </Text>
          {appLine && (
            <Text c="dimmed" span>
              {appLine}
            </Text>
          )}
        </UnstyledButton>
      </Group>
    </Card>
  );
}

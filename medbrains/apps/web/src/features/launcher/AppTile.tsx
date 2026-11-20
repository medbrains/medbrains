import { Box, Text, UnstyledButton } from "@mantine/core";
import { Link } from "react-router";
import { Card } from "@/components/ui";
import { resolveIcon } from "@/config/navigation";
import styles from "./launcher.module.scss";

interface AppTileProps {
  label: string;
  path: string;
  /** Tabler icon name for the app. */
  icon: string;
}

/** One app as on the board: a 32px icon above its name, the whole tile a link. Nothing else. */
export function AppTile({ label, path, icon }: AppTileProps) {
  return (
    // `p`, not `padding`: the theme's default `p="md"` would otherwise pad round the link.
    <Card p={0} pattern={false}>
      <UnstyledButton component={Link} to={path} className={styles.appLink}>
        <Box c="var(--mb-brand-emphasis)" aria-hidden>
          {resolveIcon(icon, 32, 1.5)}
        </Box>
        <Text fw={600} lineClamp={2}>
          {label}
        </Text>
      </UnstyledButton>
    </Card>
  );
}

import { Button, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import type { ReactNode } from "react";
import styles from "./empty-state.module.scss";

interface EmptyStateProps {
  /** Optional: a table that supplies only a message still renders one. */
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.wrapper}>
      {icon && (
        <div className={styles.iconContainer}>
          <div className={styles.glowCircle} />
          <div className={styles.iconFloat}>
            <ThemeIcon variant="light" color="primary" size={80} radius="xl">
              {icon}
            </ThemeIcon>
          </div>
        </div>
      )}
      <Stack align="center" gap="xs">
        <Title order={4} c="var(--mb-text-secondary)">
          {title}
        </Title>
        {description && (
          <Text size="sm" c="var(--mb-text-muted)" maw={400} ta="center">
            {description}
          </Text>
        )}
        {action && (
          <Button variant="light" onClick={action.onClick} mt="xs">
            {action.label}
          </Button>
        )}
      </Stack>
    </div>
  );
}

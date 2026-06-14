import { Card, Group, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";

export interface PanelProps {
  /** Section title (uppercase eyebrow). */
  title?: ReactNode;
  /** Optional supporting line under the title. */
  description?: ReactNode;
  /** Right-aligned actions in the panel header. */
  actions?: ReactNode;
  /** Remove the card chrome — just the titled section. */
  bare?: boolean;
  children: ReactNode;
}

/**
 * A titled section surface — the standard way to group content with a
 * header. Border-first card by default; `bare` drops the chrome.
 */
export function Panel({ title, description, actions, bare, children }: PanelProps) {
  const header = (title || actions) && (
    <Group justify="space-between" align="flex-start" mb={description ? 2 : "sm"} wrap="nowrap">
      <div>
        {title && (
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">
            {title}
          </Text>
        )}
        {description && (
          <Text size="sm" c="var(--mb-text-secondary)">
            {description}
          </Text>
        )}
      </div>
      {actions && <Group gap="xs">{actions}</Group>}
    </Group>
  );

  if (bare) {
    return (
      <Stack gap="sm">
        {header}
        {children}
      </Stack>
    );
  }

  return (
    <Card withBorder padding="md">
      {header}
      {description && <div style={{ height: 8 }} />}
      {children}
    </Card>
  );
}

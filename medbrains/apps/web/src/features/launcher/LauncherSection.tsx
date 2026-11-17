import { Group, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

interface LauncherSectionProps {
  title: string;
  /** The page's own heading ("Waiting for you") is a level-1 display title; the rest are h2. */
  isPageHeading?: boolean;
  /** One muted line on the right of the heading. */
  aside?: string;
  children: ReactNode;
}

/** A launcher section as on the board: a heading, a muted line beside it, then the content. */
export function LauncherSection({ title, isPageHeading, aside, children }: LauncherSectionProps) {
  return (
    <Stack gap="md" component="section" aria-label={title}>
      <Group justify="space-between" align="baseline" gap="xs">
        {isPageHeading ? (
          <Title order={1} fz="h1" fw={600} ff="var(--mb-font-display)">
            {title}
          </Title>
        ) : (
          <Title order={2} fz="h4" fw={600}>
            {title}
          </Title>
        )}
        {aside && (
          <Text size="sm" c="dimmed">
            {aside}
          </Text>
        )}
      </Group>
      {children}
    </Stack>
  );
}

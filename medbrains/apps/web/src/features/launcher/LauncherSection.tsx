import { Group, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

interface LauncherSectionProps {
  title: string;
  /** One short line on why the section shows what it shows, set in mono beside the title. */
  why?: string;
  children: ReactNode;
}

/** A launcher section: a small eyebrow heading, its reason, then its content. */
export function LauncherSection({ title, why, children }: LauncherSectionProps) {
  return (
    <Stack gap="sm" component="section" aria-label={title}>
      <Group gap="xs" align="baseline">
        <Title order={2} fz="xs" fw={600} tt="uppercase" lts="0.08em" c="dimmed">
          {title}
        </Title>
        {why && (
          <Text span ff="monospace" fz="xs" c="dimmed">
            {why}
          </Text>
        )}
      </Group>
      {children}
    </Stack>
  );
}

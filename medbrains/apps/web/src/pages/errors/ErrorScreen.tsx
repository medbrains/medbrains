import { Center, Group, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { ThemeIcon, type ThemeIconTone } from "@/components/ui";
import styles from "./error-screen.module.scss";

interface ErrorScreenProps {
  /** Short machine-ish label above the title, e.g. "403 · access denied". */
  eyebrow: string;
  title: string;
  description: ReactNode;
  icon: ReactNode;
  tone: ThemeIconTone;
  /** Details between the description and the actions. */
  children?: ReactNode;
  actions: ReactNode;
}

/** The shared frame for the access-denied and not-found screens. */
export function ErrorScreen({
  eyebrow,
  title,
  description,
  icon,
  tone,
  children,
  actions,
}: ErrorScreenProps) {
  return (
    <Center className={styles.screen}>
      <Stack className={styles.body} gap="md" align="flex-start">
        <ThemeIcon tone={tone} variant="light" size={56} aria-hidden="true">
          {icon}
        </ThemeIcon>
        <Text size="xs" ff="monospace" tt="uppercase" c="dimmed" fw={600}>
          {eyebrow}
        </Text>
        <Title order={1} size="h2">
          {title}
        </Title>
        <Text c="dimmed">{description}</Text>
        {children}
        <Group gap="sm">{actions}</Group>
      </Stack>
    </Center>
  );
}

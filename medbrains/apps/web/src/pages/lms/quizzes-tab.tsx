// Lms QuizzesTab — split from lms.tsx (pure move).

import { Stack, Text } from "@mantine/core";
import { IconClipboardCheck } from "@tabler/icons-react";

export function QuizzesTab() {
  return (
    <Stack align="center" py="xl" gap="md">
      <IconClipboardCheck size={48} stroke={1.2} color="var(--mantine-color-gray-5)" />
      <Text c="dimmed" size="lg" fw={500}>
        Select a course to take quizzes
      </Text>
      <Text c="dimmed" size="sm" maw={400} ta="center">
        Navigate to a course from the Course Catalog or My Learning tab, then access its quizzes
        from the course detail view.
      </Text>
    </Stack>
  );
}

// ── Learning Paths Tab ─────────────────────────────────

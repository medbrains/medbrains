// Lms EmptyState — split from lms.tsx (pure move).

import { Text } from "@mantine/core";

export function EmptyState({ message }: { message: string }) {
  return (
    <Text c="dimmed" ta="center" py="xl">
      {message}
    </Text>
  );
}

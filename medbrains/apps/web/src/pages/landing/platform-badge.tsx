// Landing PlatformBadge — split from landing.tsx (pure move).

import { Group } from "@mantine/core";
import { Badge } from "@/components/ui";

export function PlatformBadge({ web, mobile, tv }: { web: string; mobile: string; tv: string }) {
  return (
    <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
      {web === "Y" && (
        <Badge size="xs" variant="dot" tone="primary">
          W
        </Badge>
      )}
      {mobile === "Y" && (
        <Badge size="xs" variant="dot" tone="success">
          M
        </Badge>
      )}
      {tv === "Y" && (
        <Badge size="xs" variant="dot" tone="neutral">
          TV
        </Badge>
      )}
    </Group>
  );
}

import { List, Stack, Text } from "@mantine/core";
import type { FormTemplateVersion } from "@medbrains/types";
import { formatDateTime } from "@/lib/date-utils";

/** Every published version; each record names the one it was taken on. */
export function VersionList({ versions }: { versions: FormTemplateVersion[] }) {
  return (
    <Stack gap={4}>
      <Text fw={600} size="sm">
        Published versions
      </Text>
      {versions.length === 0 ? (
        <Text size="sm" c="dimmed">
          None yet. Until you publish, staff fill in the built-in form (if there is one).
        </Text>
      ) : (
        <List size="sm" aria-label="Published versions">
          {versions.map((v) => (
            <List.Item key={v.id}>
              v{v.version} · {formatDateTime(v.published_at)}
            </List.Item>
          ))}
        </List>
      )}
    </Stack>
  );
}

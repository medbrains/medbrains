import { Anchor, Group, Stack, Text } from "@mantine/core";
import type { HealthNotice } from "@medbrains/types";
import { Badge, Card } from "@/components/ui";
import { formatDate } from "@/lib/date-utils";

interface NoticesCardProps {
  notices: HealthNotice[];
  region: string | null;
  /** A public feed has stopped: an empty list may only mean nothing arrived. */
  hasStoppedFeed: boolean;
}

/** Public outbreak notices: title, source, date and a link — never copied text. */
export function NoticesCard({ notices, region, hasStoppedFeed }: NoticesCardProps) {
  return (
    <Card padding="md" withBorder data-testid="health-intel-notices">
      <Stack gap="sm">
        <Text fw={600}>Public outbreak notices</Text>
        <Text size="sm" c="dimmed">
          The last 30 days, {region ? `${region} and India first` : "India first"}, then the rest of
          the world. Each notice opens at its source.
        </Text>
        {notices.length === 0 && (
          <Text size="sm">
            {hasStoppedFeed
              ? "No notices — but a feed has stopped, so this may be incomplete."
              : "No notices in the last 30 days."}
          </Text>
        )}
        {notices.map((n) => (
          <Stack key={n.id} gap={2}>
            <Anchor href={n.url} target="_blank" rel="noopener noreferrer" fw={600} size="sm">
              {n.title}
            </Anchor>
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                {n.source}
                {n.published_at ? ` · ${formatDate(n.published_at)}` : ""}
              </Text>
              {n.is_local && <Badge tone="info">Your region</Badge>}
              {n.conditions.map((c) => (
                <Badge key={c} tone="neutral">
                  {c}
                </Badge>
              ))}
              {n.regions.map((r) => (
                <Badge key={r} tone="neutral" variant="outline">
                  {r}
                </Badge>
              ))}
            </Group>
            {n.summary && (
              <Text size="sm" lineClamp={2}>
                {n.summary}
              </Text>
            )}
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}

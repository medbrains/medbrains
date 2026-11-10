/** What a change would do, grouped by severity, safety first. */
import { Anchor, Group, List, Stack, Text } from "@mantine/core";
import type { KnowledgeImpactReport } from "@medbrains/types";
import { Link } from "react-router";
import { Badge, Card } from "@/components/ui";
import { groupImpact } from "./diff";
import { SEVERITY } from "./labels";

interface ImpactPanelProps {
  report: KnowledgeImpactReport | null;
  /** The set changed since this report: it no longer describes the change. */
  isStale: boolean;
}

export function ImpactPanel({ report, isStale }: ImpactPanelProps) {
  if (!report) {
    return (
      <Text size="sm" c="dimmed">
        Not previewed yet. Preview to see which patients, orders and results this change affects.
      </Text>
    );
  }
  const groups = groupImpact(report);
  return (
    <Stack gap="sm" aria-label="Impact">
      <Text size="xs" c="dimmed">
        Measured {new Date(report.computed_at).toLocaleString()}
        {isStale ? ", before the live data changed. Preview again." : "."}
      </Text>
      {groups.length === 0 && (
        <Text size="sm">No patients, orders or results are affected by this change.</Text>
      )}
      {groups.map((group) => (
        <Stack key={group.severity} gap="xs">
          <Group gap="xs">
            <Badge tone={SEVERITY[group.severity].tone}>{SEVERITY[group.severity].label}</Badge>
          </Group>
          {group.entries.map((entry) => (
            <Card key={`${entry.relation}-${entry.summary}`} padding="sm" withBorder>
              <Text size="sm" fw={600}>
                {SEVERITY[entry.severity].label}: {entry.summary}
              </Text>
              {entry.truncated && (
                <Text size="xs" c="dimmed">
                  Counted up to the preview's limit; the real number may be higher.
                </Text>
              )}
              {entry.examples.length > 0 && (
                <List size="sm" spacing={2} mt="xs">
                  {entry.examples.map((ex) => (
                    <List.Item key={`${ex.href}-${ex.label}`}>
                      {ex.href ? (
                        <Anchor component={Link} to={ex.href} size="sm">
                          {ex.label}
                        </Anchor>
                      ) : (
                        ex.label
                      )}
                    </List.Item>
                  ))}
                </List>
              )}
              {entry.count > entry.examples.length && (
                <Text size="xs" c="dimmed" mt={4}>
                  Showing {entry.examples.length} of {entry.count.toLocaleString()}.
                </Text>
              )}
            </Card>
          ))}
        </Stack>
      ))}
    </Stack>
  );
}

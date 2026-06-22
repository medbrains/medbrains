import { Card, Group, Stack, Text } from "@mantine/core";
import type { MrdCaseSheetCompletenessResponse } from "@medbrains/types";
import { Badge, type BadgeTone } from "@/components/ui";

function completenessColor(status: string): BadgeTone {
  if (status === "ok") return "success";
  if (status === "missing") return "danger";
  return "warning";
}

export function MrdCompletenessPanel({
  completeness,
  loading,
}: {
  completeness: MrdCaseSheetCompletenessResponse | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card withBorder p="sm">
        <Text size="sm" c="dimmed">
          Checking OPD/IPD/pharmacy/billing linkages...
        </Text>
      </Card>
    );
  }
  if (!completeness) return null;

  const openItems = completeness.items.filter((item) => item.status !== "ok");
  return (
    <Card withBorder p="sm">
      <Group justify="space-between" align="flex-start" mb="sm">
        <Stack gap={2}>
          <Text fw={600}>MRD Completeness</Text>
          <Text size="xs" c="dimmed">
            Current evidence from OPD, IPD, pharmacy, lab, radiology, billing, and consent modules.
          </Text>
        </Stack>
        <Group gap="xs">
          <Badge tone={completeness.missing_total > 0 ? "danger" : "success"}>
            {completeness.completeness_pct}% complete
          </Badge>
          <Badge tone="neutral" variant="outline">
            {completeness.complete_total}/{completeness.required_total} required
          </Badge>
        </Group>
      </Group>
      {openItems.length === 0 ? (
        <Text size="sm" c="dimmed">
          Required case-sheet evidence is complete for this packet.
        </Text>
      ) : (
        <Stack gap={6}>
          {openItems.map((item) => (
            <Group key={item.code} justify="space-between" align="flex-start">
              <Stack gap={0}>
                <Text size="sm" fw={500}>
                  {item.label}
                </Text>
                <Text size="xs" c="dimmed">
                  {item.message}
                </Text>
              </Stack>
              <Group gap={6}>
                <Badge size="xs" tone={completenessColor(item.status)}>
                  {item.status}
                </Badge>
                <Badge size="xs" tone="neutral" variant="outline">
                  {item.source_module}
                </Badge>
              </Group>
            </Group>
          ))}
        </Stack>
      )}
    </Card>
  );
}

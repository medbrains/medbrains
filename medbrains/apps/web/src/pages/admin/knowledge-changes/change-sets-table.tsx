/** Every change set, newest first, with its impact at a glance. */
import { Group, Stack, Text, VisuallyHidden } from "@mantine/core";
import type { KnowledgeChangeSet } from "@medbrains/types";
import { IconChevronRight } from "@tabler/icons-react";
import { Alert, Badge, Button, Card, Table } from "@/components/ui";
import { impactChips } from "./diff";
import { AREA_LABEL, SEVERITY, STATUS } from "./labels";

interface ChangeSetsTableProps {
  sets: KnowledgeChangeSet[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  onOpen: (id: string) => void;
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

export function ChangeSetsTable({ sets, isLoading, error, onRetry, onOpen }: ChangeSetsTableProps) {
  if (error) {
    return (
      <Alert tone="danger" role="alert" title="Knowledge changes could not be loaded">
        <Stack gap="xs" align="flex-start">
          <Text size="sm">{error.message}</Text>
          <Button tone="secondary" size="compact-sm" onClick={onRetry}>
            Try again
          </Button>
        </Stack>
      </Alert>
    );
  }
  if (isLoading) {
    return (
      <Text size="sm" c="dimmed">
        Loading knowledge changes…
      </Text>
    );
  }
  if (!sets || sets.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No changes yet.
      </Text>
    );
  }
  return (
    <Card padding="md" withBorder>
      <Table aria-label="Knowledge changes" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Change</Table.Th>
            <Table.Th>Area</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Drafted by</Table.Th>
            <Table.Th>Approved by</Table.Th>
            <Table.Th>Applied</Table.Th>
            <Table.Th>Impact</Table.Th>
            <Table.Th>
              <VisuallyHidden>Open</VisuallyHidden>
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sets.map((set) => (
            <Table.Tr key={set.id}>
              <Table.Td maw={320}>
                <Text size="sm" fw={500}>
                  {set.title}
                </Text>
                {set.rollback_of_set_id && (
                  <Text size="xs" c="dimmed">
                    Reverses an earlier change
                  </Text>
                )}
              </Table.Td>
              <Table.Td>{AREA_LABEL[set.area]}</Table.Td>
              <Table.Td miw={160}>
                <Badge tone={STATUS[set.status].tone}>{STATUS[set.status].label}</Badge>
              </Table.Td>
              <Table.Td>{set.author_name ?? "—"}</Table.Td>
              <Table.Td>{set.approver_name ?? "—"}</Table.Td>
              <Table.Td>{when(set.applied_at)}</Table.Td>
              <Table.Td>
                <Group gap={4}>
                  {impactChips(set.impact).map((chip) => (
                    <Badge key={chip.severity} tone={SEVERITY[chip.severity].tone} size="sm">
                      {SEVERITY[chip.severity].label} {chip.text}
                    </Badge>
                  ))}
                  {!set.impact && (
                    <Text size="xs" c="dimmed">
                      Not previewed
                    </Text>
                  )}
                </Group>
              </Table.Td>
              <Table.Td>
                <Button
                  tone="ghost"
                  size="compact-sm"
                  rightSection={<IconChevronRight size={16} />}
                  onClick={() => onOpen(set.id)}
                  aria-label={`Open ${set.title}`}
                >
                  Open
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Card>
  );
}

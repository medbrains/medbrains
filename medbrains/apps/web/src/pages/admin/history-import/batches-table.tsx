/** Every batch this hospital has checked or imported, newest first. */
import { Stack, Text } from "@mantine/core";
import type { HistoryImportBatch } from "@medbrains/types";
import { Alert, Badge, Card, Table } from "@/components/ui";
import { KIND_LABEL, STATUS } from "./labels";

interface BatchesTableProps {
  batches: HistoryImportBatch[] | undefined;
  isLoading: boolean;
  error: Error | null;
}

function summary(b: HistoryImportBatch) {
  // A refused batch added nothing; its tallies are only what was checked before the refusal.
  if (b.status === "refused") return "—";
  const parts = b.tallies
    .filter((t) => t.added > 0)
    .map((t) => `${t.added} ${KIND_LABEL[t.kind].toLowerCase()}`);
  if (parts.length === 0) return "—";
  return b.status === "committed" ? parts.join(", ") : `Would add ${parts.join(", ")}`;
}

export function BatchesTable({ batches, isLoading, error }: BatchesTableProps) {
  return (
    <Card padding="md" withBorder>
      <Stack gap="sm">
        <Text fw={600}>Batches</Text>
        {error ? (
          <Alert tone="danger" role="alert">
            The batch log could not be loaded: {error.message}
          </Alert>
        ) : isLoading ? (
          <Text size="sm" c="dimmed">
            Loading batches…
          </Text>
        ) : !batches || batches.length === 0 ? (
          <Text size="sm" c="dimmed">
            No history has been checked or imported yet.
          </Text>
        ) : (
          <Table aria-label="Import batches">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Batch</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Records</Table.Th>
                <Table.Th>Added</Table.Th>
                <Table.Th>Problems</Table.Th>
                <Table.Th>By</Table.Th>
                <Table.Th>When</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {batches.map((b) => (
                <Table.Tr key={b.id}>
                  <Table.Td>{b.label}</Table.Td>
                  <Table.Td miw={120}>
                    <Badge tone={STATUS[b.status].tone}>
                      {b.dry_run && b.status !== "refused" ? "Dry run" : STATUS[b.status].label}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{b.record_count}</Table.Td>
                  <Table.Td>{summary(b)}</Table.Td>
                  <Table.Td>{b.problem_count}</Table.Td>
                  <Table.Td>{b.created_by_name ?? "—"}</Table.Td>
                  <Table.Td>{new Date(b.created_at).toLocaleString()}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Card>
  );
}

/** Every export request this hospital has made, with what each user may do next. */
import { Group, Stack, Text } from "@mantine/core";
import type { ResearchExport } from "@medbrains/types";
import { IconCheck, IconDownload, IconX } from "@tabler/icons-react";
import { Alert, Badge, Button, Card, Table } from "@/components/ui";
import { DATASET_LABEL, STATUS } from "./labels";

interface ExportsTableProps {
  exports: ResearchExport[] | undefined;
  isLoading: boolean;
  error: Error | null;
  /** The signed-in user: the requester may not decide, only the two may download. */
  userId: string | undefined;
  busy: boolean;
  onDecide: (row: ResearchExport, action: "approve" | "reject") => void;
  onDownload: (row: ResearchExport, file: "data" | "dictionary") => void;
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

function Actions({
  row,
  userId,
  busy,
  onDecide,
  onDownload,
}: Omit<ExportsTableProps, "exports" | "isLoading" | "error"> & { row: ResearchExport }) {
  if (row.status === "requested") {
    if (row.requested_by === userId) {
      return (
        <Text size="xs" c="dimmed">
          Needs a second approver
        </Text>
      );
    }
    return (
      <Group gap="xs" wrap="nowrap">
        <Button
          tone="primary"
          size="compact-sm"
          leftSection={<IconCheck size={16} />}
          disabled={busy}
          onClick={() => onDecide(row, "approve")}
        >
          Approve
        </Button>
        <Button
          tone="secondary"
          size="compact-sm"
          leftSection={<IconX size={16} />}
          disabled={busy}
          onClick={() => onDecide(row, "reject")}
        >
          Reject
        </Button>
      </Group>
    );
  }
  const mine = row.requested_by === userId || row.decided_by === userId;
  if (row.status === "ready" && mine) {
    return (
      <Group gap="xs" wrap="nowrap">
        <Button
          tone="primary"
          size="compact-sm"
          leftSection={<IconDownload size={16} />}
          onClick={() => onDownload(row, "data")}
        >
          Data
        </Button>
        <Button
          tone="secondary"
          size="compact-sm"
          leftSection={<IconDownload size={16} />}
          onClick={() => onDownload(row, "dictionary")}
        >
          Dictionary
        </Button>
      </Group>
    );
  }
  return (
    <Text size="xs" c="dimmed">
      {row.decision_note ?? "—"}
    </Text>
  );
}

export function ExportsTable(props: ExportsTableProps) {
  const { exports, isLoading, error } = props;
  return (
    <Card padding="md" withBorder>
      <Stack gap="sm">
        <Text fw={600}>Requests</Text>
        {error ? (
          <Alert tone="danger" role="alert">
            The export requests could not be loaded: {error.message}
          </Alert>
        ) : isLoading ? (
          <Text size="sm" c="dimmed">
            Loading requests…
          </Text>
        ) : !exports || exports.length === 0 ? (
          <Text size="sm" c="dimmed">
            No research export has been requested yet.
          </Text>
        ) : (
          <Table aria-label="Research export requests">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Dataset and period</Table.Th>
                <Table.Th>Study</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Rows</Table.Th>
                <Table.Th>Requested</Table.Th>
                <Table.Th>Decided</Table.Th>
                <Table.Th>Available until</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {exports.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>
                    {DATASET_LABEL[row.dataset]}, {row.period_from} to {row.period_to}
                  </Table.Td>
                  <Table.Td maw={320}>
                    <Text size="sm">{row.purpose}</Text>
                    <Text size="xs" c="dimmed">
                      IEC {row.iec_reference}
                    </Text>
                  </Table.Td>
                  <Table.Td miw={150}>
                    <Badge tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Badge>
                  </Table.Td>
                  <Table.Td>
                    {row.row_count === null
                      ? "—"
                      : `${row.row_count.toLocaleString()} (${(row.suppressed_rows ?? 0).toLocaleString()} suppressed)`}
                  </Table.Td>
                  <Table.Td>
                    {row.requested_by_name ?? "—"}
                    {row.requested_via === "assistant" ? " (prepared by the assistant)" : ""}
                    <Text size="xs" c="dimmed">
                      {when(row.created_at)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {row.decided_by_name ?? "—"}
                    <Text size="xs" c="dimmed">
                      {when(row.decided_at)}
                    </Text>
                  </Table.Td>
                  <Table.Td>{row.status === "ready" ? when(row.expires_at) : "—"}</Table.Td>
                  <Table.Td>
                    <Actions
                      row={row}
                      userId={props.userId}
                      busy={props.busy}
                      onDecide={props.onDecide}
                      onDownload={props.onDownload}
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Card>
  );
}

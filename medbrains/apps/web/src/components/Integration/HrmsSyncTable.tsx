import { Stack, Text } from "@mantine/core";
import type { HrmsSyncStatus } from "@medbrains/types";
import { Alert, Badge, Table } from "@/components/ui";
import { formatDateTime } from "@/lib/date-utils";

interface HrmsSyncTableProps {
  status: HrmsSyncStatus | undefined;
  isLoading: boolean;
  isError: boolean;
}

/** Each entity's last pull, then the rows Humanex sent that could not be applied. */
export function HrmsSyncTable({ status, isLoading, isError }: HrmsSyncTableProps) {
  if (isError) {
    return (
      <Alert tone="danger" title="The pull history could not be loaded">
        How the last pull went is unknown, not empty. Refresh to try again.
      </Alert>
    );
  }
  if (isLoading || !status)
    return (
      <Text size="sm" c="dimmed">
        Loading…
      </Text>
    );
  if (status.entities.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Nothing has been pulled yet.
      </Text>
    );
  }
  return (
    <Stack gap="sm">
      <Table verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Feed</Table.Th>
            <Table.Th>Last pulled</Table.Th>
            <Table.Th>Applied</Table.Th>
            <Table.Th>Rejected</Table.Th>
            <Table.Th>Result</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {status.entities.map((e) => (
            <Table.Tr key={e.entity}>
              <Table.Td>{e.entity.replace("_", " ")}</Table.Td>
              <Table.Td>{formatDateTime(e.last_run_at)}</Table.Td>
              <Table.Td>{e.upserted}</Table.Td>
              <Table.Td>{e.failed}</Table.Td>
              <Table.Td>
                {e.last_error ? (
                  <Text size="sm" c="danger">
                    {e.last_error}
                  </Text>
                ) : (
                  <Badge tone={e.failed > 0 ? "warning" : "success"}>
                    {e.failed > 0 ? "Some rows rejected" : "OK"}
                  </Badge>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {status.recent_exceptions.length > 0 && (
        <>
          <Text fw={600} size="sm">
            Rows not applied (latest 50)
          </Text>
          <Table verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>When</Table.Th>
                <Table.Th>Feed</Table.Th>
                <Table.Th>Record</Table.Th>
                <Table.Th>Why</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {status.recent_exceptions.map((x) => (
                <Table.Tr key={x.id}>
                  <Table.Td>{formatDateTime(x.created_at)}</Table.Td>
                  <Table.Td>{x.entity}</Table.Td>
                  <Table.Td>
                    <Text ff="monospace" size="xs">
                      {x.record_key ?? "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{x.error}</Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}
    </Stack>
  );
}

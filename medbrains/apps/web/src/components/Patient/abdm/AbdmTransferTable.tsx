import { Text } from "@mantine/core";
import type { AbdmHealthTransfer } from "@medbrains/types";
import { Badge, Table } from "@/components/ui";
import { formatDateTime } from "@/lib/date-utils";
import { TRANSFER_STATUS } from "./abdmStatus";

/** Every time this patient's records were sent under a consent. */
export function AbdmTransferTable({ transfers }: { transfers: AbdmHealthTransfer[] }) {
  if (transfers.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Nothing has been sent through ABDM for this patient.
      </Text>
    );
  }
  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Requested</Table.Th>
          <Table.Th>Records sent</Table.Th>
          <Table.Th>Status</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {transfers.map((t) => {
          const status = TRANSFER_STATUS[t.status] ?? { label: t.status, tone: "neutral" as const };
          return (
            <Table.Tr key={t.id}>
              <Table.Td>
                <Text size="sm">{formatDateTime(t.requested_at)}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{t.entry_count}</Text>
              </Table.Td>
              <Table.Td>
                <Badge tone={status.tone}>{status.label}</Badge>
                {t.error && (
                  <Text size="xs" c="var(--mb-text-secondary)">
                    {t.error}
                  </Text>
                )}
              </Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}

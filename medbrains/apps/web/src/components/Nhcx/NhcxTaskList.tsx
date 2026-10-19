import { Stack, Text } from "@mantine/core";
import type { NhcxTask } from "@medbrains/types";
import { Badge, Table } from "@/components/ui";
import { taskAnswer, taskLabel } from "./claimNhcx";
import { nhcxStatusLabel } from "./nhcxSummary";

interface NhcxTaskListProps {
  tasks: NhcxTask[];
}

/** Status checks, cancellations and reprocess requests sent about a claim,
 * with the payer's answer to each. */
export function NhcxTaskList({ tasks }: NhcxTaskListProps) {
  if (tasks.length === 0) return null;
  return (
    <Stack gap={4}>
      <Text fw={600} size="sm">
        Requests to the payer
      </Text>
      <Table verticalSpacing={4} fz="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Asked</Table.Th>
            <Table.Th>Request</Table.Th>
            <Table.Th>Sent</Table.Th>
            <Table.Th>Payer's answer</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {tasks.map((t) => {
            const sent = nhcxStatusLabel(t.nhcx_status);
            return (
              <Table.Tr key={t.id}>
                <Table.Td>{new Date(t.created_at).toLocaleString()}</Table.Td>
                <Table.Td>
                  {taskLabel(t.kind)}
                  {t.request.reason ? ` — ${t.request.reason}` : ""}
                </Table.Td>
                <Table.Td>
                  <Badge size="xs" tone={sent.tone}>
                    {sent.label}
                  </Badge>
                </Table.Td>
                <Table.Td>{taskAnswer(t) ?? "Waiting"}</Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

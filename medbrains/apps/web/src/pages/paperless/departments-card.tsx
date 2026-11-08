import { Stack, Text } from "@mantine/core";
import type { PaperlessDepartment } from "@medbrains/types";
import { Card, Table } from "@/components/ui";
import { formatShare } from "./labels";

interface DepartmentsCardProps {
  departments: PaperlessDepartment[];
  /** No day in the range has been counted: shares read "Not counted". */
  isCounted: boolean;
}

/**
 * Every active department, most documents first. One that made none reads
 * "No documents" in its share columns, and every one reads "Not counted"
 * before any day is counted; never 0%.
 */
export function DepartmentsCard({ departments, isCounted }: DepartmentsCardProps) {
  const empty = isCounted ? "No documents" : "Not counted";
  return (
    <Card padding="md" pattern={false} data-testid="paperless-departments">
      <Stack gap="sm">
        <Text fw={600}>By department</Text>
        <Table.ScrollContainer minWidth={720}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Department</Table.Th>
                <Table.Th>Made in system</Table.Th>
                <Table.Th>Signed</Table.Th>
                <Table.Th>Signed share</Table.Th>
                <Table.Th>Paper scanned</Table.Th>
                <Table.Th>Made in system share</Table.Th>
                <Table.Th>First prints</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {departments.map((d) => (
                <Table.Tr key={d.department_id ?? "none"} data-testid="paperless-department-row">
                  <Table.Td>{d.name}</Table.Td>
                  <Table.Td>{d.counts.created}</Table.Td>
                  <Table.Td>{d.counts.signed}</Table.Td>
                  <Table.Td>{formatShare(d.signed_pct, empty)}</Table.Td>
                  <Table.Td>{d.counts.scanned}</Table.Td>
                  <Table.Td>{formatShare(d.digital_pct, empty)}</Table.Td>
                  <Table.Td>{d.counts.printed}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Stack>
    </Card>
  );
}

/** What an upload would change, or did — and every problem, where to find it. */
import { Group, Stack, Text } from "@mantine/core";
import type { WorkbookImportResult } from "@medbrains/types";
import { Alert, Button, Card, Table } from "@/components/ui";

interface WorkbookResultProps {
  result: WorkbookImportResult;
  applying: boolean;
  onApply: () => void;
}

export function WorkbookResult({ result, applying, onApply }: WorkbookResultProps) {
  const clean = result.problems.length === 0;
  return (
    <Card padding="md" withBorder data-testid="workbook-result">
      <Stack gap="sm">
        {result.applied ? (
          <Alert tone="success" title="Applied">
            {result.welcomed > 0
              ? `${result.welcomed} new staff have been emailed how to set their password.`
              : "No new staff to welcome."}
          </Alert>
        ) : clean ? (
          <Alert tone="info" title="Checked — ready to apply">
            Nothing has changed yet. Apply to make these changes.
          </Alert>
        ) : (
          <Alert tone="danger" title={`${result.problems.length} problem(s) to fix`}>
            Nothing was changed. Fix these cells in the workbook and upload it again.
          </Alert>
        )}
        <Table aria-label="Changes by sheet">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Sheet</Table.Th>
              <Table.Th>{result.applied ? "Added" : "Will add"}</Table.Th>
              <Table.Th>{result.applied ? "Updated" : "Will update"}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {result.sheets.map((s) => (
              <Table.Tr key={s.sheet}>
                <Table.Td>{s.sheet}</Table.Td>
                <Table.Td>{s.added}</Table.Td>
                <Table.Td>{s.updated}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {!clean && (
          <Table aria-label="Problems">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Sheet</Table.Th>
                <Table.Th>Row</Table.Th>
                <Table.Th>Column</Table.Th>
                <Table.Th>Problem</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {result.problems.map((p) => (
                <Table.Tr key={`${p.sheet}-${p.row}-${p.column}`}>
                  <Table.Td>{p.sheet}</Table.Td>
                  <Table.Td>{p.row}</Table.Td>
                  <Table.Td>{p.column}</Table.Td>
                  <Table.Td>
                    <Text size="sm">{p.message}</Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        {!result.applied && clean && (
          <Group justify="flex-end">
            <Button tone="primary" loading={applying} onClick={onApply}>
              Apply workbook
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  );
}

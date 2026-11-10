/** What a batch would add, or did — and every problem, by record and field. */
import { Group, Stack, Text } from "@mantine/core";
import type { HistoryImportResult } from "@medbrains/types";
import { Alert, Button, Card, Table } from "@/components/ui";
import { KIND_LABEL } from "./labels";

interface HistoryResultProps {
  result: HistoryImportResult;
  canCommit: boolean;
  committing: boolean;
  onCommit: () => void;
}

export function HistoryResult({ result, canCommit, committing, onCommit }: HistoryResultProps) {
  const clean = result.problems.length === 0;
  const added = result.applied ? "Added" : "Will add";
  return (
    <Card padding="md" withBorder data-testid="history-result">
      <Stack gap="sm">
        {result.applied ? (
          <Alert tone="success" title="Imported">
            The records are in, dated when they happened. The audit log names this batch.
          </Alert>
        ) : clean ? (
          <Alert tone="info" title="Checked — ready to import">
            Nothing has been imported yet. Import to add these records.
          </Alert>
        ) : (
          <Alert tone="danger" title={`${result.problems.length} problem(s) to fix`}>
            Nothing was imported. Fix these records in the export and check it again.
          </Alert>
        )}
        <Table aria-label="Records by kind">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Kind</Table.Th>
              <Table.Th>{added}</Table.Th>
              <Table.Th>Already imported</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {result.tallies.map((t) => (
              <Table.Tr key={t.kind}>
                <Table.Td>{KIND_LABEL[t.kind]}</Table.Td>
                <Table.Td>{t.added}</Table.Td>
                <Table.Td>{t.skipped}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {!clean && (
          <Table aria-label="Problems">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Record</Table.Th>
                <Table.Th>Kind</Table.Th>
                <Table.Th>External id</Table.Th>
                <Table.Th>Field</Table.Th>
                <Table.Th>Problem</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {result.problems.map((p) => (
                <Table.Tr key={`${p.record}-${p.field}-${p.message}`}>
                  <Table.Td>{p.record}</Table.Td>
                  <Table.Td>{KIND_LABEL[p.kind]}</Table.Td>
                  <Table.Td>{p.external_id}</Table.Td>
                  <Table.Td>{p.field}</Table.Td>
                  <Table.Td>
                    <Text size="sm">{p.message}</Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        {!result.applied && clean && canCommit && (
          <Group justify="flex-end">
            <Button tone="primary" loading={committing} onClick={onCommit}>
              Import these records
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  );
}

import {
  Alert,
  Badge,
  Button,
  FileInput,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { CsvImportRequest, CsvImportResult } from "@medbrains/types";
import { IconAlertCircle, IconCheck, IconFileUpload } from "@tabler/icons-react";
import { useCallback, useState } from "react";

interface Props {
  opened: boolean;
  onClose: () => void;
  title: string;
  requiredColumns: string[];
  optionalColumns?: string[];
  onImport: (data: CsvImportRequest) => Promise<CsvImportResult>;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0]?.split(",").map((h) => h.trim().replace(/^"|"$/g, "")) ?? [];
  const rows = lines
    .slice(1)
    .map((line) => line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")));

  return { headers, rows };
}

export function CsvImportModal({
  opened,
  onClose,
  title,
  requiredColumns,
  optionalColumns = [],
  onImport,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleFileChange = useCallback(
    (f: File | null) => {
      setFile(f);
      setParsed(null);
      setResult(null);
      setParseError(null);

      if (!f) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const data = parseCsv(text);

        if (data.headers.length === 0) {
          setParseError("File appears to be empty");
          return;
        }

        const lowerHeaders = data.headers.map((h) => h.toLowerCase());
        const missing = requiredColumns.filter((col) => !lowerHeaders.includes(col.toLowerCase()));

        if (missing.length > 0) {
          setParseError(
            `Missing required columns: ${missing.join(", ")}. Found: ${data.headers.join(", ")}`,
          );
          return;
        }

        setParsed(data);
      };
      reader.readAsText(f);
    },
    [requiredColumns],
  );

  const handleImport = async () => {
    if (!parsed) return;
    setImporting(true);
    try {
      const payload: CsvImportRequest = {
        headers: parsed.headers,
        rows: parsed.rows.map((r) => ({ values: r })),
      };
      const res = await onImport(payload);
      setResult(res);
      if (res.imported > 0) {
        notifications.show({
          title: "Import successful",
          message: `Imported ${res.imported} records${res.skipped > 0 ? `, skipped ${res.skipped}` : ""}`,
          color: "success",
        });
      }
    } catch {
      notifications.show({
        title: "Import failed",
        message: "An error occurred during import",
        color: "danger",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsed(null);
    setResult(null);
    setParseError(null);
    onClose();
  };

  return (
    <Modal opened={opened} onClose={handleClose} title={title} size="lg">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Upload a CSV file with the following columns:
        </Text>
        <Group gap="xs">
          {requiredColumns.map((col) => (
            <Badge key={col} size="sm" color="primary">
              {col} (required)
            </Badge>
          ))}
          {optionalColumns.map((col) => (
            <Badge key={col} size="sm" color="slate" variant="light">
              {col}
            </Badge>
          ))}
        </Group>

        <FileInput
          label="CSV File"
          placeholder="Select a .csv file"
          accept=".csv"
          value={file}
          onChange={handleFileChange}
          leftSection={<IconFileUpload size={16} />}
        />

        {parseError && (
          <Alert color="danger" icon={<IconAlertCircle size={16} />}>
            {parseError}
          </Alert>
        )}

        {parsed && !result && (
          <>
            <Text size="sm" fw={500}>
              Preview ({parsed.rows.length} rows)
            </Text>
            <ScrollArea h={200}>
              <Table striped withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    {parsed.headers.map((h) => (
                      <Table.Th key={h}>{h}</Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {parsed.rows.slice(0, 10).map((row, i) => (
                    <Table.Tr key={i}>
                      {row.map((cell, j) => (
                        <Table.Td key={j}>{cell}</Table.Td>
                      ))}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
            {parsed.rows.length > 10 && (
              <Text size="xs" c="dimmed">
                Showing first 10 of {parsed.rows.length} rows
              </Text>
            )}

            <Button onClick={handleImport} loading={importing}>
              Import {parsed.rows.length} rows
            </Button>
          </>
        )}

        {result && (
          <Alert
            color={result.errors.length > 0 ? "warning" : "success"}
            icon={<IconCheck size={16} />}
          >
            <Text fw={500}>
              Imported: {result.imported}, Skipped: {result.skipped}
            </Text>
            {result.errors.length > 0 && (
              <ScrollArea h={100} mt="xs">
                {result.errors.map((err, i) => (
                  <Text key={i} size="xs" c="dimmed">
                    {err}
                  </Text>
                ))}
              </ScrollArea>
            )}
          </Alert>
        )}
      </Stack>
    </Modal>
  );
}

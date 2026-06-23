import {
  Alert,
  Badge,
  Button,
  FileInput,
  Group,
  Modal,
  Progress,
  ScrollArea,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { CsvImportRequest, CsvImportResult } from "@medbrains/types";
import { IconAlertCircle, IconCheck, IconDownload, IconFileUpload } from "@tabler/icons-react";
import { useCallback, useState } from "react";

interface Props {
  opened: boolean;
  onClose: () => void;
  title: string;
  requiredColumns: string[];
  optionalColumns?: string[];
  onImport: (data: CsvImportRequest) => Promise<CsvImportResult>;
  /** Rows per background batch. Large files stream in chunks so the UI stays responsive. */
  chunkSize?: number;
}

/** Yield to the event loop so the progress bar can repaint between batches. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
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
  chunkSize = 100,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [processed, setProcessed] = useState(0);

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
    const total = parsed.rows.length;
    setImporting(true);
    setProcessed(0);
    const agg: CsvImportResult = { imported: 0, skipped: 0, errors: [] };
    try {
      // Stream rows to the server in chunks so very large files report real
      // progress and never block the UI thread on one giant request.
      for (let start = 0; start < total; start += chunkSize) {
        const slice = parsed.rows.slice(start, start + chunkSize);
        const res = await onImport({
          headers: parsed.headers,
          rows: slice.map((r) => ({ values: r })),
        });
        agg.imported += res.imported;
        agg.skipped += res.skipped;
        agg.errors.push(...res.errors);
        setProcessed(Math.min(start + slice.length, total));
        await nextFrame();
      }
      setResult(agg);
      if (agg.imported > 0) {
        notifications.show({
          title: "Import successful",
          message: `Imported ${agg.imported} records${agg.skipped > 0 ? `, skipped ${agg.skipped}` : ""}`,
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

  const handleDownloadTemplate = () => {
    const cols = [...requiredColumns, ...optionalColumns];
    const blob = new Blob([`${cols.join(",")}\n`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setFile(null);
    setParsed(null);
    setResult(null);
    setParseError(null);
    setProcessed(0);
    onClose();
  };

  const progressPct =
    parsed && parsed.rows.length > 0 ? Math.round((processed / parsed.rows.length) * 100) : 0;

  return (
    <Modal opened={opened} onClose={handleClose} title={title} size="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Text size="sm" c="dimmed">
            Upload a CSV file with the following columns:
          </Text>
          <Button
            variant="light"
            size="compact-sm"
            leftSection={<IconDownload size={14} />}
            onClick={handleDownloadTemplate}
          >
            Download template
          </Button>
        </Group>
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

            {importing ? (
              <Stack gap={6}>
                <Group justify="space-between">
                  <Text size="sm" fw={500}>
                    Importing…
                  </Text>
                  <Text size="sm" c="dimmed" ff="monospace">
                    {processed} / {parsed.rows.length} ({progressPct}%)
                  </Text>
                </Group>
                <Progress value={progressPct} size="lg" striped animated radius={0} />
              </Stack>
            ) : (
              <Button onClick={handleImport}>Import {parsed.rows.length} rows</Button>
            )}
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

/**
 * Admin → Data import → History. Bring a hospital's past — patients, visits,
 * admissions, lab results, dispenses, bills, claims — in from the system it
 * used before, dated when it happened. Set the go-live moment first: nothing
 * on or after it is accepted. Every upload is checked first and shows what it
 * would add, or every problem by record and field; nothing changes until Import.
 */
import { FileButton, Group, Stack, Text } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useHasPermission } from "@medbrains/stores";
import { type HistoryImportRecord, type HistoryImportResult, P } from "@medbrains/types";
import { IconCalendarEvent, IconUpload } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components";
import { Alert, Button, Card, Input, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { historyImportService } from "@/services/historyImport.service";
import { BatchesTable } from "./history-import/batches-table";
import { HistoryResult } from "./history-import/history-result";
import { readRecords } from "./history-import/read-records";

const KEYS = { settings: ["history-import", "settings"], batches: ["history-import", "batches"] };

export function HistoryImportPage() {
  useRequirePermission(P.ADMIN.HISTORY_IMPORT_VIEW);
  const canRun = useHasPermission(P.ADMIN.HISTORY_IMPORT_RUN);
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: KEYS.settings, queryFn: historyImportService.getSettings });
  const batches = useQuery({ queryKey: KEYS.batches, queryFn: historyImportService.listBatches });
  const [goLive, setGoLive] = useState<Date | null>(null);
  const [label, setLabel] = useState("");
  const [records, setRecords] = useState<HistoryImportRecord[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<HistoryImportResult | null>(null);

  const saveGoLive = useMutation({
    mutationFn: (at: Date) => historyImportService.saveSettings({ go_live_at: at.toISOString() }),
    onSuccess: () => {
      toast.success("Go-live saved.");
      setGoLive(null);
      qc.invalidateQueries({ queryKey: KEYS.settings });
    },
  });
  const run = useMutation({
    mutationFn: ({ list, dryRun }: { list: HistoryImportRecord[]; dryRun: boolean }) =>
      historyImportService.runBatch({
        label: label.trim() || fileName,
        dry_run: dryRun,
        records: list,
      }),
    onSuccess: (done) => {
      setResult(done);
      qc.invalidateQueries({ queryKey: KEYS.batches });
      if (done.applied) toast.success("The history has been imported.");
    },
  });
  const check = useMutation({
    mutationFn: async (file: File) => {
      const list = readRecords(await file.text());
      setRecords(list);
      setFileName(file.name);
      return historyImportService.runBatch({
        label: label.trim() || file.name,
        dry_run: true,
        records: list,
      });
    },
    onSuccess: (done) => {
      setResult(done);
      qc.invalidateQueries({ queryKey: KEYS.batches });
    },
  });
  const current = settings.data?.go_live_at ? new Date(settings.data.go_live_at) : null;
  const failure = settings.error ?? saveGoLive.error ?? check.error ?? run.error;

  return (
    <Stack gap="md">
      <PageHeader
        title="Import history"
        subtitle="Bring past visits, admissions, results, dispenses, bills and claims from the previous system"
      />
      <Card padding="md" withBorder>
        <Stack gap="sm">
          <Text fw={600}>1. Go-live</Text>
          <Text size="sm" c="dimmed">
            History must end before the moment this hospital started working live. Records on or
            after it, or in the future, are refused, so an import can never touch live work.
          </Text>
          <Text size="sm" data-testid="go-live-current">
            {settings.isLoading
              ? "Loading…"
              : current
                ? `Go-live: ${current.toLocaleString()}`
                : "Go-live is not set yet — set it before importing."}
          </Text>
          {canRun && (
            <Group align="flex-end">
              <DateTimePicker
                label="Go-live date and time"
                value={goLive}
                onChange={(value) => setGoLive(value ? new Date(value) : null)}
                leftSection={<IconCalendarEvent size={16} />}
                w={280}
              />
              <Button
                tone="secondary"
                disabled={!goLive}
                loading={saveGoLive.isPending}
                onClick={() => goLive && saveGoLive.mutate(goLive)}
              >
                Save go-live
              </Button>
            </Group>
          )}
        </Stack>
      </Card>
      {canRun && (
        <Card padding="md" withBorder>
          <Stack gap="sm">
            <Text fw={600}>2. Check an export</Text>
            <Text size="sm" c="dimmed">
              A JSON file of records, each with its kind and the id it had in the old system — at
              most 2,000 per batch. It is checked first; records already imported are skipped.
            </Text>
            <Input
              label="Batch label"
              placeholder="e.g. Old HIS export, April 2026"
              value={label}
              onChange={(e) => setLabel(e.currentTarget.value)}
              w={360}
            />
            <FileButton
              accept=".json,application/json"
              onChange={(file) => {
                setResult(null);
                if (file) check.mutate(file);
              }}
            >
              {(props) => (
                <Button
                  {...props}
                  tone="primary"
                  leftSection={<IconUpload size={16} />}
                  loading={check.isPending}
                  disabled={!current}
                  style={{ alignSelf: "flex-start" }}
                >
                  Choose export (.json)
                </Button>
              )}
            </FileButton>
          </Stack>
        </Card>
      )}
      {failure && (
        <Alert tone="danger" role="alert">
          {failure.message}
        </Alert>
      )}
      {result && (
        <HistoryResult
          result={result}
          canCommit={canRun && records !== null}
          committing={run.isPending}
          onCommit={() => records && run.mutate({ list: records, dryRun: false })}
        />
      )}
      <BatchesTable batches={batches.data} isLoading={batches.isLoading} error={batches.error} />
    </Stack>
  );
}

/**
 * Set the hospital up from a spreadsheet. Download the workbook — blank, or
 * filled with what the hospital already has — fill it in or send it to the
 * hospital, upload it back. Every upload is checked first and shows what it
 * would add and update, or every problem by sheet, row and column; nothing
 * changes until Apply.
 */
import { FileButton, Group, Stack, Text } from "@mantine/core";
import { P, type WorkbookImportResult, type WorkbookSheets } from "@medbrains/types";
import { IconDownload, IconFileSpreadsheet, IconUpload } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components";
import { Alert, Button, Card, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { settingsSetupService as setupService } from "@/services/settingsSetup.service";
import { downloadBlob } from "@/utils/download";
import { instructions, rowsFromSheet, SHEETS, sheetRows } from "./workbook/columns";
import { WorkbookResult } from "./workbook/workbook-result";

async function downloadWorkbook(filled: boolean) {
  const book = await setupService.getOnboardingWorkbook();
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const sheets = [
    {
      sheet: "Instructions",
      data: instructions(book).map((r) => r.map((value) => ({ value }))),
      columns: [{ width: 28 }, { width: 90 }],
    },
    ...SHEETS.map((def) => ({
      sheet: def.title,
      data: sheetRows(def, book, filled).map((r, i) =>
        r.map((value) => ({ value, fontWeight: i === 0 ? ("bold" as const) : undefined })),
      ),
      columns: def.columns.map((c) => ({ width: c.width })),
      stickyRowsCount: 1,
    })),
  ];
  const blob = await writeXlsxFile(sheets).toBlob();
  downloadBlob(blob, `${book.hospital_code}-onboarding-workbook${filled ? "" : "-blank"}.xlsx`);
}

async function readWorkbook(file: File): Promise<WorkbookSheets> {
  const { default: readXlsxFile, readSheetNames } = await import("read-excel-file");
  const names = await readSheetNames(file);
  const out: WorkbookSheets = { departments: [], wards: [], beds: [], staff: [] };
  for (const def of SHEETS) {
    const name = names.find((n) => n.trim().toLowerCase() === def.title.toLowerCase());
    if (!name) continue;
    const rows = await readXlsxFile(file, { sheet: name });
    (out[def.key] as unknown[]) = rowsFromSheet(def, rows as unknown[][]);
  }
  return out;
}

export function OnboardingWorkbookPage() {
  useRequirePermission(P.ADMIN.WORKBOOK_IMPORT);
  const [sheets, setSheets] = useState<WorkbookSheets | null>(null);
  const [result, setResult] = useState<WorkbookImportResult | null>(null);

  const download = useMutation({ mutationFn: downloadWorkbook });
  const check = useMutation({
    mutationFn: async (file: File) => {
      const read = await readWorkbook(file);
      setSheets(read);
      return setupService.importOnboardingWorkbook({ ...read, dry_run: true });
    },
    onSuccess: setResult,
  });
  const apply = useMutation({
    mutationFn: () =>
      setupService.importOnboardingWorkbook({ ...(sheets as WorkbookSheets), dry_run: false }),
    onSuccess: (done) => {
      setResult(done);
      if (done.applied) toast.success("The workbook has been applied.");
    },
  });
  const failure = download.error ?? check.error ?? apply.error;

  return (
    <Stack gap="md">
      <PageHeader
        title="Onboarding workbook"
        subtitle="Set up departments, wards, beds and staff from one spreadsheet"
      />
      <Card padding="md" withBorder>
        <Stack gap="sm">
          <Text fw={600}>1. Download the workbook</Text>
          <Text size="sm" c="dimmed">
            Fill it in yourself, or send it to the hospital and upload what comes back. The filled
            copy holds everything already set up, so you can correct it and upload it again.
          </Text>
          <Group>
            <Button
              tone="secondary"
              leftSection={<IconDownload size={16} />}
              loading={download.isPending && download.variables === false}
              onClick={() => download.mutate(false)}
            >
              Blank workbook
            </Button>
            <Button
              tone="secondary"
              leftSection={<IconFileSpreadsheet size={16} />}
              loading={download.isPending && download.variables === true}
              onClick={() => download.mutate(true)}
            >
              With current data
            </Button>
          </Group>
        </Stack>
      </Card>
      <Card padding="md" withBorder>
        <Stack gap="sm">
          <Text fw={600}>2. Upload the filled workbook</Text>
          <Text size="sm" c="dimmed">
            It is checked first. Nothing changes until you apply it.
          </Text>
          <FileButton
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
                style={{ alignSelf: "flex-start" }}
              >
                Choose workbook (.xlsx)
              </Button>
            )}
          </FileButton>
        </Stack>
      </Card>
      {failure && (
        <Alert tone="danger" role="alert">
          {failure.message}
        </Alert>
      )}
      {result && (
        <WorkbookResult result={result} applying={apply.isPending} onApply={() => apply.mutate()} />
      )}
    </Stack>
  );
}

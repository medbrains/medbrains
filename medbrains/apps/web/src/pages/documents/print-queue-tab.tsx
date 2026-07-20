// IPD PrintQueueTab — split from documents.tsx (pure move).

import { Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { PrintJob } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconPrinter, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { DataTable } from "@/components";
import { Badge, type BadgeTone, Button, toast } from "@/components/ui";
import { documentsService } from "@/services/documents.service";
import { CONNECTION_TYPES, optionLabel } from "./shared";

const printJobStatusColors: Record<PrintJob["status"], BadgeTone> = {
  queued: "warning",
  printing: "primary",
  completed: "success",
  failed: "danger",
  cancelled: "neutral",
};

export function PrintQueueTab() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(P.DOCUMENTS.PRINTERS_MANAGE);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["print-jobs"],
    queryFn: () => documentsService.listPrintJobs(),
  });
  const { data: printers = [] } = useQuery({
    queryKey: ["printers"],
    queryFn: () => documentsService.listPrinters(),
  });

  const printersById = useMemo(
    () => new Map(printers.map((printer) => [printer.id, printer])),
    [printers],
  );
  const queuedCount = jobs.filter((job) => job.status === "queued").length;
  const printingCount = jobs.filter((job) => job.status === "printing").length;
  const failedCount = jobs.filter((job) => job.status === "failed").length;

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      status,
      errorMessage,
    }: {
      id: string;
      status: PrintJob["status"];
      errorMessage?: string;
    }) =>
      documentsService.updatePrintJob(id, {
        status,
        error_message: errorMessage,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["print-jobs"] });
      toast.success("Print job status changed", { title: "Print job updated" });
    },
  });

  const columns = [
    {
      key: "created_at",
      label: "Queued At",
      render: (row: PrintJob) => <Text size="sm">{new Date(row.created_at).toLocaleString()}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: PrintJob) => (
        <Badge tone={printJobStatusColors[row.status]}>{row.status}</Badge>
      ),
    },
    {
      key: "printer",
      label: "Printer",
      render: (row: PrintJob) => {
        const printer = row.printer_id ? printersById.get(row.printer_id) : null;
        return (
          <Stack gap={2}>
            <Text size="sm" fw={500}>
              {printer?.name ?? "Unassigned"}
            </Text>
            <Text size="xs" c="dimmed">
              {printer ? optionLabel(CONNECTION_TYPES, printer.connection_type) : "Manual dispatch"}
            </Text>
          </Stack>
        );
      },
    },
    {
      key: "copies",
      label: "Copies",
      render: (row: PrintJob) => (
        <Stack gap={2}>
          <Text size="sm">{row.copies}</Text>
          <Text size="xs" c="dimmed">
            Priority {row.priority}
          </Text>
        </Stack>
      ),
    },
    {
      key: "document_output_id",
      label: "Document",
      render: (row: PrintJob) => (
        <Text size="sm" ff="monospace">
          {row.document_output_id.slice(0, 8)}
        </Text>
      ),
    },
    {
      key: "error_message",
      label: "Last Error",
      render: (row: PrintJob) => (
        <Text size="sm" c={row.error_message ? "danger" : "dimmed"}>
          {row.error_message ?? "—"}
        </Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: PrintJob) => (
        <Group gap={4} justify="flex-end">
          {canManage && row.status === "queued" && (
            <Button
              tone="ghost"
              size="xs"
              leftSection={<IconPrinter size={14} />}
              loading={updateMutation.isPending}
              onClick={() => updateMutation.mutate({ id: row.id, status: "printing" })}
            >
              Start
            </Button>
          )}
          {canManage && row.status === "printing" && (
            <Button
              tone="ghost"
              size="xs"
              leftSection={<IconCheck size={14} />}
              loading={updateMutation.isPending}
              onClick={() => updateMutation.mutate({ id: row.id, status: "completed" })}
            >
              Complete
            </Button>
          )}
          {canManage && (row.status === "queued" || row.status === "printing") && (
            <Button
              tone="subtle-danger"
              size="xs"
              leftSection={<IconX size={14} />}
              loading={updateMutation.isPending}
              onClick={() =>
                updateMutation.mutate({
                  id: row.id,
                  status: row.status === "printing" ? "failed" : "cancelled",
                  errorMessage:
                    row.status === "printing" ? "Marked failed from print queue" : undefined,
                })
              }
            >
              {row.status === "printing" ? "Fail" : "Cancel"}
            </Button>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder radius="sm">
          <Text size="xs" c="dimmed" tt="uppercase">
            Queued
          </Text>
          <Text size="xl" fw={700}>
            {queuedCount}
          </Text>
        </Card>
        <Card withBorder radius="sm">
          <Text size="xs" c="dimmed" tt="uppercase">
            Printing
          </Text>
          <Text size="xl" fw={700}>
            {printingCount}
          </Text>
        </Card>
        <Card withBorder radius="sm">
          <Text size="xs" c="dimmed" tt="uppercase">
            Failed
          </Text>
          <Text size="xl" fw={700} c={failedCount > 0 ? "danger" : undefined}>
            {failedCount}
          </Text>
        </Card>
      </SimpleGrid>

      <DataTable
        columns={columns}
        data={jobs}
        loading={isLoading}
        rowKey={(job) => job.id}
        virtualized="auto"
        tableMaxHeight="62vh"
        emptyIcon={<IconPrinter size={36} />}
        emptyTitle="No print jobs"
        emptyDescription="Direct-dispatch print jobs will appear here."
      />
    </Stack>
  );
}

// ── Printers Tab ────────────────────────────────────────

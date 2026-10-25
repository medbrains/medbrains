/**
 * Admin → Research → Data exports. De-identified datasets for studies with
 * ethics (IEC) approval: one holder of the permission requests, a different
 * holder approves, and the files can be downloaded by the two of them for
 * 24 hours. Patients appear only under a key valid within one export; ages
 * are banded, dates are months, rare values and small groups are suppressed,
 * and restricted clinical classes are never included.
 */
import { Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useAuthStore } from "@medbrains/stores";
import { type NewResearchExport, P, type ResearchExport } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components";
import { Alert, Button, Modal, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { researchExportsService } from "@/services/researchExports.service";
import { ExportsTable } from "./research-exports/exports-table";
import { RequestForm } from "./research-exports/request-form";

const KEY = ["research-exports"];

/** Hand the browser a file to save. */
function save(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
}

export function ResearchExportsPage() {
  useRequirePermission(P.RESEARCH.DATASET.EXPORT);
  const userId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const list = useQuery({ queryKey: KEY, queryFn: researchExportsService.list });
  const refresh = () => qc.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: (values: NewResearchExport) => researchExportsService.create(values),
    onSuccess: () => {
      toast.success("Requested. A second approver must approve it.");
      close();
      refresh();
    },
  });
  const decide = useMutation({
    mutationFn: ({ row, action }: { row: ResearchExport; action: "approve" | "reject" }) =>
      action === "approve"
        ? researchExportsService.approve(row.id)
        : researchExportsService.reject(row.id),
    onSuccess: (row) => {
      toast.success(
        row.status === "ready"
          ? "Approved — the files are ready for 24 hours."
          : "Decision recorded.",
      );
      refresh();
    },
  });
  const download = useMutation({
    mutationFn: ({ row, file }: { row: ResearchExport; file: "data" | "dictionary" }) =>
      researchExportsService.file(row.id, file),
    onSuccess: (f) => save(f.filename, f.content),
  });
  const failure = create.error ?? decide.error ?? download.error;

  return (
    <Stack gap="md">
      <PageHeader
        title="Research data exports"
        subtitle="De-identified datasets for studies with ethics approval"
        actions={
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            New request
          </Button>
        }
      />
      <Alert tone="info">
        Each export needs the study's purpose and IEC approval, and a second person to approve it.
        Patients appear only under a key that works within one export; ages are in five-year bands,
        dates are months, values and groups shared by fewer than five patients are suppressed, and
        restricted clinical records are never included. Files can be downloaded by the requester and
        the approver for 24 hours, and every download is recorded.
      </Alert>
      {failure && (
        <Alert tone="danger" role="alert">
          {failure.message}
        </Alert>
      )}
      <ExportsTable
        exports={list.data}
        isLoading={list.isLoading}
        error={list.error}
        userId={userId}
        busy={decide.isPending}
        onDecide={(row, action) => decide.mutate({ row, action })}
        onDownload={(row, file) => download.mutate({ row, file })}
      />
      <Modal opened={opened} onClose={close} title="Request a research export" size="lg">
        <Text size="sm" c="dimmed" mb="sm">
          Ask only for what the study needs. The request waits for a second approver.
        </Text>
        <RequestForm
          submitting={create.isPending}
          onSubmit={(v) => create.mutate(v)}
          onCancel={close}
        />
      </Modal>
    </Stack>
  );
}

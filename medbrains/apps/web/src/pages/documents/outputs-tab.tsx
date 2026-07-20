// IPD OutputsTab — split from documents.tsx (pure move).

import { Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { DocumentOutput } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconEye, IconSearch, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { DocumentPreviewModal } from "@/components/DocumentPreview/DocumentPreviewModal";
import { Badge, type BadgeTone, IconButton, toast } from "@/components/ui";
import { confirmDestructive } from "@/lib/confirm";
import { documentsService } from "@/services/documents.service";
import { TEMPLATE_CATEGORIES } from "./shared";

const statusColors: Record<string, BadgeTone> = {
  draft: "neutral",
  generated: "primary",
  printed: "success",
  downloaded: "success",
  voided: "danger",
  superseded: "warning",
};

export function OutputsTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);

  const canVoid = useHasPermission(P.DOCUMENTS.VOID);

  const { data: outputs = [], isLoading } = useQuery({
    queryKey: ["document-outputs", filterCategory, filterStatus],
    queryFn: () =>
      documentsService.listDocumentOutputs({
        category: filterCategory ?? undefined,
        status: filterStatus ?? undefined,
      }),
  });

  const voidMutation = useMutation({
    mutationFn: (id: string) =>
      documentsService.voidDocumentOutput(id, { reason: "Voided by user" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document-outputs"] });
      toast.warning("Document has been voided", { title: "Document Voided" });
    },
  });

  const filtered = outputs.filter(
    (o) =>
      !search ||
      o.document_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.title?.toLowerCase().includes(search.toLowerCase()),
  );

  const columns = [
    {
      key: "document_number",
      label: "Doc #",
      render: (row: DocumentOutput) => (
        <Text size="sm" fw={500}>
          {row.document_number}
        </Text>
      ),
    },
    {
      key: "title",
      label: "Title",
      render: (row: DocumentOutput) => <Text size="sm">{row.title}</Text>,
    },
    {
      key: "category",
      label: "Category",
      render: (row: DocumentOutput) => (
        <Badge size="sm">{row.category?.replace(/_/g, " ") ?? "—"}</Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: DocumentOutput) => (
        <Badge size="sm" tone={statusColors[row.status] ?? "neutral"}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: "print_count",
      label: "Prints",
      render: (row: DocumentOutput) => (
        <Group gap={4}>
          <Text size="sm">{row.print_count}</Text>
          {row.watermark && row.watermark !== "none" && (
            <Badge size="xs" tone="warning">
              {row.watermark}
            </Badge>
          )}
        </Group>
      ),
    },
    {
      key: "module_code",
      label: "Module",
      render: (row: DocumentOutput) => <Text size="sm">{row.module_code ?? "—"}</Text>,
    },
    {
      key: "created_at",
      label: "Generated",
      render: (row: DocumentOutput) => (
        <Text size="sm">{new Date(row.created_at).toLocaleString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: DocumentOutput) => (
        <Group gap={4}>
          <IconButton size="sm" onClick={() => setPreviewDocId(row.id)} aria-label="View details">
            <IconEye size={14} />
          </IconButton>
          {canVoid && row.status !== "voided" && (
            <IconButton
              size="sm"
              tone="danger"
              onClick={() =>
                confirmDestructive({
                  title: "Void document",
                  message: "Void this document? This cannot be undone.",
                  onConfirm: () => voidMutation.mutate(row.id),
                })
              }
              loading={voidMutation.isPending}
              aria-label="Delete"
            >
              <IconTrash size={14} />
            </IconButton>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      <Stack gap="md">
        <Group>
          <TextInput
            placeholder="Search documents..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Select
            placeholder="Category"
            data={TEMPLATE_CATEGORIES}
            value={filterCategory}
            onChange={setFilterCategory}
            clearable
            w={180}
          />
          <Select
            placeholder="Status"
            data={[
              { value: "draft", label: "Draft" },
              { value: "generated", label: "Generated" },
              { value: "printed", label: "Printed" },
              { value: "downloaded", label: "Downloaded" },
              { value: "voided", label: "Voided" },
              { value: "superseded", label: "Superseded" },
            ]}
            value={filterStatus}
            onChange={setFilterStatus}
            clearable
            w={150}
          />
        </Group>

        <DataTable columns={columns} data={filtered} loading={isLoading} rowKey={(r) => r.id} />
      </Stack>

      {previewDocId && (
        <DocumentPreviewModal
          opened={!!previewDocId}
          onClose={() => setPreviewDocId(null)}
          documentOutputId={previewDocId}
          title="Document Preview"
        />
      )}
    </>
  );
}

// ── Review Schedule Tab ──────────────────────────────────

import {
  ActionIcon,
  Badge,
  Drawer,
  Group,
  Loader,
  Stack,
  Text,
} from "@mantine/core";
import { IconEye, IconPrinter } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { DocumentOutput } from "@medbrains/types";
import { useState } from "react";
import { DataTable } from "../../components";
import { DocumentPreviewModal } from "./DocumentPreviewModal";

interface DocumentHistoryProps {
  opened: boolean;
  onClose: () => void;
  patientId: string;
  title?: string;
}

const statusColors: Record<string, string> = {
  draft: "slate",
  generated: "primary",
  printed: "success",
  downloaded: "teal",
  voided: "danger",
  superseded: "orange",
};

export function DocumentHistory({
  opened,
  onClose,
  patientId,
  title = "Document History",
}: DocumentHistoryProps) {
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["document-outputs", "patient", patientId],
    queryFn: () => api.listPatientDocumentOutputs(patientId),
    enabled: opened && !!patientId,
  });

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
      render: (row: DocumentOutput) => (
        <Text size="sm">{row.title}</Text>
      ),
    },
    {
      key: "category",
      label: "Category",
      render: (row: DocumentOutput) => (
        <Badge size="sm" variant="light">
          {row.category?.replace(/_/g, " ") ?? "—"}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: DocumentOutput) => (
        <Badge
          size="sm"
          color={statusColors[row.status] ?? "slate"}
          variant="light"
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: "print_count",
      label: "Prints",
      render: (row: DocumentOutput) => (
        <Text size="sm">{row.print_count}</Text>
      ),
    },
    {
      key: "created_at",
      label: "Generated",
      render: (row: DocumentOutput) => (
        <Text size="sm">
          {new Date(row.created_at).toLocaleDateString()}
        </Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: DocumentOutput) => (
        <Group gap={4}>
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={() => setPreviewDocId(row.id)}
            aria-label="View details"
          >
            <IconEye size={14} />
          </ActionIcon>
          {row.status !== "voided" && (
            <ActionIcon variant="subtle" size="sm" color="primary" aria-label="Print">
              <IconPrinter size={14} />
            </ActionIcon>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      <Drawer
        opened={opened}
        onClose={onClose}
        title={title}
        position="right"
        size="lg"
      >
        {isLoading ? (
          <Stack align="center" py="xl">
            <Loader />
            <Text c="dimmed">Loading documents...</Text>
          </Stack>
        ) : documents.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            No documents found for this patient
          </Text>
        ) : (
          <DataTable
            columns={columns}
            data={documents}
            rowKey={(r) => r.id}
          />
        )}
      </Drawer>

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

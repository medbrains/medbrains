// QUALITY DocumentsTab — split from quality.tsx (pure move).

import {
  Checkbox,
  Drawer,
  Group,
  Modal,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateQualityDocumentRequest,
  PendingAckUser,
  QualityDocument,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconChecklist, IconHistory, IconPlus, IconPrinter } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Badge, Button, IconButton, Table, toast } from "@/components/ui";
import { qualityService } from "@/services/quality.service";
import { docStatusColors } from "./shared";

export function DocumentsTab() {
  const canManage = useHasPermission(P.QUALITY.DOCUMENTS_MANAGE);
  // Acknowledging a document is served under the list code, not the manage
  // one the tab holds.
  const canAcknowledge = useHasPermission(P.QUALITY.DOCUMENTS_LIST);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [ackModalOpened, { open: openAckModal, close: closeAckModal }] = useDisclosure(false);
  const [versionModalOpened, { open: openVersionModal, close: closeVersionModal }] =
    useDisclosure(false);
  const [ackDocId, setAckDocId] = useState<string | null>(null);
  const [versionDocCode, setVersionDocCode] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [trainingOnly, setTrainingOnly] = useState(false);

  const { data: pendingAcks = [], isLoading: acksLoading } = useQuery({
    queryKey: ["quality-pending-acks", ackDocId],
    queryFn: () => (ackDocId ? qualityService.listPendingAcks(ackDocId) : []),
    enabled: !!ackDocId,
  });

  const { data: versionHistory = [], isLoading: versionsLoading } = useQuery({
    queryKey: ["quality-document-versions", versionDocCode],
    queryFn: async () => {
      const allDocs = await qualityService.listQualityDocuments({});
      return allDocs.filter((d: QualityDocument) => d.document_number === versionDocCode);
    },
    enabled: !!versionDocCode,
  });

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["quality-documents", statusFilter, categoryFilter],
    queryFn: () =>
      qualityService.listQualityDocuments({
        status: statusFilter ?? undefined,
        category: categoryFilter ?? undefined,
      }),
  });

  const filteredDocuments = useMemo(
    () => (trainingOnly ? documents.filter((d) => d.is_training_required) : documents),
    [documents, trainingOnly],
  );

  const [form, setForm] = useState<CreateQualityDocumentRequest>({
    document_number: "",
    title: "",
    category: "",
  });

  const createMut = useMutation({
    mutationFn: (data: CreateQualityDocumentRequest) => qualityService.createQualityDocument(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-documents"] });
      toast.success("", { title: "Document created" });
      close();
      setForm({ document_number: "", title: "", category: "" });
    },
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      qualityService.updateDocumentStatus(id, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-documents"] });
      toast.success("", { title: "Status updated" });
    },
  });

  const acknowledgeMut = useMutation({
    mutationFn: (id: string) => qualityService.acknowledgeDocument(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-documents"] });
      toast.success("", { title: "Document acknowledged" });
    },
  });

  const statusTransitions: Record<string, string[]> = {
    draft: ["under_review"],
    under_review: ["approved", "draft"],
    approved: ["released"],
    released: ["revised", "obsolete"],
    revised: ["under_review"],
  };

  const columns = [
    {
      key: "document_number" as const,
      label: "Doc #",
      render: (d: QualityDocument) => <Text fw={500}>{d.document_number}</Text>,
    },
    { key: "title" as const, label: "Title", render: (d: QualityDocument) => d.title },
    { key: "category" as const, label: "Category", render: (d: QualityDocument) => d.category },
    {
      key: "version" as const,
      label: "Version",
      render: (d: QualityDocument) => `v${d.current_version}`,
    },
    {
      key: "status" as const,
      label: "Status",
      render: (d: QualityDocument) => (
        <Badge tone={docStatusColors[d.status] ?? "neutral"}>{d.status.replace(/_/g, " ")}</Badge>
      ),
    },
    {
      key: "review_date" as const,
      label: "Next Review",
      render: (d: QualityDocument) =>
        d.next_review_date ? new Date(d.next_review_date).toLocaleDateString() : "---",
    },
    {
      key: "training" as const,
      label: "Training",
      render: (d: QualityDocument) =>
        d.is_training_required ? (
          <Badge tone="warning" size="sm">
            Required
          </Badge>
        ) : (
          "---"
        ),
    },
    {
      key: "actions" as const,
      label: "Actions",
      render: (d: QualityDocument) => (
        <Group gap="xs">
          {canManage &&
            (statusTransitions[d.status] ?? []).map((nextStatus) => (
              <Tooltip key={nextStatus} label={nextStatus.replace(/_/g, " ")}>
                <Button
                  tone="secondary"
                  size="compact-xs"
                  loading={statusMut.isPending}
                  onClick={() => statusMut.mutate({ id: d.id, status: nextStatus })}
                >
                  {nextStatus.replace(/_/g, " ")}
                </Button>
              </Tooltip>
            ))}
          {d.status === "released" && (
            <>
              <Tooltip label="Acknowledge">
                <IconButton
                  tone="success"
                  disabled={!canAcknowledge}
                  onClick={() => acknowledgeMut.mutate(d.id)}
                  aria-label="Acknowledge"
                >
                  <IconChecklist size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip label="Pending Acknowledgments">
                <Badge
                  tone="warning"
                  size="sm"
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setAckDocId(d.id);
                    openAckModal();
                  }}
                >
                  Pending Acks
                </Badge>
              </Tooltip>
              <Tooltip label="Version History">
                <IconButton
                  tone="default"
                  onClick={() => {
                    setVersionDocCode(d.document_number);
                    openVersionModal();
                  }}
                  aria-label="Version History"
                >
                  <IconHistory size={16} />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Select
            placeholder="Status"
            data={["draft", "under_review", "approved", "released", "revised", "obsolete"]}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
            w={160}
          />
          <Select
            placeholder="Category"
            data={[...new Set(documents.map((d) => d.category))]}
            value={categoryFilter}
            onChange={setCategoryFilter}
            clearable
            w={160}
          />
          <Switch
            label="Training Required Only"
            checked={trainingOnly}
            onChange={(e) => setTrainingOnly(e.currentTarget.checked)}
            color="orange"
          />
          <Text c="dimmed" size="sm">
            {filteredDocuments.length} document(s)
          </Text>
        </Group>
        <Group>
          <Button
            tone="secondary"
            leftSection={<IconPrinter size={16} />}
            onClick={() => window.print()}
          >
            Print
          </Button>
          {canManage && (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
              New Document
            </Button>
          )}
        </Group>
      </Group>

      <DataTable
        columns={columns}
        data={filteredDocuments}
        loading={isLoading}
        rowKey={(d) => d.id}
        emptyTitle="No controlled documents"
        rowStyle={(d: QualityDocument) =>
          d.is_training_required
            ? { borderLeft: "4px solid var(--mantine-color-orange-5)" }
            : undefined
        }
      />

      <Drawer
        opened={opened}
        onClose={close}
        title="New Controlled Document"
        position="right"
        size="xl"
      >
        <Stack>
          <TextInput
            label="Document Number"
            required
            value={form.document_number}
            onChange={(e) => setForm({ ...form, document_number: e.currentTarget.value })}
          />
          <TextInput
            label="Title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.currentTarget.value })}
          />
          <Select
            label="Category"
            required
            data={["SOP", "Policy", "Protocol", "Guideline", "Manual", "Form", "Record", "Other"]}
            value={form.category}
            onChange={(v) => setForm({ ...form, category: v ?? "" })}
          />
          <Textarea
            label="Content"
            minRows={4}
            value={form.content ?? ""}
            onChange={(e) => setForm({ ...form, content: e.currentTarget.value || undefined })}
          />
          <Textarea
            label="Summary"
            value={form.summary ?? ""}
            onChange={(e) => setForm({ ...form, summary: e.currentTarget.value || undefined })}
          />
          <EmployeeSearchSelect
            label="Reviewer"
            value={form.reviewer_id ?? ""}
            onChange={(employeeId) => setForm({ ...form, reviewer_id: employeeId || undefined })}
          />
          <Checkbox
            label="Training Required"
            checked={form.is_training_required ?? false}
            onChange={(e) => setForm({ ...form, is_training_required: e.currentTarget.checked })}
          />
          <Button
            tone="primary"
            loading={createMut.isPending}
            onClick={() => createMut.mutate(form)}
          >
            Save
          </Button>
        </Stack>
      </Drawer>

      <Modal
        opened={ackModalOpened}
        onClose={() => {
          closeAckModal();
          setAckDocId(null);
        }}
        title="Pending Acknowledgments"
        size="md"
      >
        {acksLoading ? (
          <Text c="dimmed">Loading...</Text>
        ) : pendingAcks.length === 0 ? (
          <Text c="dimmed">All users have acknowledged this document.</Text>
        ) : (
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              {pendingAcks.length} user(s) have not yet acknowledged
            </Text>
            <Table withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>User ID</Table.Th>
                  <Table.Th>Name</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {pendingAcks.map((u: PendingAckUser) => (
                  <Table.Tr key={u.user_id}>
                    <Table.Td>{u.user_id.slice(0, 8)}...</Table.Td>
                    <Table.Td>{u.full_name}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        )}
      </Modal>

      <Modal
        opened={versionModalOpened}
        onClose={() => {
          closeVersionModal();
          setVersionDocCode(null);
        }}
        title="Version History"
        size="lg"
      >
        {versionsLoading ? (
          <Text c="dimmed">Loading...</Text>
        ) : versionHistory.length === 0 ? (
          <Text c="dimmed">No version history available.</Text>
        ) : (
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              {versionHistory.length} version(s) found for document {versionDocCode}
            </Text>
            <Table withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Version</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th>Changes</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {versionHistory
                  .sort(
                    (a: QualityDocument, b: QualityDocument) =>
                      b.current_version - a.current_version,
                  )
                  .map((doc: QualityDocument, idx: number) => {
                    const prevDoc =
                      idx < versionHistory.length - 1
                        ? (versionHistory[idx + 1] as QualityDocument)
                        : null;
                    const hasChanges =
                      prevDoc && (doc.content !== prevDoc.content || doc.title !== prevDoc.title);
                    return (
                      <Table.Tr key={doc.id}>
                        <Table.Td>
                          <Badge tone="primary">v{doc.current_version}</Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge tone={docStatusColors[doc.status] ?? "neutral"}>
                            {doc.status.replace(/_/g, " ")}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{new Date(doc.created_at).toLocaleDateString()}</Table.Td>
                        <Table.Td>
                          {hasChanges ? (
                            <Badge tone="warning" size="sm">
                              Modified
                            </Badge>
                          ) : idx === versionHistory.length - 1 ? (
                            <Text size="sm" c="dimmed">
                              Initial
                            </Text>
                          ) : (
                            <Text size="sm" c="dimmed">
                              No changes
                            </Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
              </Table.Tbody>
            </Table>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

// ── Incidents Tab ───────────────────────────────────────

// Radiology ExamsTab — the maker for the exam catalogue: which exams each
// modality performs and the charge code each bills under.

import { Group, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasAnyPermission, useHasPermission } from "@medbrains/stores";
import { P, type RadiologyExamListItem } from "@medbrains/types";
import { IconPencil, IconPlus, IconSearch, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components";
import { Alert, Badge, Button, IconButton, Input, Select, Table } from "@/components/ui";
import { confirmDestructive } from "@/lib/confirm";
import { contrastLabel, examPriceLabel } from "@/lib/radiology-exams";
import { searchErrorText } from "@/lib/search-error";
import { radiologyService } from "@/services/radiology.service";
import { EXAMS_QUERY_KEY, ExamFormDrawer } from "./exam-form-drawer";

// Literal until the permission catalogue is regenerated from Rust
// (crates/medbrains-core/src/permissions.rs `radiology::exams::MANAGE`).
const EXAMS_MANAGE = P.RADIOLOGY.EXAMS_MANAGE;
const LIST_LIMIT = 200;

export function ExamsTab() {
  const canView = useHasAnyPermission([
    P.RADIOLOGY.ORDERS.LIST,
    P.RADIOLOGY.ORDERS.CREATE,
    EXAMS_MANAGE,
  ]);
  const canManage = useHasPermission(EXAMS_MANAGE);
  const qc = useQueryClient();
  const [modalityId, setModalityId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search.trim(), 300);
  const [editing, setEditing] = useState<RadiologyExamListItem | "new" | null>(null);

  const { data: modalities = [] } = useQuery({
    queryKey: ["radiology-modalities"],
    queryFn: () => radiologyService.listRadiologyModalities(),
    enabled: canView,
  });
  const {
    data: exams = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: [...EXAMS_QUERY_KEY, modalityId, debounced],
    queryFn: () =>
      radiologyService.listRadiologyExams({
        modality_id: modalityId ?? undefined,
        search: debounced || undefined,
        include_inactive: true,
        limit: LIST_LIMIT,
      }),
    enabled: canView,
  });

  const retireMutation = useMutation({
    mutationFn: (id: string) => radiologyService.deleteRadiologyExam(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: EXAMS_QUERY_KEY });
      notifications.show({ title: "Exam retired", message: "", color: "success" });
    },
    onError: (e: Error) =>
      notifications.show({ title: "Could not retire exam", message: e.message, color: "danger" }),
  });

  if (!canView) {
    return <Alert tone="warning">You don't have access to the radiology exam catalogue.</Alert>;
  }

  const filtered = Boolean(modalityId || debounced);

  return (
    <>
      <PageHeader
        title="Imaging exams"
        subtitle="What each modality performs. An order can name its exam; billing uses the exam's charge code."
        actions={
          canManage ? (
            <Button
              tone="primary"
              size="xs"
              leftSection={<IconPlus size={16} />}
              onClick={() => setEditing("new")}
              disabled={modalities.length === 0}
            >
              Add exam
            </Button>
          ) : undefined
        }
      />
      <Group mb="md" grow>
        <Select
          label="Modality"
          placeholder="All modalities"
          data={modalities.map((m) => ({ value: m.id, label: `${m.code} — ${m.name}` }))}
          value={modalityId}
          onChange={setModalityId}
          clearable
        />
        <Input
          label="Search"
          placeholder="Code, name, short name or body part"
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
      </Group>

      {error && <Alert tone="danger">{searchErrorText(error, "imaging exams")}</Alert>}
      {!isLoading && !error && exams.length === 0 && (
        <Alert tone={filtered ? "info" : "warning"}>
          {filtered
            ? "No exam matches."
            : modalities.length === 0
              ? "Add the modalities first (Modalities tab), then the exams each performs."
              : "No exams set up yet — orders can still be placed by modality and body part."}
        </Alert>
      )}

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Code</Table.Th>
            <Table.Th>Exam</Table.Th>
            <Table.Th>Modality</Table.Th>
            <Table.Th>Body part</Table.Th>
            <Table.Th>Contrast</Table.Th>
            <Table.Th>Price</Table.Th>
            <Table.Th>Status</Table.Th>
            {canManage && <Table.Th>Actions</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading ? (
            <Table.Tr>
              <Table.Td colSpan={8}>
                <Text c="dimmed">Loading…</Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            exams.map((exam) => (
              <ExamRow
                key={exam.id}
                exam={exam}
                canManage={canManage}
                onEdit={() => setEditing(exam)}
                onRetire={() =>
                  confirmDestructive({
                    title: `Retire ${exam.name}?`,
                    message:
                      "It disappears from ordering. Past orders keep it. To pause it, edit it and switch off “Can be ordered”.",
                    confirmLabel: "Retire",
                    onConfirm: () => retireMutation.mutate(exam.id),
                  })
                }
              />
            ))
          )}
        </Table.Tbody>
      </Table>

      <ExamFormDrawer
        key={editing === null ? "closed" : editing === "new" ? "new" : editing.id}
        editing={editing}
        modalities={modalities}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

interface ExamRowProps {
  exam: RadiologyExamListItem;
  canManage: boolean;
  onEdit: () => void;
  onRetire: () => void;
}

function ExamRow({ exam, canManage, onEdit, onRetire }: ExamRowProps) {
  const price = examPriceLabel(exam);
  return (
    <Table.Tr>
      <Table.Td fw={600}>{exam.code}</Table.Td>
      <Table.Td>
        <Text size="sm">{exam.name}</Text>
        {exam.synonyms.length > 0 && (
          <Text size="xs" c="dimmed">
            {exam.synonyms.join(", ")}
          </Text>
        )}
      </Table.Td>
      <Table.Td>{exam.modality_code}</Table.Td>
      <Table.Td>{exam.body_part ?? "—"}</Table.Td>
      <Table.Td>{contrastLabel(exam.contrast)}</Table.Td>
      <Table.Td>
        {price.priced ? (
          <Text size="sm">{price.text}</Text>
        ) : (
          <Badge tone="warning" size="sm">
            {price.text}
          </Badge>
        )}
      </Table.Td>
      <Table.Td>
        <Badge tone={exam.is_active ? "success" : "neutral"} size="xs">
          {exam.is_active ? "Orderable" : "Paused"}
        </Badge>
      </Table.Td>
      {canManage && (
        <Table.Td>
          <Group gap="xs" wrap="nowrap">
            <IconButton aria-label={`Edit ${exam.name}`} onClick={onEdit}>
              <IconPencil size={16} />
            </IconButton>
            <IconButton tone="danger" aria-label={`Retire ${exam.name}`} onClick={onRetire}>
              <IconTrash size={16} />
            </IconButton>
          </Group>
        </Table.Td>
      )}
    </Table.Tr>
  );
}

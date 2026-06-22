import {
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateMrdRecordRequest,
  IssueMrdRecordRequest,
  MrdMedicalRecord,
  MrdRecordMovement,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconArrowBack, IconArrowRight, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button, IconButton } from "@/components/ui";
import { mrdService } from "@/services/mrd.service";
import { FILING_METHOD_OPTIONS, fmt, MRD_SHELF_OPTIONS, STATUS_COLORS } from "./mrdShared";

export function RecordsTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.MRD.RECORDS_CREATE);
  const canManage = useHasPermission(P.MRD.RECORDS_MANAGE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure();
  const [issueOpen, { open: openIssue, close: closeIssue }] = useDisclosure();
  const [movementsOpen, { open: openMovements, close: closeMovements }] = useDisclosure();
  const [selectedRecord, setSelectedRecord] = useState<MrdMedicalRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["mrd-records", statusFilter],
    queryFn: () => mrdService.listMrdRecords({ status: statusFilter ?? undefined }),
  });

  // Create
  const [createForm, setCreateForm] = useState<CreateMrdRecordRequest>({ patient_id: "" });
  const createMut = useMutation({
    mutationFn: (body: CreateMrdRecordRequest) => mrdService.createMrdRecord(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mrd-records"] });
      closeCreate();
      notifications.show({ title: "Created", message: "Medical record indexed", color: "success" });
    },
  });

  // Issue
  const [issueForm, setIssueForm] = useState<IssueMrdRecordRequest>({});
  const issueMut = useMutation({
    mutationFn: (body: IssueMrdRecordRequest) =>
      mrdService.issueMrdRecord(selectedRecord?.id ?? "", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mrd-records"] });
      closeIssue();
      notifications.show({ title: "Issued", message: "Record issued", color: "success" });
    },
  });

  // Movements
  const { data: movements = [] } = useQuery({
    queryKey: ["mrd-movements", selectedRecord?.id],
    queryFn: () => mrdService.listMrdMovements(selectedRecord?.id ?? ""),
    enabled: movementsOpen && !!selectedRecord,
  });

  const returnMut = useMutation({
    mutationFn: (movementId: string) =>
      mrdService.returnMrdRecord(selectedRecord?.id ?? "", movementId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mrd-movements"] });
      void qc.invalidateQueries({ queryKey: ["mrd-records"] });
      notifications.show({ title: "Returned", message: "Record returned", color: "success" });
    },
  });

  const columns: Column<MrdMedicalRecord>[] = [
    {
      key: "record_number",
      label: "Record #",
      render: (r) => <Text fw={600}>{r.record_number}</Text>,
    },
    {
      key: "record_type",
      label: "Type",
      render: (r) => <Badge tone="neutral">{r.record_type.toUpperCase()}</Badge>,
    },
    { key: "volume_number", label: "Vol", render: (r) => <Text>{r.volume_number}</Text> },
    {
      key: "shelf_location",
      label: "Shelf",
      render: (r) => <Text>{r.shelf_location ?? "—"}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <Badge tone={STATUS_COLORS[r.status] ?? "neutral"}>{r.status}</Badge>,
    },
    {
      key: "last_accessed_at",
      label: "Last Accessed",
      render: (r) => <Text size="sm">{fmt(r.last_accessed_at)}</Text>,
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Group gap={4}>
          {canManage && (
            <Tooltip label="Issue">
              <IconButton
                tone="default"
                onClick={() => {
                  setSelectedRecord(r);
                  setIssueForm({});
                  openIssue();
                }}
                aria-label="Issue"
              >
                <IconArrowRight size={16} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip label="Movements">
            <IconButton
              tone="primary"
              onClick={() => {
                setSelectedRecord(r);
                openMovements();
              }}
              aria-label="Movements"
            >
              <IconArrowBack size={16} />
            </IconButton>
          </Tooltip>
        </Group>
      ),
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select
          data={[
            { value: "", label: "All" },
            { value: "active", label: "Active" },
            { value: "archived", label: "Archived" },
            { value: "missing", label: "Missing" },
            { value: "destroyed", label: "Destroyed" },
          ]}
          value={statusFilter ?? ""}
          onChange={(v) => setStatusFilter(v || null)}
          placeholder="Filter status"
          w={200}
          clearable
        />
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Index Record
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={records} loading={isLoading} rowKey={(r) => r.id} />

      {/* Create Drawer */}
      <Drawer
        opened={createOpen}
        onClose={closeCreate}
        title="Index Medical Record"
        position="right"
        size="xl"
      >
        <Stack>
          <PatientSearchSelect
            value={createForm.patient_id}
            onChange={(v) => setCreateForm({ ...createForm, patient_id: v })}
            required
          />
          <PatientContextBanner patientId={createForm.patient_id} hideLoadingState />
          <Select
            label="Record Type"
            data={["opd", "ipd", "emergency"]}
            value={createForm.record_type ?? "opd"}
            onChange={(v) => setCreateForm({ ...createForm, record_type: v ?? "opd" })}
          />
          <NumberInput
            label="Volume"
            value={createForm.volume_number ?? 1}
            onChange={(v) => setCreateForm({ ...createForm, volume_number: Number(v) })}
            min={1}
          />
          <Select
            label="Shelf Location"
            placeholder="Select shelf/rack"
            data={MRD_SHELF_OPTIONS}
            value={createForm.shelf_location ?? null}
            onChange={(v) => setCreateForm({ ...createForm, shelf_location: v ?? undefined })}
            searchable
            clearable
          />
          <Select
            label="Filing Method"
            placeholder="Select filing method"
            data={FILING_METHOD_OPTIONS}
            value={createForm.filing_method ?? null}
            onChange={(v) => setCreateForm({ ...createForm, filing_method: v ?? undefined })}
            clearable
          />
          <NumberInput
            label="Total Pages"
            value={createForm.total_pages ?? undefined}
            onChange={(v) =>
              setCreateForm({ ...createForm, total_pages: v ? Number(v) : undefined })
            }
          />
          <Textarea
            label="Notes"
            value={createForm.notes ?? ""}
            onChange={(e) => setCreateForm({ ...createForm, notes: e.currentTarget.value })}
          />
          <Button
            tone="primary"
            onClick={() => createMut.mutate(createForm)}
            loading={createMut.isPending}
          >
            Create
          </Button>
        </Stack>
      </Drawer>

      {/* Issue Drawer */}
      <Drawer
        opened={issueOpen}
        onClose={closeIssue}
        title={`Issue: ${selectedRecord?.record_number ?? ""}`}
        position="right"
        size="xl"
      >
        <Stack>
          <EmployeeSearchSelect
            label="Issued To"
            value={issueForm.issued_to_user_id ?? ""}
            onChange={(id) => setIssueForm({ ...issueForm, issued_to_user_id: id || undefined })}
          />
          <DepartmentSelect
            value={issueForm.issued_to_department_id ?? ""}
            onChange={(id) =>
              setIssueForm({ ...issueForm, issued_to_department_id: id || undefined })
            }
          />
          <TextInput
            label="Purpose"
            value={issueForm.purpose ?? ""}
            onChange={(e) => setIssueForm({ ...issueForm, purpose: e.currentTarget.value })}
          />
          <NumberInput
            label="Due in (days)"
            value={issueForm.due_days ?? 7}
            onChange={(v) => setIssueForm({ ...issueForm, due_days: Number(v) })}
            min={1}
          />
          <Button
            tone="primary"
            onClick={() => issueMut.mutate(issueForm)}
            loading={issueMut.isPending}
          >
            Issue Record
          </Button>
        </Stack>
      </Drawer>

      {/* Movements Drawer */}
      <Drawer
        opened={movementsOpen}
        onClose={closeMovements}
        title={`Movements: ${selectedRecord?.record_number ?? ""}`}
        position="right"
        size="lg"
      >
        <DataTable
          columns={[
            {
              key: "issued_at",
              label: "Issued",
              render: (m: MrdRecordMovement) => <Text size="sm">{fmt(m.issued_at)}</Text>,
            },
            {
              key: "due_date",
              label: "Due",
              render: (m: MrdRecordMovement) => <Text size="sm">{fmt(m.due_date)}</Text>,
            },
            {
              key: "returned_at",
              label: "Returned",
              render: (m: MrdRecordMovement) => <Text size="sm">{fmt(m.returned_at)}</Text>,
            },
            {
              key: "status",
              label: "Status",
              render: (m: MrdRecordMovement) => (
                <Badge tone={STATUS_COLORS[m.status] ?? "neutral"}>{m.status}</Badge>
              ),
            },
            {
              key: "purpose",
              label: "Purpose",
              render: (m: MrdRecordMovement) => <Text size="sm">{m.purpose ?? "—"}</Text>,
            },
            {
              key: "action",
              label: "",
              render: (m: MrdRecordMovement) =>
                canManage && m.status === "issued" ? (
                  <Button
                    tone="secondary"
                    size="xs"
                    onClick={() => returnMut.mutate(m.id)}
                    loading={returnMut.isPending}
                  >
                    Return
                  </Button>
                ) : null,
            },
          ]}
          data={movements}
          loading={false}
          rowKey={(m) => m.id}
        />
      </Drawer>
    </>
  );
}

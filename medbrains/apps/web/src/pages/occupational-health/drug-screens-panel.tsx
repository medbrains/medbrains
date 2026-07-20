// IPD DrugScreensPanel — split from occupational-health.tsx (pure move).

import { Drawer, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { CreateDrugScreenRequest, OccHealthDrugScreen } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPencil, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import { occupationalHealthService } from "@/services/occupationalHealth.service";

const DRUG_SCREEN_STATUS_OPTIONS = [
  { value: "ordered", label: "Ordered" },
  { value: "collected", label: "Collected" },
  { value: "sent_to_lab", label: "Sent to Lab" },
  { value: "mro_review", label: "MRO Review" },
  { value: "positive", label: "Positive" },
  { value: "negative", label: "Negative" },
  { value: "inconclusive", label: "Inconclusive" },
  { value: "cancelled", label: "Cancelled" },
];

const DRUG_SCREEN_STATUS_COLORS: Record<string, BadgeTone> = {
  ordered: "neutral",
  collected: "primary",
  sent_to_lab: "info",
  mro_review: "warning",
  positive: "danger",
  negative: "success",
  inconclusive: "warning",
  cancelled: "neutral",
};

const DRUG_PANEL_OPTIONS = [
  { value: "standard_5", label: "Standard 5-Panel" },
  { value: "extended_10", label: "Extended 10-Panel" },
  { value: "custom", label: "Custom" },
];

export function DrugScreensPanel() {
  const canManage = useHasPermission(P.OCC_HEALTH.DRUG_SCREENS_MANAGE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);
  const [editOpen, editHandlers] = useDisclosure(false);
  const [selected, setSelected] = useState<OccHealthDrugScreen | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: screens = [], isLoading } = useQuery({
    queryKey: ["occ-drug-screens", statusFilter],
    queryFn: () =>
      occupationalHealthService.listDrugScreens(
        statusFilter ? { status: statusFilter } : undefined,
      ),
  });

  const [form, setForm] = useState<CreateDrugScreenRequest>({
    employee_id: "",
  });

  const [editForm, setEditForm] = useState<{
    status?: string;
    mro_decision?: string;
  }>({});

  const createMut = useMutation({
    mutationFn: () => occupationalHealthService.createDrugScreen(form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["occ-drug-screens"] });
      createHandlers.close();
      setForm({ employee_id: "" });
      notifications.show({
        title: "Drug Screen Created",
        message: "Drug screening order created successfully",
        color: "success",
      });
    },
  });

  const updateMut = useMutation({
    mutationFn: () => {
      if (!selected) return Promise.reject(new Error("No drug screen selected"));
      return occupationalHealthService.updateDrugScreen(selected.id, {
        status: editForm.status as OccHealthDrugScreen["status"],
        mro_decision: editForm.mro_decision,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["occ-drug-screens"] });
      editHandlers.close();
      setSelected(null);
      notifications.show({
        title: "Drug Screen Updated",
        message: "Drug screen status updated successfully",
        color: "success",
      });
    },
  });

  const columns: Column<OccHealthDrugScreen>[] = [
    {
      key: "employee_id",
      label: "Employee",
      render: (r) => (
        <Text size="sm" truncate style={{ maxWidth: 120 }}>
          {r.employee_id}
        </Text>
      ),
    },
    {
      key: "specimen_id",
      label: "Specimen ID",
      render: (r) => r.specimen_id ?? "---",
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge tone={DRUG_SCREEN_STATUS_COLORS[r.status] ?? "neutral"} variant="filled" size="sm">
          {DRUG_SCREEN_STATUS_OPTIONS.find((s) => s.value === r.status)?.label ?? r.status}
        </Badge>
      ),
    },
    {
      key: "panel",
      label: "Panel",
      render: (r) => DRUG_PANEL_OPTIONS.find((p) => p.value === r.panel)?.label ?? r.panel,
    },
    {
      key: "mro_decision",
      label: "MRO Decision",
      render: (r) => r.mro_decision ?? "---",
    },
    {
      key: "collected_at",
      label: "Collected",
      render: (r) => r.collected_at ?? "---",
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Group gap={4}>
          {canManage && (
            <IconButton
              tone="default"
              size="sm"
              onClick={() => {
                setSelected(r);
                setEditForm({
                  status: r.status,
                  mro_decision: r.mro_decision ?? "",
                });
                editHandlers.open();
              }}
              aria-label="Edit"
            >
              <IconPencil size={14} />
            </IconButton>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select
          placeholder="Filter by status"
          clearable
          data={DRUG_SCREEN_STATUS_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
          w={200}
        />
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={createHandlers.open}>
            New Drug Screen
          </Button>
        )}
      </Group>

      <DataTable columns={columns} data={screens} loading={isLoading} rowKey={(r) => r.id} />

      {/* Create Drawer */}
      <Drawer
        opened={createOpen}
        onClose={createHandlers.close}
        title="New Drug Screening"
        position="right"
        size="md"
      >
        <Stack>
          <EmployeeSearchSelect
            label="Employee"
            required
            value={form.employee_id}
            onChange={(employeeId) => setForm({ ...form, employee_id: employeeId })}
          />
          <TextInput
            label="Screening ID"
            description="Link to a health screening (optional)"
            value={form.screening_id ?? ""}
            onChange={(e) => setForm({ ...form, screening_id: e.currentTarget.value || undefined })}
          />
          <Select
            label="Panel"
            data={DRUG_PANEL_OPTIONS}
            value={form.panel ?? "standard_5"}
            onChange={(v) => setForm({ ...form, panel: v ?? undefined })}
          />
          <Button
            tone="primary"
            onClick={() => createMut.mutate()}
            loading={createMut.isPending}
            disabled={!form.employee_id}
          >
            Create Drug Screen
          </Button>
        </Stack>
      </Drawer>

      {/* Update Status Drawer */}
      <Drawer
        opened={editOpen}
        onClose={editHandlers.close}
        title="Update Drug Screen"
        position="right"
        size="md"
      >
        <Stack>
          <Select
            label="Status"
            data={DRUG_SCREEN_STATUS_OPTIONS}
            value={editForm.status ?? ""}
            onChange={(v) => setEditForm({ ...editForm, status: v ?? undefined })}
          />
          <TextInput
            label="MRO Decision"
            value={editForm.mro_decision ?? ""}
            onChange={(e) =>
              setEditForm({ ...editForm, mro_decision: e.currentTarget.value || undefined })
            }
          />
          <Button tone="primary" onClick={() => updateMut.mutate()} loading={updateMut.isPending}>
            Update Drug Screen
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 3 — Vaccinations
// ══════════════════════════════════════════════════════════

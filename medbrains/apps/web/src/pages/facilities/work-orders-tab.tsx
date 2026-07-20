// IPD WorkOrdersTab — split from facilities.tsx (pure move).

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
  CreateFmsWorkOrderRequest,
  FmsWorkOrder,
  SchedulePmRequest,
  UpdateFmsWorkOrderStatusRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCalendarRepeat, IconPencil, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import { facilitiesService } from "@/services/facilities.service";

const WO_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const WO_STATUSES = [
  { value: "open", label: "Open" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const MAINTENANCE_CATEGORIES = [
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "hvac", label: "HVAC" },
  { value: "civil", label: "Civil" },
  { value: "carpentry", label: "Carpentry" },
  { value: "painting", label: "Painting" },
  { value: "fire_safety", label: "Fire Safety" },
  { value: "elevator", label: "Elevator" },
  { value: "generator", label: "Generator/DG Set" },
  { value: "medical_gas", label: "Medical Gas" },
  { value: "water_treatment", label: "Water Treatment" },
  { value: "other", label: "Other" },
];

function priorityColor(p: string): BadgeTone {
  switch (p) {
    case "critical":
      return "danger";
    case "high":
      return "warning";
    case "medium":
      return "primary";
    default:
      return "neutral";
  }
}

function woStatusColor(s: string): BadgeTone {
  switch (s) {
    case "open":
      return "primary";
    case "assigned":
      return "info";
    case "in_progress":
      return "warning";
    case "on_hold":
      return "warning";
    case "completed":
      return "success";
    case "cancelled":
      return "neutral";
    default:
      return "neutral";
  }
}

export function WorkOrdersTab() {
  const canCreate = useHasPermission(P.FACILITIES.WORK_ORDERS_CREATE);
  const canManage = useHasPermission(P.FACILITIES.WORK_ORDERS_MANAGE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [statusOpen, { open: openStatus, close: closeStatus }] = useDisclosure(false);
  const [pmOpen, { open: openPm, close: closePm }] = useDisclosure(false);
  const [selectedWo, setSelectedWo] = useState<FmsWorkOrder | null>(null);
  const qc = useQueryClient();

  const orders = useQuery({
    queryKey: ["fms-work-orders"],
    queryFn: () => facilitiesService.listFmsWorkOrders(),
  });

  const [form, setForm] = useState<CreateFmsWorkOrderRequest>({ description: "" });
  const [statusForm, setStatusForm] = useState<UpdateFmsWorkOrderStatusRequest>({
    status: "assigned",
  });
  const [pmForm, setPmForm] = useState<SchedulePmRequest>({
    frequency: "monthly",
    start_date: new Date().toISOString().slice(0, 10),
  });

  const createWo = useMutation({
    mutationFn: () => facilitiesService.createFmsWorkOrder(form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fms-work-orders"] });
      closeCreate();
      notifications.show({ title: "Success", message: "Work order created" });
    },
  });
  const updateStatus = useMutation({
    mutationFn: () => {
      if (!selectedWo) return Promise.reject(new Error("No WO selected"));
      return facilitiesService.updateFmsWorkOrderStatus(selectedWo.id, statusForm);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fms-work-orders"] });
      closeStatus();
      notifications.show({ title: "Success", message: "Status updated" });
    },
  });
  const schedulePm = useMutation({
    mutationFn: () => facilitiesService.schedulePm(pmForm),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["fms-work-orders"] });
      closePm();
      notifications.show({
        title: "PM Scheduled",
        message: `${(res as { created: number }).created} work order(s) created`,
      });
    },
  });

  const cols: Column<FmsWorkOrder>[] = [
    {
      key: "work_order_number",
      label: "WO #",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.work_order_number}
        </Text>
      ),
    },
    {
      key: "category",
      label: "Category",
      render: (r) => <Text size="sm">{r.category ?? "—"}</Text>,
    },
    {
      key: "priority",
      label: "Priority",
      render: (r) => <Badge tone={priorityColor(r.priority)}>{r.priority}</Badge>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <Badge tone={woStatusColor(r.status)}>{r.status.replace(/_/g, " ")}</Badge>,
    },
    {
      key: "description",
      label: "Description",
      render: (r) => (
        <Text size="sm" lineClamp={1}>
          {r.description}
        </Text>
      ),
    },
    {
      key: "total_cost",
      label: "Cost",
      render: (r) => <Text size="sm">{r.total_cost != null ? `${r.total_cost}` : "—"}</Text>,
    },
    {
      key: "requested_at",
      label: "Requested",
      render: (r) => <Text size="sm">{new Date(r.requested_at).toLocaleDateString()}</Text>,
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canManage && r.status !== "completed" && r.status !== "cancelled" ? (
          <Tooltip label="Update Status">
            <IconButton
              onClick={() => {
                setSelectedWo(r);
                setStatusForm({ status: r.status === "open" ? "assigned" : "in_progress" });
                openStatus();
              }}
              aria-label="Edit"
            >
              <IconPencil size={16} />
            </IconButton>
          </Tooltip>
        ) : null,
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Infrastructure Work Orders
        </Text>
        <Group gap="xs">
          {canManage && (
            <Button
              tone="secondary"
              leftSection={<IconCalendarRepeat size={16} />}
              onClick={openPm}
            >
              Schedule PM
            </Button>
          )}
          {canCreate && (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
              Create Work Order
            </Button>
          )}
        </Group>
      </Group>
      <DataTable
        columns={cols}
        data={orders.data ?? []}
        loading={orders.isLoading}
        rowKey={(r) => r.id}
      />

      <Drawer
        opened={createOpen}
        onClose={closeCreate}
        title="Create Work Order"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Category"
            data={MAINTENANCE_CATEGORIES}
            placeholder="Select category"
            value={form.category ?? null}
            onChange={(v) => setForm({ ...form, category: v || undefined })}
            clearable
            searchable
          />
          <Select
            label="Priority"
            data={WO_PRIORITIES}
            value={form.priority ?? "medium"}
            onChange={(v) => setForm({ ...form, priority: v ?? "medium" })}
          />
          <Textarea
            label="Description"
            required
            minRows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value })}
          />
          <Textarea
            label="Notes"
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })}
          />
          <Button tone="primary" onClick={() => createWo.mutate()} loading={createWo.isPending}>
            Submit
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={statusOpen}
        onClose={closeStatus}
        title={`Update WO: ${selectedWo?.work_order_number ?? ""}`}
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Status"
            data={WO_STATUSES}
            value={statusForm.status}
            onChange={(v) =>
              setStatusForm({
                ...statusForm,
                status: (v ?? "assigned") as UpdateFmsWorkOrderStatusRequest["status"],
              })
            }
          />
          <Textarea
            label="Findings"
            value={statusForm.findings ?? ""}
            onChange={(e) => setStatusForm({ ...statusForm, findings: e.currentTarget.value })}
          />
          <Textarea
            label="Actions Taken"
            value={statusForm.actions_taken ?? ""}
            onChange={(e) => setStatusForm({ ...statusForm, actions_taken: e.currentTarget.value })}
          />
          <NumberInput
            label="Vendor Cost"
            value={statusForm.vendor_cost ?? ""}
            onChange={(v) =>
              setStatusForm({ ...statusForm, vendor_cost: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Material Cost"
            value={statusForm.material_cost ?? ""}
            onChange={(v) =>
              setStatusForm({ ...statusForm, material_cost: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Labor Cost"
            value={statusForm.labor_cost ?? ""}
            onChange={(v) =>
              setStatusForm({ ...statusForm, labor_cost: typeof v === "number" ? v : undefined })
            }
          />
          <Textarea
            label="Notes"
            value={statusForm.notes ?? ""}
            onChange={(e) => setStatusForm({ ...statusForm, notes: e.currentTarget.value })}
          />
          <Button
            tone="primary"
            onClick={() => updateStatus.mutate()}
            loading={updateStatus.isPending}
          >
            Update
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={pmOpen}
        onClose={closePm}
        title="Schedule Preventive Maintenance"
        position="right"
        size="xl"
      >
        <Stack>
          <TextInput
            label="Equipment IDs (comma-separated)"
            placeholder="e.g. id1, id2, id3"
            onChange={(e) => {
              const ids = e.currentTarget.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              setPmForm({ ...pmForm, equipment_ids: ids.length > 0 ? ids : undefined });
            }}
          />
          <Select
            label="Frequency"
            data={[
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
              { value: "biweekly", label: "Bi-Weekly" },
              { value: "monthly", label: "Monthly" },
              { value: "quarterly", label: "Quarterly" },
              { value: "semi_annual", label: "Semi-Annual" },
              { value: "annual", label: "Annual" },
            ]}
            value={pmForm.frequency}
            onChange={(v) => setPmForm({ ...pmForm, frequency: v ?? "monthly" })}
          />
          <TextInput
            label="Start Date"
            type="date"
            value={pmForm.start_date}
            onChange={(e) => setPmForm({ ...pmForm, start_date: e.currentTarget.value })}
          />
          <Button
            tone="primary"
            onClick={() => schedulePm.mutate()}
            loading={schedulePm.isPending}
            disabled={!pmForm.start_date || !pmForm.frequency}
          >
            Schedule
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

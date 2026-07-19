// IPD EquipmentTab — split from bme.tsx (pure move).

import {
  Drawer,
  Group,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { BmeEquipment, CreateBmeEquipmentRequest } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPencil, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import { bmeService } from "@/services/bme.service";
import { fmtDate } from "./shared";

const RISK_CATEGORIES = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const EQUIPMENT_CATEGORIES = [
  { value: "diagnostic", label: "Diagnostic Equipment" },
  { value: "therapeutic", label: "Therapeutic Equipment" },
  { value: "life_support", label: "Life Support" },
  { value: "imaging", label: "Imaging Equipment" },
  { value: "laboratory", label: "Laboratory Equipment" },
  { value: "surgical", label: "Surgical Equipment" },
  { value: "monitoring", label: "Monitoring Equipment" },
  { value: "dental", label: "Dental Equipment" },
  { value: "physiotherapy", label: "Physiotherapy Equipment" },
  { value: "dialysis", label: "Dialysis Equipment" },
  { value: "ophthalmic", label: "Ophthalmic Equipment" },
  { value: "ent", label: "ENT Equipment" },
  { value: "sterilization", label: "Sterilization Equipment" },
  { value: "other", label: "Other" },
];

function statusBadge(status: string) {
  const map: Record<string, BadgeTone> = {
    active: "success",
    under_maintenance: "warning",
    out_of_service: "warning",
    condemned: "danger",
    disposed: "neutral",
  };
  return (
    <Badge tone={map[status] ?? "neutral"} variant="light" size="sm">
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function riskBadge(risk: string) {
  const map: Record<string, BadgeTone> = {
    critical: "danger",
    high: "warning",
    medium: "warning",
    low: "success",
  };
  return (
    <Badge tone={map[risk] ?? "neutral"} variant="light" size="sm">
      {risk}
    </Badge>
  );
}

export function EquipmentTab() {
  const canCreate = useHasPermission(P.BME.EQUIPMENT_CREATE);
  const canUpdate = useHasPermission(P.BME.EQUIPMENT_UPDATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [editItem, setEditItem] = useState<BmeEquipment | null>(null);
  const [form, setForm] = useState<CreateBmeEquipmentRequest>({ name: "" });

  const { data = [], isLoading } = useQuery({
    queryKey: ["bme-equipment"],
    queryFn: () => bmeService.listBmeEquipment(),
  });

  const createMut = useMutation({
    mutationFn: (body: CreateBmeEquipmentRequest) => bmeService.createBmeEquipment(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bme-equipment"] });
      close();
      notifications.show({ message: "Equipment created" });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      bmeService.updateBmeEquipment(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bme-equipment"] });
      close();
      setEditItem(null);
      notifications.show({ message: "Equipment updated" });
    },
  });

  function openCreate() {
    setEditItem(null);
    setForm({ name: "" });
    open();
  }
  function openEdit(item: BmeEquipment) {
    setEditItem(item);
    setForm({
      name: item.name,
      make: item.make ?? undefined,
      model: item.model ?? undefined,
      serial_number: item.serial_number ?? undefined,
      asset_tag: item.asset_tag ?? undefined,
      category: item.category ?? undefined,
      risk_category: item.risk_category,
      is_critical: item.is_critical,
      department_id: item.department_id ?? undefined,
      vendor_id: item.vendor_id ?? undefined,
      notes: item.notes ?? undefined,
    });
    open();
  }

  function handleSubmit() {
    if (editItem) {
      updateMut.mutate({ id: editItem.id, body: form as unknown as Record<string, unknown> });
    } else {
      createMut.mutate(form);
    }
  }

  const columns: Column<BmeEquipment>[] = [
    {
      key: "name",
      label: "Name",
      render: (r) => (
        <Text fw={500} size="sm">
          {r.name}
        </Text>
      ),
    },
    {
      key: "make_model",
      label: "Make / Model",
      render: (r) => <Text size="sm">{[r.make, r.model].filter(Boolean).join(" / ") || "—"}</Text>,
    },
    {
      key: "serial_number",
      label: "Serial #",
      render: (r) => <Text size="sm">{r.serial_number ?? "—"}</Text>,
    },
    {
      key: "asset_tag",
      label: "Asset Tag",
      render: (r) => <Text size="sm">{r.asset_tag ?? "—"}</Text>,
    },
    { key: "risk_category", label: "Risk", render: (r) => riskBadge(r.risk_category) },
    { key: "status", label: "Status", render: (r) => statusBadge(r.status) },
    {
      key: "warranty_end",
      label: "Warranty Until",
      render: (r) => <Text size="sm">{fmtDate(r.warranty_end_date)}</Text>,
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canUpdate ? (
          <Tooltip label="Edit">
            <IconButton size="sm" onClick={() => openEdit(r)} aria-label="Edit">
              <IconPencil size={16} />
            </IconButton>
          </Tooltip>
        ) : null,
    },
  ];

  return (
    <Stack>
      <Group justify="flex-end">
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Add Equipment
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer
        opened={opened}
        onClose={close}
        title={editItem ? "Edit Equipment" : "Add Equipment"}
        position="right"
        size="lg"
      >
        <Stack>
          <TextInput
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Group grow>
            <TextInput
              label="Make"
              value={form.make ?? ""}
              onChange={(e) => setForm({ ...form, make: e.target.value })}
            />
            <TextInput
              label="Model"
              value={form.model ?? ""}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
          </Group>
          <Group grow>
            <TextInput
              label="Serial Number"
              value={form.serial_number ?? ""}
              onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
            />
            <TextInput
              label="Asset Tag"
              value={form.asset_tag ?? ""}
              onChange={(e) => setForm({ ...form, asset_tag: e.target.value })}
            />
          </Group>
          <Group grow>
            <Select
              label="Category"
              data={EQUIPMENT_CATEGORIES}
              value={form.category ?? null}
              onChange={(v) => setForm({ ...form, category: v || undefined })}
              clearable
              searchable
            />
            <Select
              label="Risk Category"
              data={RISK_CATEGORIES}
              value={form.risk_category ?? "medium"}
              onChange={(v) =>
                setForm({
                  ...form,
                  risk_category: (v ?? "medium") as CreateBmeEquipmentRequest["risk_category"],
                })
              }
            />
          </Group>
          <Switch
            label="Critical Equipment"
            checked={form.is_critical ?? false}
            onChange={(e) => setForm({ ...form, is_critical: e.currentTarget.checked })}
          />
          <Textarea
            label="Notes"
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <Button
            tone="primary"
            onClick={handleSubmit}
            loading={createMut.isPending || updateMut.isPending}
          >
            {editItem ? "Update" : "Create"}
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  PM & Work Orders Tab
// ══════════════════════════════════════════════════════════

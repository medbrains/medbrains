// IPD BreakdownsTab — split from bme.tsx (pure move).

import { Drawer, Group, Select, Stack, Switch, Text, Textarea, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  BmeBreakdown,
  CreateBmeBreakdownRequest,
  UpdateBmeBreakdownStatusRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import { bmeService } from "@/services/bme.service";
import { BREAKDOWN_PRIORITIES, fmtDate, priorityBadge } from "./shared";

function breakdownStatusBadge(s: string) {
  const map: Record<string, BadgeTone> = {
    reported: "danger",
    acknowledged: "warning",
    in_progress: "primary",
    parts_awaited: "warning",
    resolved: "success",
    closed: "neutral",
  };
  return (
    <Badge tone={map[s] ?? "neutral"} variant="light" size="sm">
      {s.replace(/_/g, " ")}
    </Badge>
  );
}

export function BreakdownsTab() {
  const canCreate = useHasPermission(P.BME.BREAKDOWNS_CREATE);
  const canManage = useHasPermission(P.BME.BREAKDOWNS_MANAGE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<CreateBmeBreakdownRequest>({
    equipment_id: "",
    description: "",
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["bme-breakdowns"],
    queryFn: () => bmeService.listBmeBreakdowns(),
  });

  const { data: equipment = [] } = useQuery({
    queryKey: ["bme-equipment"],
    queryFn: () => bmeService.listBmeEquipment(),
  });
  const equipOptions = equipment.map((e) => ({
    value: e.id,
    label: `${e.name} (${e.asset_tag ?? "—"})`,
  }));

  const createMut = useMutation({
    mutationFn: (body: CreateBmeBreakdownRequest) => bmeService.createBmeBreakdown(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bme-breakdowns"] });
      void qc.invalidateQueries({ queryKey: ["bme-stats"] });
      close();
      notifications.show({ message: "Breakdown reported" });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateBmeBreakdownStatusRequest }) =>
      bmeService.updateBmeBreakdownStatus(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bme-breakdowns"] });
      void qc.invalidateQueries({ queryKey: ["bme-stats"] });
      notifications.show({ message: "Status updated" });
    },
  });

  function nextStatus(current: string): string | null {
    const flow: Record<string, string> = {
      reported: "acknowledged",
      acknowledged: "in_progress",
      in_progress: "resolved",
      parts_awaited: "in_progress",
      resolved: "closed",
    };
    return flow[current] ?? null;
  }

  const columns: Column<BmeBreakdown>[] = [
    {
      key: "equipment",
      label: "Equipment",
      render: (r) => (
        <Text size="sm" fw={500}>
          {equipment.find((e) => e.id === r.equipment_id)?.name ?? "—"}
        </Text>
      ),
    },
    { key: "priority", label: "Priority", render: (r) => priorityBadge(r.priority) },
    { key: "status", label: "Status", render: (r) => breakdownStatusBadge(r.status) },
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
      key: "reported",
      label: "Reported",
      render: (r) => <Text size="sm">{fmtDate(r.reported_at)}</Text>,
    },
    {
      key: "downtime",
      label: "Downtime (min)",
      render: (r) => <Text size="sm">{r.downtime_minutes ?? "—"}</Text>,
    },
    {
      key: "cost",
      label: "Repair Cost",
      render: (r) => (
        <Text size="sm">
          {r.total_repair_cost ? `₹${Number(r.total_repair_cost).toLocaleString()}` : "—"}
        </Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) => {
        const ns = nextStatus(r.status);
        if (!canManage || !ns) return null;
        return (
          <Tooltip label={`Move to ${ns.replace(/_/g, " ")}`}>
            <IconButton
              tone="primary"
              size="sm"
              onClick={() =>
                updateMut.mutate({
                  id: r.id,
                  body: { status: ns as UpdateBmeBreakdownStatusRequest["status"] },
                })
              }
              aria-label="Confirm"
            >
              <IconCheck size={16} />
            </IconButton>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <Stack>
      <Group justify="flex-end">
        {canCreate && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setForm({ equipment_id: "", description: "" });
              open();
            }}
          >
            Report Breakdown
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer opened={opened} onClose={close} title="Report Breakdown" position="right" size="xl">
        <Stack>
          <Select
            label="Equipment"
            required
            data={equipOptions}
            value={form.equipment_id}
            onChange={(v) => setForm({ ...form, equipment_id: v ?? "" })}
            searchable
          />
          <Select
            label="Priority"
            data={BREAKDOWN_PRIORITIES}
            value={form.priority ?? "medium"}
            onChange={(v) =>
              setForm({
                ...form,
                priority: (v ?? "medium") as CreateBmeBreakdownRequest["priority"],
              })
            }
          />
          <Textarea
            label="Description"
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            minRows={3}
          />
          <Switch
            label="Vendor Visit Required"
            checked={form.vendor_visit_required ?? false}
            onChange={(e) => setForm({ ...form, vendor_visit_required: e.currentTarget.checked })}
          />
          <Textarea
            label="Notes"
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <Button
            tone="primary"
            onClick={() => createMut.mutate(form)}
            loading={createMut.isPending}
          >
            Report
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Analytics Tab
// ══════════════════════════════════════════════════════════

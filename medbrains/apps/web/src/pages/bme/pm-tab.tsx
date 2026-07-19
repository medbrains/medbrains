// IPD PmTab — split from bme.tsx (pure move).

import { BarChart } from "@mantine/charts";
import {
  Card,
  Drawer,
  Group,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  BmePmSchedule,
  BmeStatsResponse,
  BmeWorkOrder,
  CreateBmePmScheduleRequest,
  CreateBmeWorkOrderRequest,
  UpdateBmeWorkOrderStatusRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import { bmeService } from "@/services/bme.service";
import { BREAKDOWN_PRIORITIES, fmtDate, PM_FREQUENCIES, priorityBadge } from "./shared";

const WORK_ORDER_TYPES = [
  { value: "preventive", label: "Preventive" },
  { value: "corrective", label: "Corrective" },
  { value: "calibration", label: "Calibration" },
  { value: "installation", label: "Installation" },
  { value: "inspection", label: "Inspection" },
];

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function woStatusBadge(s: string) {
  const map: Record<string, BadgeTone> = {
    open: "primary",
    assigned: "warning",
    in_progress: "warning",
    completed: "success",
    cancelled: "neutral",
  };
  return (
    <Badge tone={map[s] ?? "neutral"} variant="light" size="sm">
      {s.replace(/_/g, " ")}
    </Badge>
  );
}

export function PmTab() {
  const canManage = useHasPermission(P.BME.PM_MANAGE);
  const qc = useQueryClient();
  const [pmOpened, { open: openPm, close: closePm }] = useDisclosure(false);
  const [woOpened, { open: openWo, close: closeWo }] = useDisclosure(false);
  const [pmForm, setPmForm] = useState<CreateBmePmScheduleRequest>({
    equipment_id: "",
    frequency: "quarterly",
  });
  const [woForm, setWoForm] = useState<CreateBmeWorkOrderRequest>({
    equipment_id: "",
    order_type: "preventive",
  });

  const { data: schedules = [], isLoading: loadingPm } = useQuery({
    queryKey: ["bme-pm-schedules"],
    queryFn: () => bmeService.listBmePmSchedules(),
  });

  const { data: workOrders = [], isLoading: loadingWo } = useQuery({
    queryKey: ["bme-work-orders"],
    queryFn: () => bmeService.listBmeWorkOrders(),
  });

  const { data: equipment = [] } = useQuery({
    queryKey: ["bme-equipment"],
    queryFn: () => bmeService.listBmeEquipment(),
  });

  const { data: stats } = useQuery<BmeStatsResponse>({
    queryKey: ["bme-stats"],
    queryFn: () => bmeService.getBmeStats(),
  });

  const equipOptions = equipment.map((e) => ({
    value: e.id,
    label: `${e.name} (${e.asset_tag ?? e.serial_number ?? "—"})`,
  }));

  const createPmMut = useMutation({
    mutationFn: (body: CreateBmePmScheduleRequest) => bmeService.createBmePmSchedule(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bme-pm-schedules"] });
      closePm();
      notifications.show({ message: "PM schedule created" });
    },
  });

  const createWoMut = useMutation({
    mutationFn: (body: CreateBmeWorkOrderRequest) => bmeService.createBmeWorkOrder(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bme-work-orders"] });
      closeWo();
      notifications.show({ message: "Work order created" });
    },
  });

  const updateWoMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateBmeWorkOrderStatusRequest }) =>
      bmeService.updateBmeWorkOrderStatus(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bme-work-orders"] });
      void qc.invalidateQueries({ queryKey: ["bme-pm-schedules"] });
      void qc.invalidateQueries({ queryKey: ["bme-stats"] });
      notifications.show({ message: "Work order updated" });
    },
  });

  const pmColumns: Column<BmePmSchedule>[] = [
    {
      key: "equipment",
      label: "Equipment",
      render: (r) => (
        <Text size="sm">
          {equipment.find((e) => e.id === r.equipment_id)?.name ?? r.equipment_id}
        </Text>
      ),
    },
    {
      key: "frequency",
      label: "Frequency",
      render: (r) => (
        <Badge tone="neutral" variant="light" size="sm">
          {r.frequency.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "next_due",
      label: "Next Due",
      render: (r) => {
        const overdue = r.next_due_date && new Date(r.next_due_date) < new Date();
        return (
          <Text size="sm" c={overdue ? "danger" : undefined} fw={overdue ? 700 : undefined}>
            {fmtDate(r.next_due_date)}
          </Text>
        );
      },
    },
    {
      key: "last_completed",
      label: "Last Done",
      render: (r) => <Text size="sm">{fmtDate(r.last_completed_date)}</Text>,
    },
    {
      key: "active",
      label: "Active",
      render: (r) =>
        r.is_active ? (
          <Badge tone="success" size="sm">
            Yes
          </Badge>
        ) : (
          <Badge tone="neutral" size="sm">
            No
          </Badge>
        ),
    },
  ];

  const woColumns: Column<BmeWorkOrder>[] = [
    {
      key: "wo_number",
      label: "WO #",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.work_order_number}
        </Text>
      ),
    },
    {
      key: "equipment",
      label: "Equipment",
      render: (r) => (
        <Text size="sm">{equipment.find((e) => e.id === r.equipment_id)?.name ?? "—"}</Text>
      ),
    },
    {
      key: "type",
      label: "Type",
      render: (r) => (
        <Badge tone="neutral" variant="light" size="sm">
          {r.order_type}
        </Badge>
      ),
    },
    { key: "priority", label: "Priority", render: (r) => priorityBadge(r.priority) },
    { key: "status", label: "Status", render: (r) => woStatusBadge(r.status) },
    {
      key: "scheduled",
      label: "Scheduled",
      render: (r) => <Text size="sm">{fmtDate(r.scheduled_date)}</Text>,
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canManage && r.status !== "completed" && r.status !== "cancelled" ? (
          <Tooltip label="Mark Completed">
            <IconButton
              tone="success"
              size="sm"
              onClick={() => updateWoMut.mutate({ id: r.id, body: { status: "completed" } })}
              aria-label="Confirm"
            >
              <IconCheck size={16} />
            </IconButton>
          </Tooltip>
        ) : null,
    },
  ];

  const pmCompliance = useMemo(() => {
    const now = new Date();
    const total = schedules.filter((s) => s.is_active).length;
    const overdue = schedules.filter(
      (s) => s.is_active && s.next_due_date && new Date(s.next_due_date) < now,
    ).length;
    const completedOnTime = schedules.filter((s) => s.is_active && s.last_completed_date).length;
    const complianceRate = total > 0 ? Math.round((completedOnTime / total) * 100) : 0;

    // Build last 6 months bar chart data from work orders
    const months: { month: string; scheduled: number; completed: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = monthLabel(d);
      const monthStart = d.getTime();
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime();
      const scheduledCount = workOrders.filter(
        (wo) =>
          wo.order_type === "preventive" &&
          wo.scheduled_date &&
          new Date(wo.scheduled_date).getTime() >= monthStart &&
          new Date(wo.scheduled_date).getTime() <= monthEnd,
      ).length;
      const completedCount = workOrders.filter(
        (wo) =>
          wo.order_type === "preventive" &&
          wo.status === "completed" &&
          wo.completed_at &&
          new Date(wo.completed_at).getTime() >= monthStart &&
          new Date(wo.completed_at).getTime() <= monthEnd,
      ).length;
      months.push({ month: label, scheduled: scheduledCount, completed: completedCount });
    }
    return { total, overdue, completedOnTime, complianceRate, months };
  }, [schedules, workOrders]);

  return (
    <Stack>
      {stats && (
        <SimpleGrid cols={{ base: 2, sm: 3 }}>
          <Card withBorder p="sm">
            <Text size="xs" c="dimmed">
              PM Overdue
            </Text>
            <Text size="xl" fw={700} c={stats.pm_overdue > 0 ? "danger" : "success"}>
              {stats.pm_overdue}
            </Text>
          </Card>
          <Card withBorder p="sm">
            <Text size="xs" c="dimmed">
              Open Breakdowns
            </Text>
            <Text size="xl" fw={700} c={stats.open_breakdowns > 0 ? "orange" : "success"}>
              {stats.open_breakdowns}
            </Text>
          </Card>
          <Card withBorder p="sm">
            <Text size="xs" c="dimmed">
              Expiring Contracts
            </Text>
            <Text size="xl" fw={700} c={stats.expiring_contracts > 0 ? "warning" : "success"}>
              {stats.expiring_contracts}
            </Text>
          </Card>
        </SimpleGrid>
      )}

      <Card withBorder p="md">
        <Text fw={600} size="lg" mb="sm">
          PM Compliance Dashboard
        </Text>
        <SimpleGrid cols={{ base: 2, sm: 4 }} mb="md">
          <Card withBorder p="sm" bg="blue.0">
            <Text size="xs" c="dimmed">
              Total Scheduled
            </Text>
            <Text size="xl" fw={700}>
              {pmCompliance.total}
            </Text>
          </Card>
          <Card withBorder p="sm" bg="green.0">
            <Text size="xs" c="dimmed">
              Completed On Time
            </Text>
            <Text size="xl" fw={700} c="success">
              {pmCompliance.completedOnTime}
            </Text>
          </Card>
          <Card withBorder p="sm" bg="red.0">
            <Text size="xs" c="dimmed">
              Overdue
            </Text>
            <Text size="xl" fw={700} c="danger">
              {pmCompliance.overdue}
            </Text>
          </Card>
          <Card withBorder p="sm">
            <Text size="xs" c="dimmed">
              Compliance Rate
            </Text>
            <Text
              size="xl"
              fw={700}
              c={
                pmCompliance.complianceRate >= 80
                  ? "success"
                  : pmCompliance.complianceRate >= 50
                    ? "warning"
                    : "danger"
              }
            >
              {pmCompliance.complianceRate}%
            </Text>
            <Progress
              value={pmCompliance.complianceRate}
              color={
                pmCompliance.complianceRate >= 80
                  ? "success"
                  : pmCompliance.complianceRate >= 50
                    ? "warning"
                    : "danger"
              }
              size="sm"
              mt={4}
            />
          </Card>
        </SimpleGrid>
        {pmCompliance.months.some((m) => m.scheduled > 0 || m.completed > 0) && (
          <>
            <Text size="sm" fw={500} mb="xs">
              Scheduled vs Completed PMs (Last 6 Months)
            </Text>
            <BarChart
              h={250}
              data={pmCompliance.months}
              dataKey="month"
              series={[
                { name: "scheduled", color: "blue.6", label: "Scheduled" },
                { name: "completed", color: "green.6", label: "Completed" },
              ]}
              withLegend
              withTooltip
            />
          </>
        )}
      </Card>

      <Text fw={600} size="lg">
        PM Schedules
      </Text>
      <Group justify="flex-end">
        {canManage && (
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              setPmForm({ equipment_id: "", frequency: "quarterly" });
              openPm();
            }}
          >
            Add PM Schedule
          </Button>
        )}
      </Group>
      <DataTable columns={pmColumns} data={schedules} loading={loadingPm} rowKey={(r) => r.id} />

      <Text fw={600} size="lg" mt="md">
        Work Orders
      </Text>
      <Group justify="flex-end">
        {canManage && (
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              setWoForm({ equipment_id: "", order_type: "preventive" });
              openWo();
            }}
          >
            Create Work Order
          </Button>
        )}
      </Group>
      <DataTable columns={woColumns} data={workOrders} loading={loadingWo} rowKey={(r) => r.id} />

      <Drawer
        opened={pmOpened}
        onClose={closePm}
        title="Add PM Schedule"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Equipment"
            required
            data={equipOptions}
            value={pmForm.equipment_id}
            onChange={(v) => setPmForm({ ...pmForm, equipment_id: v ?? "" })}
            searchable
          />
          <Select
            label="Frequency"
            required
            data={PM_FREQUENCIES}
            value={pmForm.frequency}
            onChange={(v) =>
              setPmForm({
                ...pmForm,
                frequency: (v ?? "quarterly") as CreateBmePmScheduleRequest["frequency"],
              })
            }
          />
          <DateInput
            label="Next Due Date"
            value={pmForm.next_due_date ?? null}
            onChange={(d) => setPmForm({ ...pmForm, next_due_date: d?.slice(0, 10) })}
          />
          <Textarea
            label="Notes"
            value={pmForm.notes ?? ""}
            onChange={(e) => setPmForm({ ...pmForm, notes: e.target.value })}
          />
          <Button
            tone="primary"
            onClick={() => createPmMut.mutate(pmForm)}
            loading={createPmMut.isPending}
          >
            Create
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={woOpened}
        onClose={closeWo}
        title="Create Work Order"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Equipment"
            required
            data={equipOptions}
            value={woForm.equipment_id}
            onChange={(v) => setWoForm({ ...woForm, equipment_id: v ?? "" })}
            searchable
          />
          <Select
            label="Type"
            required
            data={WORK_ORDER_TYPES}
            value={woForm.order_type}
            onChange={(v) =>
              setWoForm({
                ...woForm,
                order_type: (v ?? "preventive") as CreateBmeWorkOrderRequest["order_type"],
              })
            }
          />
          <Select
            label="Priority"
            data={BREAKDOWN_PRIORITIES}
            value={woForm.priority ?? "medium"}
            onChange={(v) =>
              setWoForm({
                ...woForm,
                priority: (v ?? "medium") as CreateBmeWorkOrderRequest["priority"],
              })
            }
          />
          <DateInput
            label="Scheduled Date"
            value={woForm.scheduled_date ?? null}
            onChange={(d) => setWoForm({ ...woForm, scheduled_date: d?.slice(0, 10) })}
          />
          <Textarea
            label="Description"
            value={woForm.description ?? ""}
            onChange={(e) => setWoForm({ ...woForm, description: e.target.value })}
          />
          <Button
            tone="primary"
            onClick={() => createWoMut.mutate(woForm)}
            loading={createWoMut.isPending}
          >
            Create
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Calibration Tab
// ══════════════════════════════════════════════════════════

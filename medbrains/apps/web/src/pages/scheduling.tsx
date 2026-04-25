import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { BarChart } from "@mantine/charts";
import {
  IconAlertTriangle,
  IconBrain,
  IconCalendarPlus,
  IconChartBar,
  IconCheck,
  IconClockHour4,
  IconLock,
  IconPencil,
  IconPlayerPlay,
  IconPlus,
  IconSettings,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateBlockRequest,
  CreateOverbookingRuleRequest,
  CreateRecurringRequest,
  CreateWaitlistRequest,
  NoshowPredictionScore,
  NoshowRateRow,
  SchedulingConflict,
  SchedulingOverbookingRule,
  SchedulingWaitlistEntry,
  UpdateOverbookingRuleRequest,
  AutoFillResult,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";
import type { Column } from "../components/DataTable";

// ── Constants ──────────────────────────────────────────

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const RISK_LEVEL_COLORS: Record<string, string> = {
  low: "success",
  medium: "warning",
  high: "danger",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "slate",
  normal: "primary",
  high: "orange",
  urgent: "danger",
};

const WAITLIST_STATUS_COLORS: Record<string, string> = {
  waiting: "warning",
  offered: "primary",
  booked: "success",
  expired: "slate",
  cancelled: "danger",
};

// ── Helpers ────────────────────────────────────────────

function truncateId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString();
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// ── Page ───────────────────────────────────────────────

export function SchedulingPage() {
  useRequirePermission(P.SCHEDULING.PREDICTIONS_LIST);

  const canScore = useHasPermission(P.SCHEDULING.PREDICTIONS_CREATE);
  const canViewWaitlist = useHasPermission(P.SCHEDULING.WAITLIST_LIST);
  const canManageWaitlist = useHasPermission(P.SCHEDULING.WAITLIST_MANAGE);
  const canAutoFill = useHasPermission(P.SCHEDULING.AUTO_FILL_MANAGE);
  const canViewOverbooking = useHasPermission(P.SCHEDULING.OVERBOOKING_LIST);
  const canManageOverbooking = useHasPermission(P.SCHEDULING.OVERBOOKING_MANAGE);
  const canViewAnalytics = useHasPermission(P.SCHEDULING.ANALYTICS_VIEW);

  return (
    <div>
      <PageHeader
        title="Scheduling / No-Show AI"
        subtitle="Predictions, waitlist management, overbooking rules, conflicts, and analytics"
      />
      <Tabs defaultValue="predictions">
        <Tabs.List>
          <Tabs.Tab value="predictions" leftSection={<IconBrain size={16} />}>
            No-Show Predictions
          </Tabs.Tab>
          {canViewWaitlist && (
            <Tabs.Tab value="waitlist" leftSection={<IconClockHour4 size={16} />}>
              Waitlist
            </Tabs.Tab>
          )}
          {canViewOverbooking && (
            <Tabs.Tab value="overbooking" leftSection={<IconSettings size={16} />}>
              Overbooking Config
            </Tabs.Tab>
          )}
          <Tabs.Tab value="conflicts" leftSection={<IconAlertTriangle size={16} />}>
            Conflicts
          </Tabs.Tab>
          <Tabs.Tab value="scheduling" leftSection={<IconCalendarPlus size={16} />}>
            Recurring & Blocks
          </Tabs.Tab>
          {canViewAnalytics && (
            <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
              Analytics
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="predictions" pt="md">
          <PredictionsTab canScore={canScore} />
        </Tabs.Panel>
        <Tabs.Panel value="waitlist" pt="md">
          <WaitlistTab canManage={canManageWaitlist} canAutoFill={canAutoFill} />
        </Tabs.Panel>
        <Tabs.Panel value="overbooking" pt="md">
          <OverbookingTab canManage={canManageOverbooking} />
        </Tabs.Panel>
        <Tabs.Panel value="conflicts" pt="md">
          <ConflictsTab />
        </Tabs.Panel>
        <Tabs.Panel value="scheduling" pt="md">
          <RecurringBlocksTab canManage={canManageWaitlist} />
        </Tabs.Panel>
        <Tabs.Panel value="analytics" pt="md">
          <AnalyticsTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 1 — No-Show Predictions
// ══════════════════════════════════════════════════════════

function PredictionsTab({ canScore }: { canScore: boolean }) {
  const qc = useQueryClient();
  const [riskFilter, setRiskFilter] = useState<string | null>(null);

  const { data: predictions = [], isLoading } = useQuery({
    queryKey: ["scheduling-predictions", riskFilter],
    queryFn: () =>
      api.listPredictions({
        risk_level: riskFilter ?? undefined,
      }),
  });

  const scoreBatchMut = useMutation({
    mutationFn: () => api.scoreBatch({ appointment_ids: [] }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["scheduling-predictions"] });
      notifications.show({
        title: "Batch Scoring Complete",
        message: "Today's appointments have been scored",
        color: "success",
      });
    },
    onError: () => {
      notifications.show({
        title: "Scoring Failed",
        message: "Failed to score appointments",
        color: "danger",
      });
    },
  });

  const scoreOneMut = useMutation({
    mutationFn: (appointmentId: string) =>
      api.scoreAppointment({ appointment_id: appointmentId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["scheduling-predictions"] });
      notifications.show({
        title: "Scored",
        message: "Appointment prediction scored",
        color: "success",
      });
    },
  });

  const columns: Column<NoshowPredictionScore>[] = [
    {
      key: "appointment_id",
      label: "Appointment",
      render: (r) => (
        <Text size="sm" ff="monospace">
          {truncateId(r.appointment_id)}
        </Text>
      ),
    },
    {
      key: "patient_id",
      label: "Patient",
      render: (r) => (
        <Text size="sm" ff="monospace">
          {truncateId(r.patient_id)}
        </Text>
      ),
    },
    {
      key: "predicted_noshow_probability",
      label: "No-Show Probability",
      render: (r) => (
        <Text size="sm" fw={600}>
          {formatPercent(r.predicted_noshow_probability)}
        </Text>
      ),
    },
    {
      key: "risk_level",
      label: "Risk Level",
      render: (r) => (
        <Badge color={RISK_LEVEL_COLORS[r.risk_level] ?? "slate"} variant="light" size="sm">
          {r.risk_level}
        </Badge>
      ),
    },
    {
      key: "model_version",
      label: "Model",
      render: (r) => <Text size="sm">{r.model_version}</Text>,
    },
    {
      key: "scored_at",
      label: "Scored At",
      render: (r) => <Text size="sm">{formatDate(r.scored_at)}</Text>,
    },
    ...(canScore
      ? [
          {
            key: "actions",
            label: "Actions",
            render: (r: NoshowPredictionScore) => (
              <ActionIcon
                variant="subtle"
                color="primary"
                size="sm"
                onClick={() => scoreOneMut.mutate(r.appointment_id)}
                loading={scoreOneMut.isPending}
                aria-label="Play"
              >
                <IconPlayerPlay size={14} />
              </ActionIcon>
            ),
          },
        ]
      : []),
  ];

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Select
          placeholder="Filter by risk level"
          data={[
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
          ]}
          value={riskFilter}
          onChange={setRiskFilter}
          clearable
          w={200}
        />
        {canScore && (
          <Button
            leftSection={<IconBrain size={16} />}
            onClick={() => scoreBatchMut.mutate()}
            loading={scoreBatchMut.isPending}
          >
            Score Today's Appointments
          </Button>
        )}
      </Group>
      <DataTable<NoshowPredictionScore>
        columns={columns}
        data={predictions}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle="No predictions"
        emptyDescription="Score appointments to see no-show predictions"
      />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 2 — Waitlist
// ══════════════════════════════════════════════════════════

function WaitlistTab({
  canManage,
  canAutoFill,
}: {
  canManage: boolean;
  canAutoFill: boolean;
}) {
  const qc = useQueryClient();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [offerOpened, { open: openOffer, close: closeOffer }] = useDisclosure(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [offerTarget, setOfferTarget] = useState<SchedulingWaitlistEntry | null>(null);
  const [offeredAppointmentId, setOfferedAppointmentId] = useState("");

  // Create form state
  const [createPatientId, setCreatePatientId] = useState("");
  const [createDoctorId, setCreateDoctorId] = useState("");
  const [createDeptId, setCreateDeptId] = useState("");
  const [createDateFrom, setCreateDateFrom] = useState<string | null>(null);
  const [createDateTo, setCreateDateTo] = useState<string | null>(null);
  const [createPriority, setCreatePriority] = useState<string | null>("normal");
  const [createReason, setCreateReason] = useState("");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["scheduling-waitlist", statusFilter],
    queryFn: () =>
      api.listWaitlist({
        status: statusFilter ?? undefined,
      }),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateWaitlistRequest) => api.createWaitlistEntry(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["scheduling-waitlist"] });
      closeCreate();
      resetCreateForm();
      notifications.show({ title: "Created", message: "Waitlist entry created", color: "success" });
    },
  });

  const offerMut = useMutation({
    mutationFn: ({ id, appointmentId }: { id: string; appointmentId: string }) =>
      api.offerSlot(id, { offered_appointment_id: appointmentId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["scheduling-waitlist"] });
      closeOffer();
      setOfferTarget(null);
      setOfferedAppointmentId("");
      notifications.show({ title: "Offered", message: "Slot offered to patient", color: "primary" });
    },
  });

  const respondMut = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      api.respondToOffer(id, { accept }),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ["scheduling-waitlist"] });
      notifications.show({
        title: variables.accept ? "Accepted" : "Declined",
        message: variables.accept ? "Offer accepted, slot booked" : "Offer declined",
        color: variables.accept ? "success" : "orange",
      });
    },
  });

  const autoFillMut = useMutation({
    mutationFn: () => api.autoFillSlots(),
    onSuccess: (result: AutoFillResult) => {
      void qc.invalidateQueries({ queryKey: ["scheduling-waitlist"] });
      notifications.show({
        title: "Auto-Fill Complete",
        message: result.message,
        color: "success",
      });
    },
    onError: () => {
      notifications.show({
        title: "Auto-Fill Failed",
        message: "Could not auto-fill slots",
        color: "danger",
      });
    },
  });

  function resetCreateForm() {
    setCreatePatientId("");
    setCreateDoctorId("");
    setCreateDeptId("");
    setCreateDateFrom(null);
    setCreateDateTo(null);
    setCreatePriority("normal");
    setCreateReason("");
  }

  function handleCreate() {
    createMut.mutate({
      patient_id: createPatientId,
      doctor_id: createDoctorId || undefined,
      department_id: createDeptId || undefined,
      preferred_date_from: createDateFrom ?? undefined,
      preferred_date_to: createDateTo ?? undefined,
      priority: createPriority ?? undefined,
      reason: createReason || undefined,
    });
  }

  function handleOffer() {
    if (offerTarget && offeredAppointmentId) {
      offerMut.mutate({ id: offerTarget.id, appointmentId: offeredAppointmentId });
    }
  }

  const columns: Column<SchedulingWaitlistEntry>[] = [
    {
      key: "patient_id",
      label: "Patient",
      render: (r) => (
        <Text size="sm" ff="monospace">
          {truncateId(r.patient_id)}
        </Text>
      ),
    },
    {
      key: "doctor_id",
      label: "Doctor",
      render: (r) => (
        <Text size="sm" ff="monospace">
          {r.doctor_id ? truncateId(r.doctor_id) : "—"}
        </Text>
      ),
    },
    {
      key: "department_id",
      label: "Department",
      render: (r) => (
        <Text size="sm" ff="monospace">
          {r.department_id ? truncateId(r.department_id) : "—"}
        </Text>
      ),
    },
    {
      key: "preferred_date_from",
      label: "From",
      render: (r) => <Text size="sm">{formatDate(r.preferred_date_from)}</Text>,
    },
    {
      key: "preferred_date_to",
      label: "To",
      render: (r) => <Text size="sm">{formatDate(r.preferred_date_to)}</Text>,
    },
    {
      key: "priority",
      label: "Priority",
      render: (r) => (
        <Badge color={PRIORITY_COLORS[r.priority] ?? "slate"} variant="light" size="sm">
          {r.priority}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge color={WAITLIST_STATUS_COLORS[r.status] ?? "slate"} variant="light" size="sm">
          {r.status}
        </Badge>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            label: "Actions",
            render: (r: SchedulingWaitlistEntry) => (
              <Group gap="xs" wrap="nowrap">
                {r.status === "waiting" && (
                  <ActionIcon
                    variant="subtle"
                    color="primary"
                    size="sm"
                    title="Offer Slot"
                    onClick={() => {
                      setOfferTarget(r);
                      setOfferedAppointmentId("");
                      openOffer();
                    }}
                    aria-label="Play"
                  >
                    <IconPlayerPlay size={14} />
                  </ActionIcon>
                )}
                {r.status === "offered" && (
                  <>
                    <ActionIcon
                      variant="subtle"
                      color="success"
                      size="sm"
                      title="Accept"
                      onClick={() => respondMut.mutate({ id: r.id, accept: true })}
                      loading={respondMut.isPending}
                      aria-label="Confirm"
                    >
                      <IconCheck size={14} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="danger"
                      size="sm"
                      title="Decline"
                      onClick={() => respondMut.mutate({ id: r.id, accept: false })}
                      loading={respondMut.isPending}
                      aria-label="Close"
                    >
                      <IconX size={14} />
                    </ActionIcon>
                  </>
                )}
              </Group>
            ),
          },
        ]
      : []),
  ];

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Select
          placeholder="Filter by status"
          data={[
            { value: "waiting", label: "Waiting" },
            { value: "offered", label: "Offered" },
            { value: "booked", label: "Booked" },
            { value: "expired", label: "Expired" },
            { value: "cancelled", label: "Cancelled" },
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
          clearable
          w={200}
        />
        <Group gap="sm">
          {canAutoFill && (
            <Button
              variant="light"
              leftSection={<IconPlayerPlay size={16} />}
              onClick={() => autoFillMut.mutate()}
              loading={autoFillMut.isPending}
            >
              Auto-Fill
            </Button>
          )}
          {canManage && (
            <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
              Add to Waitlist
            </Button>
          )}
        </Group>
      </Group>
      <DataTable<SchedulingWaitlistEntry>
        columns={columns}
        data={entries}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle="No waitlist entries"
        emptyDescription="Add patients to the waitlist to manage scheduling gaps"
      />

      {/* Create Drawer */}
      <Drawer opened={createOpened} onClose={closeCreate} title="Add to Waitlist" position="right" size="md">
        <Stack gap="md">
          <TextInput
            label="Patient ID"
            value={createPatientId}
            onChange={(e) => setCreatePatientId(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Doctor ID"
            value={createDoctorId}
            onChange={(e) => setCreateDoctorId(e.currentTarget.value)}
          />
          <TextInput
            label="Department ID"
            value={createDeptId}
            onChange={(e) => setCreateDeptId(e.currentTarget.value)}
          />
          <DateInput
            label="Preferred Date From"
            value={createDateFrom}
            onChange={setCreateDateFrom}
          />
          <DateInput
            label="Preferred Date To"
            value={createDateTo}
            onChange={setCreateDateTo}
          />
          <Select
            label="Priority"
            data={[
              { value: "low", label: "Low" },
              { value: "normal", label: "Normal" },
              { value: "high", label: "High" },
              { value: "urgent", label: "Urgent" },
            ]}
            value={createPriority}
            onChange={setCreatePriority}
          />
          <Textarea
            label="Reason"
            value={createReason}
            onChange={(e) => setCreateReason(e.currentTarget.value)}
          />
          <Button onClick={handleCreate} loading={createMut.isPending}>
            Create Entry
          </Button>
        </Stack>
      </Drawer>

      {/* Offer Slot Drawer */}
      <Drawer opened={offerOpened} onClose={closeOffer} title="Offer Slot" position="right" size="sm">
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Patient: {offerTarget?.patient_id ? truncateId(offerTarget.patient_id) : "—"}
          </Text>
          <TextInput
            label="Offered Appointment ID"
            value={offeredAppointmentId}
            onChange={(e) => setOfferedAppointmentId(e.currentTarget.value)}
            required
          />
          <Button onClick={handleOffer} loading={offerMut.isPending}>
            Offer Slot
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 3 — Overbooking Config
// ══════════════════════════════════════════════════════════

function OverbookingTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<SchedulingOverbookingRule | null>(null);

  // Form state
  const [formDoctorId, setFormDoctorId] = useState("");
  const [formDeptId, setFormDeptId] = useState("");
  const [formDayOfWeek, setFormDayOfWeek] = useState<string | null>("1");
  const [formMaxSlots, setFormMaxSlots] = useState<number | string>(2);
  const [formThreshold, setFormThreshold] = useState<number | string>(0.3);
  const [formIsActive, setFormIsActive] = useState(true);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["scheduling-overbooking-rules"],
    queryFn: () => api.listOverbookingRules(),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateOverbookingRuleRequest) => api.createOverbookingRule(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["scheduling-overbooking-rules"] });
      close();
      resetForm();
      notifications.show({ title: "Created", message: "Overbooking rule created", color: "success" });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOverbookingRuleRequest }) =>
      api.updateOverbookingRule(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["scheduling-overbooking-rules"] });
      close();
      setEditing(null);
      resetForm();
      notifications.show({ title: "Updated", message: "Overbooking rule updated", color: "success" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteOverbookingRule(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["scheduling-overbooking-rules"] });
      notifications.show({ title: "Deleted", message: "Overbooking rule removed", color: "danger" });
    },
  });

  function resetForm() {
    setFormDoctorId("");
    setFormDeptId("");
    setFormDayOfWeek("1");
    setFormMaxSlots(2);
    setFormThreshold(0.3);
    setFormIsActive(true);
  }

  function openEdit(rule: SchedulingOverbookingRule) {
    setEditing(rule);
    setFormDoctorId(rule.doctor_id);
    setFormDeptId(rule.department_id);
    setFormDayOfWeek(String(rule.day_of_week));
    setFormMaxSlots(rule.max_overbook_slots);
    setFormThreshold(rule.overbook_threshold_probability);
    setFormIsActive(rule.is_active);
    open();
  }

  function handleSave() {
    const dayNum = Number(formDayOfWeek);
    const maxSlots = typeof formMaxSlots === "string" ? Number(formMaxSlots) : formMaxSlots;
    const threshold = typeof formThreshold === "string" ? Number(formThreshold) : formThreshold;

    if (editing) {
      updateMut.mutate({
        id: editing.id,
        data: {
          max_overbook_slots: maxSlots,
          overbook_threshold_probability: threshold,
          is_active: formIsActive,
        },
      });
    } else {
      createMut.mutate({
        doctor_id: formDoctorId,
        department_id: formDeptId,
        day_of_week: dayNum,
        max_overbook_slots: maxSlots,
        overbook_threshold_probability: threshold,
      });
    }
  }

  const columns: Column<SchedulingOverbookingRule>[] = [
    {
      key: "doctor_id",
      label: "Doctor",
      render: (r) => (
        <Text size="sm" ff="monospace">
          {truncateId(r.doctor_id)}
        </Text>
      ),
    },
    {
      key: "department_id",
      label: "Department",
      render: (r) => (
        <Text size="sm" ff="monospace">
          {truncateId(r.department_id)}
        </Text>
      ),
    },
    {
      key: "day_of_week",
      label: "Day",
      render: (r) => <Text size="sm">{DAY_NAMES[r.day_of_week] ?? `Day ${r.day_of_week}`}</Text>,
    },
    {
      key: "max_overbook_slots",
      label: "Max Overbook",
      render: (r) => <Text size="sm">{r.max_overbook_slots}</Text>,
    },
    {
      key: "overbook_threshold_probability",
      label: "Threshold",
      render: (r) => <Text size="sm">{formatPercent(r.overbook_threshold_probability)}</Text>,
    },
    {
      key: "is_active",
      label: "Active",
      render: (r) => (
        <Badge color={r.is_active ? "success" : "danger"} variant="light" size="sm">
          {r.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            label: "Actions",
            render: (r: SchedulingOverbookingRule) => (
              <Group gap="xs" wrap="nowrap">
                <ActionIcon variant="subtle" color="primary" size="sm" onClick={() => openEdit(r)} aria-label="Edit">
                  <IconPencil size={14} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  color="danger"
                  size="sm"
                  onClick={() => deleteMut.mutate(r.id)}
                  loading={deleteMut.isPending}
                  aria-label="Delete"
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
            ),
          },
        ]
      : []),
  ];

  return (
    <Stack gap="md">
      <Group justify="flex-end">
        {canManage && (
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setEditing(null);
              resetForm();
              open();
            }}
          >
            Add Rule
          </Button>
        )}
      </Group>
      <DataTable<SchedulingOverbookingRule>
        columns={columns}
        data={rules}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle="No overbooking rules"
        emptyDescription="Configure overbooking rules per doctor, department, and day"
      />

      <Drawer
        opened={opened}
        onClose={() => {
          close();
          setEditing(null);
          resetForm();
        }}
        title={editing ? "Edit Overbooking Rule" : "Create Overbooking Rule"}
        position="right"
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Doctor ID"
            value={formDoctorId}
            onChange={(e) => setFormDoctorId(e.currentTarget.value)}
            required
            disabled={!!editing}
          />
          <TextInput
            label="Department ID"
            value={formDeptId}
            onChange={(e) => setFormDeptId(e.currentTarget.value)}
            required
            disabled={!!editing}
          />
          <Select
            label="Day of Week"
            data={DAY_NAMES.map((name, i) => ({ value: String(i), label: name }))}
            value={formDayOfWeek}
            onChange={setFormDayOfWeek}
            required
            disabled={!!editing}
          />
          <NumberInput
            label="Max Overbook Slots"
            value={formMaxSlots}
            onChange={setFormMaxSlots}
            min={1}
            max={20}
          />
          <NumberInput
            label="Overbook Threshold Probability"
            value={formThreshold}
            onChange={setFormThreshold}
            min={0}
            max={1}
            step={0.01}
            decimalScale={2}
          />
          {editing && (
            <Switch
              label="Active"
              checked={formIsActive}
              onChange={(e) => setFormIsActive(e.currentTarget.checked)}
            />
          )}
          <Button
            onClick={handleSave}
            loading={createMut.isPending || updateMut.isPending}
          >
            {editing ? "Update Rule" : "Create Rule"}
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab — Conflicts
// ══════════════════════════════════════════════════════════

function ConflictsTab() {
  const { data: conflicts = [], isLoading } = useQuery({
    queryKey: ["scheduling-conflicts"],
    queryFn: () => api.schedulingConflicts(),
  });

  const columns: Column<SchedulingConflict>[] = [
    {
      key: "resource_name",
      label: "Resource",
      render: (r) => <Text size="sm" fw={500}>{r.resource_name}</Text>,
    },
    {
      key: "resource_id",
      label: "Resource ID",
      render: (r) => (
        <Text size="sm" ff="monospace">
          {truncateId(r.resource_id)}
        </Text>
      ),
    },
    {
      key: "slot_a",
      label: "Slot A",
      render: (r) => (
        <Text size="sm" ff="monospace">
          {truncateId(r.slot_a_id)}
        </Text>
      ),
    },
    {
      key: "slot_b",
      label: "Slot B",
      render: (r) => (
        <Text size="sm" ff="monospace">
          {truncateId(r.slot_b_id)}
        </Text>
      ),
    },
    {
      key: "overlap",
      label: "Overlap Window",
      render: (r) => (
        <Text size="sm">
          {new Date(r.overlap_start).toLocaleString()} — {new Date(r.overlap_end).toLocaleString()}
        </Text>
      ),
    },
  ];

  return (
    <Stack gap="md">
      <Text fw={600} size="lg">
        Schedule Conflicts
      </Text>
      <DataTable<SchedulingConflict>
        columns={columns}
        data={conflicts}
        loading={isLoading}
        rowKey={(r) => `${r.slot_a_id}-${r.slot_b_id}`}
        emptyTitle="No conflicts detected"
        emptyDescription="All schedule slots are conflict-free"
      />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab — Recurring Appointments & Block Scheduling
// ══════════════════════════════════════════════════════════

function RecurringBlocksTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [recurringOpen, { open: openRecurring, close: closeRecurring }] = useDisclosure(false);
  const [blockOpen, { open: openBlock, close: closeBlock }] = useDisclosure(false);

  // ── Recurring Appointment form ──
  const [recForm, setRecForm] = useState<CreateRecurringRequest>({
    resource_id: "",
    resource_type: "doctor",
    day_of_week: 1,
    start_time: "09:00",
    end_time: "10:00",
    repeat_count: 4,
    start_date: "",
  });

  const recurringMut = useMutation({
    mutationFn: () => api.createRecurringAppointment(recForm),
    onSuccess: (result) => {
      closeRecurring();
      setRecForm({
        resource_id: "",
        resource_type: "doctor",
        day_of_week: 1,
        start_time: "09:00",
        end_time: "10:00",
        repeat_count: 4,
        start_date: "",
      });
      notifications.show({
        title: "Recurring Created",
        message: `${result.created} recurring slot(s) created`,
        color: "success",
      });
      void qc.invalidateQueries({ queryKey: ["scheduling-conflicts"] });
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
    },
  });

  // ── Block Scheduling form ──
  const [blockForm, setBlockForm] = useState<CreateBlockRequest>({
    resource_id: "",
    resource_type: "doctor",
    start_time: "",
    end_time: "",
    block_reason: "",
  });

  const blockMut = useMutation({
    mutationFn: () => api.createScheduleBlock(blockForm),
    onSuccess: () => {
      closeBlock();
      setBlockForm({
        resource_id: "",
        resource_type: "doctor",
        start_time: "",
        end_time: "",
        block_reason: "",
      });
      notifications.show({
        title: "Block Created",
        message: "Schedule block created successfully",
        color: "success",
      });
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
    },
  });

  // ── Waitlist Promotion ──
  const [promoteSlotId, setPromoteSlotId] = useState("");
  const promoteMut = useMutation({
    mutationFn: () => api.promoteWaitlist({ slot_id: promoteSlotId }),
    onSuccess: (result) => {
      setPromoteSlotId("");
      notifications.show({
        title: result.promoted ? "Promoted" : "No Promotion",
        message: result.promoted
          ? "Waitlist entry promoted to the slot"
          : "No eligible waitlist entry found for this slot",
        color: result.promoted ? "success" : "warning",
      });
      void qc.invalidateQueries({ queryKey: ["scheduling-waitlist"] });
    },
    onError: (err: Error) => {
      notifications.show({ title: "Error", message: err.message, color: "danger" });
    },
  });

  return (
    <Stack gap="lg">
      {/* Waitlist Promotion */}
      <Card withBorder p="md">
        <Text fw={600} size="sm" mb="sm">Promote Waitlist Entry</Text>
        <Text size="xs" c="dimmed" mb="sm">
          Enter a slot ID that has become available. The system will attempt to promote the
          highest-priority waitlist entry to fill it.
        </Text>
        <Group>
          <TextInput
            placeholder="Available Slot ID"
            value={promoteSlotId}
            onChange={(e) => setPromoteSlotId(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button
            onClick={() => promoteMut.mutate()}
            loading={promoteMut.isPending}
            disabled={!promoteSlotId}
          >
            Promote
          </Button>
        </Group>
      </Card>

      {/* Action Buttons */}
      {canManage && (
        <Group gap="sm">
          <Button
            leftSection={<IconCalendarPlus size={16} />}
            onClick={openRecurring}
          >
            Create Recurring Slots
          </Button>
          <Button
            variant="light"
            color="danger"
            leftSection={<IconLock size={16} />}
            onClick={openBlock}
          >
            Block Schedule
          </Button>
        </Group>
      )}

      {/* Recurring Appointment Modal */}
      <Modal
        opened={recurringOpen}
        onClose={closeRecurring}
        title="Create Recurring Appointment Slots"
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Resource ID"
            placeholder="Doctor or resource UUID"
            required
            value={recForm.resource_id}
            onChange={(e) => setRecForm({ ...recForm, resource_id: e.currentTarget.value })}
          />
          <Select
            label="Resource Type"
            data={[
              { value: "doctor", label: "Doctor" },
              { value: "room", label: "Room" },
              { value: "equipment", label: "Equipment" },
            ]}
            value={recForm.resource_type}
            onChange={(v) => setRecForm({ ...recForm, resource_type: v ?? "doctor" })}
          />
          <Select
            label="Day of Week"
            data={DAY_NAMES.map((name, i) => ({ value: String(i), label: name }))}
            value={String(recForm.day_of_week)}
            onChange={(v) => setRecForm({ ...recForm, day_of_week: Number(v ?? 1) })}
          />
          <Group grow>
            <TextInput
              label="Start Time"
              placeholder="HH:MM"
              value={recForm.start_time}
              onChange={(e) => setRecForm({ ...recForm, start_time: e.currentTarget.value })}
            />
            <TextInput
              label="End Time"
              placeholder="HH:MM"
              value={recForm.end_time}
              onChange={(e) => setRecForm({ ...recForm, end_time: e.currentTarget.value })}
            />
          </Group>
          <NumberInput
            label="Repeat Count (weeks)"
            min={1}
            max={52}
            value={recForm.repeat_count}
            onChange={(v) => setRecForm({ ...recForm, repeat_count: typeof v === "number" ? v : 4 })}
          />
          <TextInput
            label="Start Date"
            placeholder="YYYY-MM-DD"
            required
            value={recForm.start_date}
            onChange={(e) => setRecForm({ ...recForm, start_date: e.currentTarget.value })}
          />
          <Button
            onClick={() => recurringMut.mutate()}
            loading={recurringMut.isPending}
            disabled={!recForm.resource_id || !recForm.start_date}
          >
            Create Recurring Slots
          </Button>
        </Stack>
      </Modal>

      {/* Block Schedule Modal */}
      <Modal
        opened={blockOpen}
        onClose={closeBlock}
        title="Block Schedule"
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Resource ID"
            placeholder="Doctor or resource UUID"
            required
            value={blockForm.resource_id}
            onChange={(e) => setBlockForm({ ...blockForm, resource_id: e.currentTarget.value })}
          />
          <Select
            label="Resource Type"
            data={[
              { value: "doctor", label: "Doctor" },
              { value: "room", label: "Room" },
              { value: "equipment", label: "Equipment" },
            ]}
            value={blockForm.resource_type}
            onChange={(v) => setBlockForm({ ...blockForm, resource_type: v ?? "doctor" })}
          />
          <TextInput
            label="Block Start (ISO datetime)"
            placeholder="2026-04-10T09:00:00"
            required
            value={blockForm.start_time}
            onChange={(e) => setBlockForm({ ...blockForm, start_time: e.currentTarget.value })}
          />
          <TextInput
            label="Block End (ISO datetime)"
            placeholder="2026-04-10T17:00:00"
            required
            value={blockForm.end_time}
            onChange={(e) => setBlockForm({ ...blockForm, end_time: e.currentTarget.value })}
          />
          <Textarea
            label="Reason"
            required
            value={blockForm.block_reason}
            onChange={(e) => setBlockForm({ ...blockForm, block_reason: e.currentTarget.value })}
          />
          <Button
            color="danger"
            onClick={() => blockMut.mutate()}
            loading={blockMut.isPending}
            disabled={!blockForm.resource_id || !blockForm.start_time || !blockForm.end_time || !blockForm.block_reason}
          >
            Create Block
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab — Analytics (enhanced with BarChart + schedule analytics)
// ══════════════════════════════════════════════════════════

function AnalyticsTab() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: noshowRates = [], isLoading: ratesLoading } = useQuery({
    queryKey: ["scheduling-analytics-noshow-rates"],
    queryFn: () => api.noshowRates(),
  });

  const { data: accuracy } = useQuery({
    queryKey: ["scheduling-analytics-prediction-accuracy"],
    queryFn: () => api.predictionAccuracy(),
  });

  const { data: waitlistStatsData } = useQuery({
    queryKey: ["scheduling-analytics-waitlist-stats"],
    queryFn: () => api.waitlistStats(),
  });

  const { data: schedAnalytics } = useQuery({
    queryKey: ["scheduling-analytics-schedule", dateFrom, dateTo],
    queryFn: () => api.scheduleAnalytics({
      from: dateFrom || undefined,
      to: dateTo || undefined,
    }),
  });

  const rateColumns: Column<NoshowRateRow>[] = [
    {
      key: "doctor_id",
      label: "Doctor",
      render: (r) => (
        <Text size="sm" ff="monospace">
          {r.doctor_id ? truncateId(r.doctor_id) : "—"}
        </Text>
      ),
    },
    {
      key: "department_id",
      label: "Department",
      render: (r) => (
        <Text size="sm" ff="monospace">
          {r.department_id ? truncateId(r.department_id) : "—"}
        </Text>
      ),
    },
    {
      key: "total_appointments",
      label: "Total Appts",
      render: (r) => <Text size="sm">{r.total_appointments}</Text>,
    },
    {
      key: "noshow_count",
      label: "No-Shows",
      render: (r) => <Text size="sm">{r.noshow_count}</Text>,
    },
    {
      key: "noshow_rate",
      label: "No-Show Rate",
      render: (r) => (
        <Text size="sm" fw={600}>
          {r.noshow_rate != null ? formatPercent(r.noshow_rate) : "—"}
        </Text>
      ),
    },
  ];

  // Prepare chart data for schedule analytics
  const chartData = schedAnalytics
    ? [
        { metric: "Total Slots", value: schedAnalytics.total_slots },
        { metric: "Utilized", value: schedAnalytics.utilized_slots },
        { metric: "No-Shows", value: schedAnalytics.no_show_count },
      ]
    : [];

  return (
    <Stack gap="lg">
      {/* Schedule Analytics with BarChart */}
      <div>
        <Group justify="space-between" mb="sm">
          <Text fw={600} size="lg">
            Schedule Analytics
          </Text>
          <Group gap="xs">
            <TextInput
              placeholder="From (YYYY-MM-DD)"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.currentTarget.value)}
              style={{ width: 160 }}
              size="xs"
            />
            <TextInput
              placeholder="To (YYYY-MM-DD)"
              value={dateTo}
              onChange={(e) => setDateTo(e.currentTarget.value)}
              style={{ width: 160 }}
              size="xs"
            />
          </Group>
        </Group>
        {schedAnalytics && (
          <>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} mb="md">
              <StatCard label="Total Slots" value={schedAnalytics.total_slots} color="primary" />
              <StatCard
                label="Utilization Rate"
                value={formatPercent(schedAnalytics.utilization_rate)}
                color="success"
              />
              <StatCard
                label="No-Show Rate"
                value={formatPercent(schedAnalytics.no_show_rate)}
                color="danger"
              />
              <StatCard
                label="Avg Wait (min)"
                value={(schedAnalytics.avg_wait_minutes ?? 0).toFixed(1)}
                color="orange"
              />
            </SimpleGrid>
            {chartData.length > 0 && (
              <BarChart
                h={250}
                data={chartData}
                dataKey="metric"
                series={[{ name: "value", label: "Count", color: "primary" }]}
              />
            )}
          </>
        )}
      </div>

      {/* Waitlist Stats */}
      {waitlistStatsData && (
        <div>
          <Text fw={600} size="lg" mb="sm">
            Waitlist Overview
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
            <StatCard label="Waiting" value={waitlistStatsData.total_waiting} color="warning" />
            <StatCard label="Offered" value={waitlistStatsData.total_offered} color="primary" />
            <StatCard label="Booked" value={waitlistStatsData.total_booked} color="success" />
            <StatCard
              label="Avg Wait (days)"
              value={waitlistStatsData.avg_wait_days != null ? waitlistStatsData.avg_wait_days.toFixed(1) : "—"}
              color="slate"
            />
          </SimpleGrid>
        </div>
      )}

      {/* Prediction Accuracy */}
      {accuracy && (
        <div>
          <Text fw={600} size="lg" mb="sm">
            Prediction Accuracy
          </Text>
          <Card withBorder p="md">
            <Group gap="xl">
              <div>
                <Text size="xs" c="dimmed">
                  Model Version
                </Text>
                <Text fw={600}>{accuracy.model_version}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Total Predictions
                </Text>
                <Text fw={600}>{accuracy.total_predictions.toLocaleString()}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Status
                </Text>
                <Text fw={600}>{accuracy.message}</Text>
              </div>
            </Group>
          </Card>
        </div>
      )}

      {/* No-Show Rates Table */}
      <div>
        <Text fw={600} size="lg" mb="sm">
          No-Show Rates
        </Text>
        <DataTable<NoshowRateRow>
          columns={rateColumns}
          data={noshowRates}
          loading={ratesLoading}
          rowKey={(r) => `${r.doctor_id ?? "all"}-${r.department_id ?? "all"}`}
          emptyTitle="No rate data"
          emptyDescription="No-show rate data will appear once appointments are tracked"
        />
      </div>
    </Stack>
  );
}

// ── Stat Card Helper ──────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <Card withBorder p="md">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={700} size="xl" c={color}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </Text>
    </Card>
  );
}

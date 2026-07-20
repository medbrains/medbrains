import { zodResolver } from "@hookform/resolvers/zod";
import { confirmDestructive } from "@/lib/confirm";
import { ConflictsTab } from "./scheduling/conflicts-tab";
import { DAY_NAMES, formatDate, formatPercent, truncateId } from "./scheduling/shared";
import "@mantine/charts/styles.css";
import { BarChart } from "@mantine/charts";
import {
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
  Textarea,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import type {
  SchedulingBlockFormInput,
  SchedulingOverbookingRuleFormInput,
  SchedulingRecurringFormInput,
  SchedulingWaitlistFormInput,
} from "@medbrains/schemas";
import {
  schedulingBlockFormSchema,
  schedulingOverbookingRuleFormSchema,
  schedulingRecurringFormSchema,
  schedulingWaitlistFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  AutoFillResult,
  CreateBlockRequest,
  CreateOverbookingRuleRequest,
  CreateRecurringRequest,
  CreateWaitlistRequest,
  NoshowPredictionScore,
  NoshowRateRow,
  SchedulingOverbookingRule,
  SchedulingWaitlistEntry,
  UpdateOverbookingRuleRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
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
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, IconButton, toast } from "@/components/ui";
import {
  schedulingInteger,
  schedulingNumber,
  schedulingOptionalText,
  schedulingPriorityOptions,
  schedulingResourceTypeOptions,
  toDateInputValue,
  toIsoDateInputValue,
} from "@/forms/scheduling.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { schedulingService } from "@/services/scheduling.service";

// ── Constants ──────────────────────────────────────────

const RISK_LEVEL_COLORS: Record<string, BadgeTone> = {
  low: "success",
  medium: "warning",
  high: "danger",
};

const PRIORITY_COLORS: Record<string, BadgeTone> = {
  low: "neutral",
  normal: "primary",
  high: "warning",
  urgent: "danger",
};

const WAITLIST_STATUS_COLORS: Record<string, BadgeTone> = {
  waiting: "warning",
  offered: "primary",
  booked: "success",
  expired: "neutral",
  cancelled: "danger",
};

const emptyWaitlistForm: SchedulingWaitlistFormInput = {
  patient_id: "",
  doctor_id: "",
  department_id: "",
  preferred_date_from: "",
  preferred_date_to: "",
  priority: "normal",
  reason: "",
};

const emptyOverbookingForm: SchedulingOverbookingRuleFormInput = {
  doctor_id: "",
  department_id: "",
  day_of_week: 1,
  max_overbook_slots: 2,
  overbook_threshold_probability: 0.3,
  is_active: true,
};

const emptyRecurringForm: SchedulingRecurringFormInput = {
  resource_id: "",
  resource_type: "doctor",
  day_of_week: 1,
  start_time: "09:00",
  end_time: "10:00",
  repeat_count: 4,
  start_date: "",
};

const emptyBlockForm: SchedulingBlockFormInput = {
  resource_id: "",
  resource_type: "doctor",
  start_time: "",
  end_time: "",
  block_reason: "",
};

// ── Helpers ────────────────────────────────────────────

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
      schedulingService.listPredictions({
        risk_level: riskFilter ?? undefined,
      }),
  });

  const scoreBatchMut = useMutation({
    mutationFn: () => schedulingService.scoreBatch({ appointment_ids: [] }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["scheduling-predictions"] });
      toast.success("Today's appointments have been scored", { title: "Batch Scoring Complete" });
    },
    onError: () => {
      toast.error("Failed to score appointments", { title: "Scoring Failed" });
    },
  });

  const scoreOneMut = useMutation({
    mutationFn: (appointmentId: string) =>
      schedulingService.scoreAppointment({ appointment_id: appointmentId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["scheduling-predictions"] });
      toast.success("Appointment prediction scored", { title: "Scored" });
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
        <Badge tone={RISK_LEVEL_COLORS[r.risk_level] ?? "neutral"} size="sm">
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
              <IconButton
                tone="primary"
                size="sm"
                onClick={() => scoreOneMut.mutate(r.appointment_id)}
                loading={scoreOneMut.isPending}
                aria-label="Score appointment"
              >
                <IconPlayerPlay size={14} />
              </IconButton>
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
            tone="primary"
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

function WaitlistTab({ canManage, canAutoFill }: { canManage: boolean; canAutoFill: boolean }) {
  const qc = useQueryClient();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [offerOpened, { open: openOffer, close: closeOffer }] = useDisclosure(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [offerTarget, setOfferTarget] = useState<SchedulingWaitlistEntry | null>(null);
  const [offeredAppointmentId, setOfferedAppointmentId] = useState("");

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SchedulingWaitlistFormInput>({
    resolver: zodResolver(schedulingWaitlistFormSchema),
    defaultValues: emptyWaitlistForm,
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["scheduling-waitlist", statusFilter],
    queryFn: () =>
      schedulingService.listWaitlist({
        status: statusFilter ?? undefined,
      }),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateWaitlistRequest) => schedulingService.createWaitlistEntry(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["scheduling-waitlist"] });
      closeCreate();
      reset(emptyWaitlistForm);
      toast.success("Waitlist entry created", { title: "Created" });
    },
  });

  const offerMut = useMutation({
    mutationFn: ({ id, appointmentId }: { id: string; appointmentId: string }) =>
      schedulingService.offerSlot(id, { offered_appointment_id: appointmentId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["scheduling-waitlist"] });
      closeOffer();
      setOfferTarget(null);
      setOfferedAppointmentId("");
      toast.info("Slot offered to patient", { title: "Offered" });
    },
  });

  const respondMut = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      schedulingService.respondToOffer(id, { accept }),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ["scheduling-waitlist"] });
      if (variables.accept) {
        toast.success("Offer accepted, slot booked", { title: "Accepted" });
      } else {
        toast.warning("Offer declined", { title: "Declined" });
      }
    },
  });

  const autoFillMut = useMutation({
    mutationFn: () => schedulingService.autoFillSlots(),
    onSuccess: (result: AutoFillResult) => {
      void qc.invalidateQueries({ queryKey: ["scheduling-waitlist"] });
      toast.success(result.message, { title: "Auto-Fill Complete" });
    },
    onError: () => {
      toast.error("Could not auto-fill slots", { title: "Auto-Fill Failed" });
    },
  });

  function handleCreate(values: SchedulingWaitlistFormInput) {
    createMut.mutate({
      patient_id: values.patient_id,
      doctor_id: schedulingOptionalText(values.doctor_id),
      department_id: schedulingOptionalText(values.department_id),
      preferred_date_from: schedulingOptionalText(values.preferred_date_from),
      preferred_date_to: schedulingOptionalText(values.preferred_date_to),
      priority: values.priority,
      reason: schedulingOptionalText(values.reason),
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
        <Badge tone={PRIORITY_COLORS[r.priority] ?? "neutral"} size="sm">
          {r.priority}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge tone={WAITLIST_STATUS_COLORS[r.status] ?? "neutral"} size="sm">
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
                  <IconButton
                    tone="primary"
                    size="sm"
                    title="Offer Slot"
                    onClick={() => {
                      setOfferTarget(r);
                      setOfferedAppointmentId("");
                      openOffer();
                    }}
                    aria-label="Offer Slot"
                  >
                    <IconPlayerPlay size={14} />
                  </IconButton>
                )}
                {r.status === "offered" && (
                  <>
                    <IconButton
                      tone="success"
                      size="sm"
                      title="Accept"
                      onClick={() => respondMut.mutate({ id: r.id, accept: true })}
                      loading={respondMut.isPending}
                      aria-label="Accept"
                    >
                      <IconCheck size={14} />
                    </IconButton>
                    <IconButton
                      tone="danger"
                      size="sm"
                      title="Decline"
                      onClick={() => respondMut.mutate({ id: r.id, accept: false })}
                      loading={respondMut.isPending}
                      aria-label="Decline"
                    >
                      <IconX size={14} />
                    </IconButton>
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
              tone="secondary"
              leftSection={<IconPlayerPlay size={16} />}
              onClick={() => autoFillMut.mutate()}
              loading={autoFillMut.isPending}
            >
              Auto-Fill
            </Button>
          )}
          {canManage && (
            <Button
              tone="primary"
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                reset(emptyWaitlistForm);
                openCreate();
              }}
            >
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
      <Drawer
        opened={createOpened}
        onClose={closeCreate}
        title="Add to Waitlist"
        position="right"
        size="xl"
      >
        <Stack component="form" gap="md" onSubmit={handleSubmit(handleCreate)}>
          <Controller
            name="patient_id"
            control={control}
            render={({ field }) => (
              <PatientSearchSelect
                label="Patient"
                required
                value={field.value ?? ""}
                onChange={field.onChange}
                error={errors.patient_id?.message}
              />
            )}
          />
          <Controller
            name="doctor_id"
            control={control}
            render={({ field }) => (
              <DoctorSearchSelect label="Doctor" value={field.value} onChange={field.onChange} />
            )}
          />
          <Controller
            name="department_id"
            control={control}
            render={({ field }) => (
              <DepartmentSelect label="Department" value={field.value} onChange={field.onChange} />
            )}
          />
          <Controller
            name="preferred_date_from"
            control={control}
            render={({ field }) => (
              <DateInput
                label="Preferred Date From"
                value={toDateInputValue(field.value)}
                onChange={(date) => field.onChange(toIsoDateInputValue(date))}
                error={errors.preferred_date_from?.message}
              />
            )}
          />
          <Controller
            name="preferred_date_to"
            control={control}
            render={({ field }) => (
              <DateInput
                label="Preferred Date To"
                value={toDateInputValue(field.value)}
                onChange={(date) => field.onChange(toIsoDateInputValue(date))}
                error={errors.preferred_date_to?.message}
              />
            )}
          />
          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <Select
                label="Priority"
                data={schedulingPriorityOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "normal")}
              />
            )}
          />
          <Controller
            name="reason"
            control={control}
            render={({ field }) => <Textarea label="Reason" {...field} />}
          />
          <Button tone="primary" type="submit" loading={createMut.isPending}>
            Create Entry
          </Button>
        </Stack>
      </Drawer>

      {/* Offer Slot Drawer */}
      <Drawer
        opened={offerOpened}
        onClose={closeOffer}
        title="Offer Slot"
        position="right"
        size="sm"
      >
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
          <Button tone="primary" onClick={handleOffer} loading={offerMut.isPending}>
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
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SchedulingOverbookingRuleFormInput>({
    resolver: zodResolver(schedulingOverbookingRuleFormSchema),
    defaultValues: emptyOverbookingForm,
  });

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["scheduling-overbooking-rules"],
    queryFn: () => schedulingService.listOverbookingRules(),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateOverbookingRuleRequest) => schedulingService.createOverbookingRule(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["scheduling-overbooking-rules"] });
      close();
      reset(emptyOverbookingForm);
      toast.success("Overbooking rule created", { title: "Created" });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOverbookingRuleRequest }) =>
      schedulingService.updateOverbookingRule(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["scheduling-overbooking-rules"] });
      close();
      setEditing(null);
      reset(emptyOverbookingForm);
      toast.success("Overbooking rule updated", { title: "Updated" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => schedulingService.deleteOverbookingRule(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["scheduling-overbooking-rules"] });
      toast.error("Overbooking rule removed", { title: "Deleted" });
    },
  });

  function openEdit(rule: SchedulingOverbookingRule) {
    setEditing(rule);
    reset({
      doctor_id: rule.doctor_id,
      department_id: rule.department_id,
      day_of_week: rule.day_of_week,
      max_overbook_slots: rule.max_overbook_slots,
      overbook_threshold_probability: rule.overbook_threshold_probability,
      is_active: rule.is_active,
    });
    open();
  }

  function handleSave(values: SchedulingOverbookingRuleFormInput) {
    const dayNum = schedulingInteger(values.day_of_week, 1);
    const maxSlots = schedulingInteger(values.max_overbook_slots, 2);
    const threshold = schedulingNumber(values.overbook_threshold_probability, 0.3);
    if (editing) {
      updateMut.mutate({
        id: editing.id,
        data: {
          max_overbook_slots: maxSlots,
          overbook_threshold_probability: threshold,
          is_active: values.is_active,
        },
      });
    } else {
      createMut.mutate({
        doctor_id: values.doctor_id,
        department_id: values.department_id,
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
        <Badge tone={r.is_active ? "success" : "danger"} size="sm">
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
                <IconButton tone="primary" size="sm" onClick={() => openEdit(r)} aria-label="Edit">
                  <IconPencil size={14} />
                </IconButton>
                <IconButton
                  tone="danger"
                  size="sm"
                  onClick={() =>
                    confirmDestructive({
                      title: "Delete",
                      message: "Permanently delete this record? This cannot be undone.",
                      onConfirm: () => deleteMut.mutate(r.id),
                    })
                  }
                  loading={deleteMut.isPending}
                  aria-label="Delete"
                >
                  <IconTrash size={14} />
                </IconButton>
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
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setEditing(null);
              reset(emptyOverbookingForm);
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
          reset(emptyOverbookingForm);
        }}
        title={editing ? "Edit Overbooking Rule" : "Create Overbooking Rule"}
        position="right"
        size="md"
      >
        <Stack component="form" gap="md" onSubmit={handleSubmit(handleSave)}>
          <Controller
            name="doctor_id"
            control={control}
            render={({ field }) => (
              <DoctorSearchSelect
                label="Doctor"
                required
                disabled={!!editing}
                value={field.value}
                onChange={field.onChange}
                error={errors.doctor_id?.message}
              />
            )}
          />
          <Controller
            name="department_id"
            control={control}
            render={({ field }) => (
              <DepartmentSelect
                label="Department"
                required
                disabled={!!editing}
                value={field.value}
                onChange={field.onChange}
                error={errors.department_id?.message}
              />
            )}
          />
          <Controller
            name="day_of_week"
            control={control}
            render={({ field }) => (
              <Select
                label="Day of Week"
                data={DAY_NAMES.map((name, i) => ({ value: String(i), label: name }))}
                value={String(field.value)}
                onChange={(value) => field.onChange(Number(value ?? 1))}
                required
                disabled={!!editing}
                error={errors.day_of_week?.message}
              />
            )}
          />
          <Controller
            name="max_overbook_slots"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Max Overbook Slots"
                value={field.value}
                onChange={field.onChange}
                min={1}
                max={20}
                error={errors.max_overbook_slots?.message}
              />
            )}
          />
          <Controller
            name="overbook_threshold_probability"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Overbook Threshold Probability"
                value={field.value}
                onChange={field.onChange}
                min={0}
                max={1}
                step={0.01}
                decimalScale={2}
                error={errors.overbook_threshold_probability?.message}
              />
            )}
          />
          {editing && (
            <Controller
              name="is_active"
              control={control}
              render={({ field }) => (
                <Switch
                  label="Active"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                />
              )}
            />
          )}
          <Button tone="primary" type="submit" loading={createMut.isPending || updateMut.isPending}>
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

function RecurringBlocksTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [recurringOpen, { open: openRecurring, close: closeRecurring }] = useDisclosure(false);
  const [blockOpen, { open: openBlock, close: closeBlock }] = useDisclosure(false);
  const {
    control: recurringControl,
    handleSubmit: handleRecurringSubmit,
    reset: resetRecurring,
    formState: { errors: recurringErrors },
  } = useForm<SchedulingRecurringFormInput>({
    resolver: zodResolver(schedulingRecurringFormSchema),
    defaultValues: emptyRecurringForm,
  });

  const recurringMut = useMutation({
    mutationFn: (data: CreateRecurringRequest) =>
      schedulingService.createRecurringAppointment(data),
    onSuccess: (result) => {
      closeRecurring();
      resetRecurring(emptyRecurringForm);
      toast.success(`${result.created} recurring slot(s) created`, { title: "Recurring Created" });
      void qc.invalidateQueries({ queryKey: ["scheduling-conflicts"] });
    },
    onError: (err: Error) => {
      toast.error(err.message, { title: "Error" });
    },
  });

  const {
    control: blockControl,
    handleSubmit: handleBlockSubmit,
    reset: resetBlock,
    formState: { errors: blockErrors },
  } = useForm<SchedulingBlockFormInput>({
    resolver: zodResolver(schedulingBlockFormSchema),
    defaultValues: emptyBlockForm,
  });

  const blockMut = useMutation({
    mutationFn: (data: CreateBlockRequest) => schedulingService.createScheduleBlock(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["scheduling-conflicts"] });
      closeBlock();
      resetBlock(emptyBlockForm);
      toast.success("Schedule block created successfully", { title: "Block Created" });
    },
    onError: (err: Error) => {
      toast.error(err.message, { title: "Error" });
    },
  });

  // ── Waitlist Promotion ──
  const [promoteSlotId, setPromoteSlotId] = useState("");
  const promoteMut = useMutation({
    mutationFn: () => schedulingService.promoteWaitlist({ slot_id: promoteSlotId }),
    onSuccess: (result) => {
      setPromoteSlotId("");
      if (result.promoted) {
        toast.success("Waitlist entry promoted to the slot", { title: "Promoted" });
      } else {
        toast.warning("No eligible waitlist entry found for this slot", { title: "No Promotion" });
      }
      void qc.invalidateQueries({ queryKey: ["scheduling-waitlist"] });
    },
    onError: (err: Error) => {
      toast.error(err.message, { title: "Error" });
    },
  });

  const submitRecurring = (values: SchedulingRecurringFormInput) => {
    recurringMut.mutate({
      resource_id: values.resource_id,
      resource_type: values.resource_type,
      day_of_week: schedulingInteger(values.day_of_week, 1),
      start_time: values.start_time,
      end_time: values.end_time,
      repeat_count: schedulingInteger(values.repeat_count, 4),
      start_date: values.start_date,
    });
  };

  const submitBlock = (values: SchedulingBlockFormInput) => {
    blockMut.mutate({
      resource_id: values.resource_id,
      resource_type: values.resource_type,
      start_time: values.start_time,
      end_time: values.end_time,
      block_reason: values.block_reason,
    });
  };

  return (
    <Stack gap="lg">
      {/* Waitlist Promotion */}
      <Card withBorder p="md">
        <Text fw={600} size="sm" mb="sm">
          Promote Waitlist Entry
        </Text>
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
            tone="primary"
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
            tone="primary"
            leftSection={<IconCalendarPlus size={16} />}
            onClick={() => {
              resetRecurring(emptyRecurringForm);
              openRecurring();
            }}
          >
            Create Recurring Slots
          </Button>
          <Button
            tone="subtle-danger"
            leftSection={<IconLock size={16} />}
            onClick={() => {
              resetBlock(emptyBlockForm);
              openBlock();
            }}
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
        <Stack component="form" gap="md" onSubmit={handleRecurringSubmit(submitRecurring)}>
          <Controller
            name="resource_id"
            control={recurringControl}
            render={({ field }) => (
              <TextInput
                label="Resource ID"
                placeholder="Doctor or resource UUID"
                required
                {...field}
                error={recurringErrors.resource_id?.message}
              />
            )}
          />
          <Controller
            name="resource_type"
            control={recurringControl}
            render={({ field }) => (
              <Select
                label="Resource Type"
                data={schedulingResourceTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "doctor")}
                error={recurringErrors.resource_type?.message}
              />
            )}
          />
          <Controller
            name="day_of_week"
            control={recurringControl}
            render={({ field }) => (
              <Select
                label="Day of Week"
                data={DAY_NAMES.map((name, i) => ({ value: String(i), label: name }))}
                value={String(field.value)}
                onChange={(value) => field.onChange(Number(value ?? 1))}
                error={recurringErrors.day_of_week?.message}
              />
            )}
          />
          <Group grow>
            <Controller
              name="start_time"
              control={recurringControl}
              render={({ field }) => (
                <TextInput
                  label="Start Time"
                  placeholder="HH:MM"
                  {...field}
                  error={recurringErrors.start_time?.message}
                />
              )}
            />
            <Controller
              name="end_time"
              control={recurringControl}
              render={({ field }) => (
                <TextInput
                  label="End Time"
                  placeholder="HH:MM"
                  {...field}
                  error={recurringErrors.end_time?.message}
                />
              )}
            />
          </Group>
          <Controller
            name="repeat_count"
            control={recurringControl}
            render={({ field }) => (
              <NumberInput
                label="Repeat Count (weeks)"
                min={1}
                max={52}
                value={field.value}
                onChange={field.onChange}
                error={recurringErrors.repeat_count?.message}
              />
            )}
          />
          <Controller
            name="start_date"
            control={recurringControl}
            render={({ field }) => (
              <TextInput
                label="Start Date"
                placeholder="YYYY-MM-DD"
                required
                {...field}
                error={recurringErrors.start_date?.message}
              />
            )}
          />
          <Button tone="primary" type="submit" loading={recurringMut.isPending}>
            Create Recurring Slots
          </Button>
        </Stack>
      </Modal>

      {/* Block Schedule Modal */}
      <Modal opened={blockOpen} onClose={closeBlock} title="Block Schedule" size="md">
        <Stack component="form" gap="md" onSubmit={handleBlockSubmit(submitBlock)}>
          <Controller
            name="resource_id"
            control={blockControl}
            render={({ field }) => (
              <TextInput
                label="Resource ID"
                placeholder="Doctor or resource UUID"
                required
                {...field}
                error={blockErrors.resource_id?.message}
              />
            )}
          />
          <Controller
            name="resource_type"
            control={blockControl}
            render={({ field }) => (
              <Select
                label="Resource Type"
                data={schedulingResourceTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "doctor")}
                error={blockErrors.resource_type?.message}
              />
            )}
          />
          <Controller
            name="start_time"
            control={blockControl}
            render={({ field }) => (
              <TextInput
                label="Block Start (ISO datetime)"
                placeholder="2026-04-10T09:00:00"
                required
                {...field}
                error={blockErrors.start_time?.message}
              />
            )}
          />
          <Controller
            name="end_time"
            control={blockControl}
            render={({ field }) => (
              <TextInput
                label="Block End (ISO datetime)"
                placeholder="2026-04-10T17:00:00"
                required
                {...field}
                error={blockErrors.end_time?.message}
              />
            )}
          />
          <Controller
            name="block_reason"
            control={blockControl}
            render={({ field }) => (
              <Textarea
                label="Reason"
                required
                {...field}
                error={blockErrors.block_reason?.message}
              />
            )}
          />
          <Button tone="danger" type="submit" loading={blockMut.isPending}>
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
    queryFn: () => schedulingService.noshowRates(),
  });

  const { data: accuracy } = useQuery({
    queryKey: ["scheduling-analytics-prediction-accuracy"],
    queryFn: () => schedulingService.predictionAccuracy(),
  });

  const { data: waitlistStatsData } = useQuery({
    queryKey: ["scheduling-analytics-waitlist-stats"],
    queryFn: () => schedulingService.waitlistStats(),
  });

  const { data: schedAnalytics } = useQuery({
    queryKey: ["scheduling-analytics-schedule", dateFrom, dateTo],
    queryFn: () =>
      schedulingService.scheduleAnalytics({
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
              value={
                waitlistStatsData.avg_wait_days != null
                  ? waitlistStatsData.avg_wait_days.toFixed(1)
                  : "—"
              }
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

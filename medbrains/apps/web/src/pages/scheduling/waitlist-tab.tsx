// Scheduling WaitlistTab — split from scheduling.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Drawer, Group, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import type { SchedulingWaitlistFormInput } from "@medbrains/schemas";
import { schedulingWaitlistFormSchema } from "@medbrains/schemas";
import type {
  AutoFillResult,
  CreateWaitlistRequest,
  SchedulingWaitlistEntry,
} from "@medbrains/types";
import { IconCheck, IconPlayerPlay, IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, IconButton, toast } from "@/components/ui";
import {
  schedulingOptionalText,
  schedulingPriorityOptions,
  toDateInputValue,
  toIsoDateInputValue,
} from "@/forms/scheduling.form";
import { schedulingService } from "@/services/scheduling.service";
import { formatDate, truncateId } from "./shared";

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

export function WaitlistTab({
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

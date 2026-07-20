import { zodResolver } from "@hookform/resolvers/zod";
import { AnalyticsTab } from "./scheduling/analytics-tab";
import { ConflictsTab } from "./scheduling/conflicts-tab";
import { OverbookingTab } from "./scheduling/overbooking-tab";
import { PredictionsTab } from "./scheduling/predictions-tab";
import { DAY_NAMES } from "./scheduling/shared";
import { WaitlistTab } from "./scheduling/waitlist-tab";
import "@mantine/charts/styles.css";
import {
  Card,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type {
  SchedulingBlockFormInput,
  SchedulingRecurringFormInput,
} from "@medbrains/schemas";
import { schedulingBlockFormSchema, schedulingRecurringFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CreateBlockRequest, CreateRecurringRequest } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBrain,
  IconCalendarPlus,
  IconChartBar,
  IconClockHour4,
  IconLock,
  IconSettings,
} from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { PageHeader } from "@/components";
import { Button, toast } from "@/components/ui";
import { schedulingInteger, schedulingResourceTypeOptions } from "@/forms/scheduling.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { schedulingService } from "@/services/scheduling.service";

// ── Constants ──────────────────────────────────────────

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

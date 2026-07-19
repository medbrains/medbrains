// IPD QueueConfigTab — split from front-office.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Drawer, Group, NumberInput, Select, Stack, Switch, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { QueueDisplayConfig, QueuePriorityRule, VisitingHours } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable, TableValueBadge } from "@/components";
import { Badge, Button } from "@/components/ui";
import type {
  FrontOfficeDisplayConfigFormInput,
  FrontOfficeQueuePriorityFormInput,
  FrontOfficeVisitingHoursFormInput,
} from "@/forms/front-office.form";
import {
  DAY_OPTIONS,
  DEFAULT_DISPLAY_CONFIG_FORM_VALUES,
  DEFAULT_QUEUE_PRIORITY_FORM_VALUES,
  DEFAULT_VISITING_HOURS_FORM_VALUES,
  DISPLAY_TYPE_OPTIONS,
  frontOfficeDisplayAllowsPatientNames,
  frontOfficeDisplayConfigFormSchema,
  frontOfficeQueuePriorityFormSchema,
  frontOfficeVisitingHoursFormSchema,
  QUEUE_PRIORITY_OPTIONS,
  toUpsertDisplayConfigRequest,
  toUpsertQueuePriorityRequest,
  toUpsertVisitingHoursRequest,
} from "@/forms/front-office.form";
import { frontOfficeService } from "@/services/frontOffice.service";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const priorityColors: Record<string, string> = {
  normal: "slate",
  elderly: "orange",
  disabled: "primary",
  pregnant: "danger",
  emergency_referral: "danger",
  vip: "violet",
};

export function QueueConfigTab({
  canManage,
  canManageVisitors,
}: {
  canManage: boolean;
  canManageVisitors: boolean;
}) {
  const qc = useQueryClient();
  const [ruleDrawer, ruleDrawerHandlers] = useDisclosure(false);
  const [configDrawer, configDrawerHandlers] = useDisclosure(false);
  const [hoursDrawer, hoursDrawerHandlers] = useDisclosure(false);

  const priorityForm = useForm<FrontOfficeQueuePriorityFormInput>({
    resolver: zodResolver(frontOfficeQueuePriorityFormSchema),
    defaultValues: DEFAULT_QUEUE_PRIORITY_FORM_VALUES,
  });

  const displayConfigForm = useForm<FrontOfficeDisplayConfigFormInput>({
    resolver: zodResolver(frontOfficeDisplayConfigFormSchema),
    defaultValues: DEFAULT_DISPLAY_CONFIG_FORM_VALUES,
  });
  const selectedDisplayConfigType = displayConfigForm.watch("display_type");
  const canShowDisplayPatientNames =
    frontOfficeDisplayAllowsPatientNames(selectedDisplayConfigType);

  const visitingHoursForm = useForm<FrontOfficeVisitingHoursFormInput>({
    resolver: zodResolver(frontOfficeVisitingHoursFormSchema),
    defaultValues: DEFAULT_VISITING_HOURS_FORM_VALUES,
  });

  const { data: rules, isLoading: loadingRules } = useQuery<QueuePriorityRule[]>({
    queryKey: ["front-office", "queue-priority"],
    queryFn: () => frontOfficeService.listQueuePriorityRules(),
  });

  const { data: configs, isLoading: loadingConfigs } = useQuery<QueueDisplayConfig[]>({
    queryKey: ["front-office", "display-config"],
    queryFn: () => frontOfficeService.listQueueDisplayConfig(),
  });

  const { data: hours, isLoading: loadingHours } = useQuery<VisitingHours[]>({
    queryKey: ["front-office", "visiting-hours"],
    queryFn: () => frontOfficeService.listVisitingHours(),
  });

  const createRule = useMutation({
    mutationFn: (data: FrontOfficeQueuePriorityFormInput) =>
      frontOfficeService.upsertQueuePriorityRule(toUpsertQueuePriorityRequest(data)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "queue-priority"] });
      ruleDrawerHandlers.close();
      priorityForm.reset(DEFAULT_QUEUE_PRIORITY_FORM_VALUES);
      notifications.show({ message: "Priority rule added", color: "success" });
    },
  });

  const createConfig = useMutation({
    mutationFn: (data: FrontOfficeDisplayConfigFormInput) =>
      frontOfficeService.upsertQueueDisplayConfig(toUpsertDisplayConfigRequest(data)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "display-config"] });
      configDrawerHandlers.close();
      displayConfigForm.reset(DEFAULT_DISPLAY_CONFIG_FORM_VALUES);
      notifications.show({ message: "Display config saved", color: "success" });
    },
  });

  const createHours = useMutation({
    mutationFn: (data: FrontOfficeVisitingHoursFormInput) =>
      frontOfficeService.upsertVisitingHours(toUpsertVisitingHoursRequest(data)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "visiting-hours"] });
      hoursDrawerHandlers.close();
      visitingHoursForm.reset(DEFAULT_VISITING_HOURS_FORM_VALUES);
      notifications.show({ message: "Visiting hours saved", color: "success" });
    },
  });

  const ruleColumns = [
    {
      key: "priority",
      label: "Priority",
      render: (r: QueuePriorityRule) => (
        <TableValueBadge
          value={r.priority}
          kind="priority"
          color={priorityColors[r.priority] ?? "slate"}
          variant="filled"
        />
      ),
    },
    { key: "weight", label: "Weight", render: (r: QueuePriorityRule) => String(r.weight) },
    {
      key: "is_active",
      label: "Active",
      render: (r: QueuePriorityRule) =>
        r.is_active ? (
          <TableValueBadge value="active" label="Yes" color="success" variant="filled" />
        ) : (
          <TableValueBadge value="inactive" label="No" color="slate" variant="filled" />
        ),
    },
  ];

  const configColumns = [
    { key: "location_name", label: "Location", render: (r: QueueDisplayConfig) => r.location_name },
    { key: "display_type", label: "Type", render: (r: QueueDisplayConfig) => r.display_type },
    {
      key: "doctors_per_screen",
      label: "Doctors/Screen",
      render: (r: QueueDisplayConfig) => String(r.doctors_per_screen),
    },
    {
      key: "show_wait_time",
      label: "Show Wait",
      render: (r: QueueDisplayConfig) => (r.show_wait_time ? "Yes" : "No"),
    },
    {
      key: "show_patient_name",
      label: "Privacy",
      render: (r: QueueDisplayConfig) => {
        const patientNamesAllowed = frontOfficeDisplayAllowsPatientNames(r.display_type);
        if (patientNamesAllowed && r.show_patient_name) {
          return (
            <TableValueBadge
              value="names_enabled"
              label="Names enabled"
              color="orange"
              variant="filled"
            />
          );
        }
        if (!patientNamesAllowed && r.show_patient_name) {
          return (
            <TableValueBadge
              value="names_blocked"
              label="Names blocked"
              color="danger"
              variant="filled"
            />
          );
        }
        return (
          <TableValueBadge value="token_only" label="Token-only" color="success" variant="filled" />
        );
      },
    },
    {
      key: "announcement_enabled",
      label: "Announce",
      render: (r: QueueDisplayConfig) => (r.announcement_enabled ? "Yes" : "No"),
    },
  ];

  const hoursColumns = [
    {
      key: "day_of_week",
      label: "Day",
      render: (r: VisitingHours) => DAY_NAMES[r.day_of_week] ?? String(r.day_of_week),
    },
    { key: "start_time", label: "Start", render: (r: VisitingHours) => r.start_time },
    { key: "end_time", label: "End", render: (r: VisitingHours) => r.end_time },
    {
      key: "max_visitors_per_patient",
      label: "Max Visitors",
      render: (r: VisitingHours) => String(r.max_visitors_per_patient),
    },
    {
      key: "is_active",
      label: "Active",
      render: (r: VisitingHours) =>
        r.is_active ? <Badge tone="success">Yes</Badge> : <Badge tone="neutral">No</Badge>,
    },
  ];

  return (
    <Stack gap="lg">
      {/* Visiting Hours */}
      <div>
        <Group justify="space-between" mb="sm">
          <Text fw={600}>Visiting Hours</Text>
          {canManageVisitors && (
            <Button
              tone="primary"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={hoursDrawerHandlers.open}
            >
              Add Hours
            </Button>
          )}
        </Group>
        <DataTable
          columns={hoursColumns}
          data={hours ?? []}
          loading={loadingHours}
          rowKey={(r: VisitingHours) => r.id}
        />
      </div>

      {/* Priority Rules */}
      <div>
        <Group justify="space-between" mb="sm">
          <Text fw={600}>Queue Priority Rules</Text>
          {canManage && (
            <Button
              tone="primary"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={ruleDrawerHandlers.open}
            >
              Add Rule
            </Button>
          )}
        </Group>
        <DataTable
          columns={ruleColumns}
          data={rules ?? []}
          loading={loadingRules}
          rowKey={(r: QueuePriorityRule) => r.id}
        />
      </div>

      {/* Display Config */}
      <div>
        <Group justify="space-between" mb="sm">
          <Text fw={600}>Display Configuration</Text>
          {canManage && (
            <Button
              tone="primary"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={configDrawerHandlers.open}
            >
              Add Config
            </Button>
          )}
        </Group>
        <DataTable
          columns={configColumns}
          data={configs ?? []}
          loading={loadingConfigs}
          rowKey={(r: QueueDisplayConfig) => r.id}
        />
      </div>

      {/* Priority Rule Drawer */}
      <Drawer
        opened={ruleDrawer}
        onClose={ruleDrawerHandlers.close}
        title="Add Priority Rule"
        position="right"
        size="sm"
      >
        <Stack
          component="form"
          gap="sm"
          onSubmit={priorityForm.handleSubmit((values) => createRule.mutate(values))}
        >
          <Controller
            control={priorityForm.control}
            name="priority"
            render={({ field, fieldState }) => (
              <Select
                label="Priority"
                data={QUEUE_PRIORITY_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={priorityForm.control}
            name="weight"
            render={({ field, fieldState }) => (
              <NumberInput
                label="Weight (higher = called sooner)"
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                min={1}
                max={100}
              />
            )}
          />
          <Button tone="primary" type="submit" loading={createRule.isPending}>
            Save
          </Button>
        </Stack>
      </Drawer>

      {/* Display Config Drawer */}
      <Drawer
        opened={configDrawer}
        onClose={configDrawerHandlers.close}
        title="Add Display Config"
        position="right"
        size="xl"
      >
        <Stack
          component="form"
          gap="sm"
          onSubmit={displayConfigForm.handleSubmit((values) => createConfig.mutate(values))}
        >
          <TextInput
            label="Location Name"
            required
            error={displayConfigForm.formState.errors.location_name?.message}
            {...displayConfigForm.register("location_name")}
          />
          <Controller
            control={displayConfigForm.control}
            name="display_type"
            render={({ field, fieldState }) => (
              <Select
                label="Display Type"
                data={DISPLAY_TYPE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={displayConfigForm.control}
            name="doctors_per_screen"
            render={({ field, fieldState }) => (
              <NumberInput
                label="Doctors Per Screen"
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                min={1}
                max={20}
              />
            )}
          />
          <Controller
            control={displayConfigForm.control}
            name="show_patient_name"
            render={({ field }) => (
              <Switch
                label="Show patient name on authorized staff displays"
                description={
                  canShowDisplayPatientNames
                    ? "Enable only for controlled team-room displays."
                    : "Waiting-area and counter displays are enforced as token-only."
                }
                checked={canShowDisplayPatientNames && field.value}
                disabled={!canShowDisplayPatientNames}
                onChange={(event) =>
                  field.onChange(canShowDisplayPatientNames && event.currentTarget.checked)
                }
              />
            )}
          />
          <Controller
            control={displayConfigForm.control}
            name="show_wait_time"
            render={({ field }) => (
              <Switch
                label="Show Wait Time"
                description="Allowed on public token boards when it does not reveal patient identity or clinical context."
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Controller
            control={displayConfigForm.control}
            name="announcement_enabled"
            render={({ field }) => (
              <Switch
                label="Enable Announcements"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Button tone="primary" type="submit" loading={createConfig.isPending}>
            Save
          </Button>
        </Stack>
      </Drawer>

      {/* Visiting Hours Drawer */}
      <Drawer
        opened={hoursDrawer}
        onClose={hoursDrawerHandlers.close}
        title="Add Visiting Hours"
        position="right"
        size="sm"
      >
        <Stack
          component="form"
          gap="sm"
          onSubmit={visitingHoursForm.handleSubmit((values) => createHours.mutate(values))}
        >
          <Controller
            control={visitingHoursForm.control}
            name="day_of_week"
            render={({ field, fieldState }) => (
              <Select
                label="Day of Week"
                data={DAY_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <TextInput
            label="Start Time"
            placeholder="HH:MM"
            error={visitingHoursForm.formState.errors.start_time?.message}
            {...visitingHoursForm.register("start_time")}
          />
          <TextInput
            label="End Time"
            placeholder="HH:MM"
            error={visitingHoursForm.formState.errors.end_time?.message}
            {...visitingHoursForm.register("end_time")}
          />
          <Controller
            control={visitingHoursForm.control}
            name="max_visitors_per_patient"
            render={({ field, fieldState }) => (
              <NumberInput
                label="Max Visitors Per Patient"
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                min={1}
                max={10}
              />
            )}
          />
          <Button tone="primary" type="submit" loading={createHours.isPending}>
            Save
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 4 — Enquiry Desk
// ══════════════════════════════════════════════════════════

import { zodResolver } from "@hookform/resolvers/zod";
import { BarChart } from "@mantine/charts";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  FrontOfficeEnquiryLog,
  QueueDisplayConfig,
  QueueMetrics,
  QueuePriorityRule,
  QueueStatsResponse,
  VisitingHours,
  VisitorAnalytics,
  VisitorLog,
  VisitorPass,
  VisitorRegistration,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconChartBar,
  IconCheck,
  IconClock,
  IconDoorEnter,
  IconGauge,
  IconPhone,
  IconPlus,
  IconQrcode,
  IconSettings,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, PageHeader } from "../components";
import type { Column } from "../components/DataTable";
import {
  DAY_OPTIONS,
  DEFAULT_DISPLAY_CONFIG_FORM_VALUES,
  DEFAULT_ENQUIRY_FORM_VALUES,
  DEFAULT_QUEUE_PRIORITY_FORM_VALUES,
  DEFAULT_VISITING_HOURS_FORM_VALUES,
  DEFAULT_VISITOR_FORM_VALUES,
  DEFAULT_VISITOR_PASS_FORM_VALUES,
  DISPLAY_TYPE_OPTIONS,
  ENQUIRY_TYPE_OPTIONS,
  type FrontOfficeDisplayConfigFormInput,
  type FrontOfficeEnquiryFormInput,
  type FrontOfficeQueuePriorityFormInput,
  type FrontOfficeVisitingHoursFormInput,
  type FrontOfficeVisitorFormInput,
  type FrontOfficeVisitorPassFormInput,
  frontOfficeDisplayConfigFormSchema,
  frontOfficeEnquiryFormSchema,
  frontOfficeQueuePriorityFormSchema,
  frontOfficeVisitingHoursFormSchema,
  frontOfficeVisitorFormSchema,
  frontOfficeVisitorPassFormSchema,
  QUEUE_PRIORITY_OPTIONS,
  toCreateEnquiryRequest,
  toCreateVisitorPassRequest,
  toCreateVisitorRequest,
  toUpsertDisplayConfigRequest,
  toUpsertQueuePriorityRequest,
  toUpsertVisitingHoursRequest,
  VISITOR_CATEGORY_OPTIONS,
  VISITOR_ID_TYPE_OPTIONS,
} from "../forms/front-office.form";
import { useRequirePermission } from "../hooks/useRequirePermission";
import { frontOfficeService } from "../services/frontOffice.service";

// ── Constants ──────────────────────────────────────────

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const passStatusColors: Record<string, string> = {
  active: "success",
  expired: "slate",
  revoked: "danger",
};

const priorityColors: Record<string, string> = {
  normal: "slate",
  elderly: "orange",
  disabled: "primary",
  pregnant: "danger",
  emergency_referral: "danger",
  vip: "violet",
};

// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════

export function FrontOfficePage() {
  useRequirePermission(P.FRONT_OFFICE.QUEUE_LIST);

  const canManageVisitors = useHasPermission(P.FRONT_OFFICE.VISITORS_MANAGE);
  const canCreateVisitors = useHasPermission(P.FRONT_OFFICE.VISITORS_CREATE);
  const canManagePasses = useHasPermission(P.FRONT_OFFICE.PASSES_MANAGE);
  const canManageQueue = useHasPermission(P.FRONT_OFFICE.QUEUE_MANAGE);
  const canCreateEnquiry = useHasPermission(P.FRONT_OFFICE.ENQUIRY_CREATE);
  const canManageEnquiry = useHasPermission(P.FRONT_OFFICE.ENQUIRY_MANAGE);

  return (
    <div>
      <PageHeader
        title="Front Office"
        subtitle="Queue dashboard, visitor management & enquiry desk"
      />
      <Tabs defaultValue="queue">
        <Tabs.List>
          <Tabs.Tab value="queue" leftSection={<IconUsers size={16} />}>
            Queue Dashboard
          </Tabs.Tab>
          <Tabs.Tab value="visitors" leftSection={<IconDoorEnter size={16} />}>
            Visitor Management
          </Tabs.Tab>
          <Tabs.Tab value="config" leftSection={<IconSettings size={16} />}>
            Queue Configuration
          </Tabs.Tab>
          <Tabs.Tab value="enquiry" leftSection={<IconPhone size={16} />}>
            Enquiry Desk
          </Tabs.Tab>
          <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
            Visitor Analytics
          </Tabs.Tab>
          <Tabs.Tab value="metrics" leftSection={<IconGauge size={16} />}>
            Queue Metrics
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="queue" pt="md">
          <QueueDashboardTab />
        </Tabs.Panel>
        <Tabs.Panel value="visitors" pt="md">
          <VisitorManagementTab canCreate={canCreateVisitors} canManagePasses={canManagePasses} />
        </Tabs.Panel>
        <Tabs.Panel value="config" pt="md">
          <QueueConfigTab canManage={canManageQueue} canManageVisitors={canManageVisitors} />
        </Tabs.Panel>
        <Tabs.Panel value="enquiry" pt="md">
          <EnquiryDeskTab canCreate={canCreateEnquiry} canManage={canManageEnquiry} />
        </Tabs.Panel>
        <Tabs.Panel value="analytics" pt="md">
          <VisitorAnalyticsTab />
        </Tabs.Panel>
        <Tabs.Panel value="metrics" pt="md">
          <QueueMetricsTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 1 — Queue Dashboard
// ══════════════════════════════════════════════════════════

function QueueDashboardTab() {
  const { data: stats, isLoading } = useQuery<QueueStatsResponse[]>({
    queryKey: ["front-office", "queue-stats"],
    queryFn: () => frontOfficeService.getQueueStats(),
  });

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Real-time queue statistics across departments (today)
      </Text>
      {isLoading && <Text size="sm">Loading...</Text>}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
        {stats?.map((s) => (
          <Card key={s.department_id ?? "all"} withBorder padding="md">
            <Text fw={600} size="sm">
              {s.department_id ?? "All Departments"}
            </Text>
            <Group mt="xs" gap="lg">
              <div>
                <Text size="xl" fw={700} c="primary">
                  {s.waiting_count}
                </Text>
                <Text size="xs" c="dimmed">
                  Waiting
                </Text>
              </div>
              <div>
                <Text size="xl" fw={700} c="orange">
                  {s.avg_wait_minutes != null ? `${Math.round(s.avg_wait_minutes)} min` : "—"}
                </Text>
                <Text size="xs" c="dimmed">
                  Avg Wait
                </Text>
              </div>
            </Group>
          </Card>
        ))}
        {stats?.length === 0 && (
          <Text size="sm" c="dimmed">
            No queue data for today
          </Text>
        )}
      </SimpleGrid>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 2 — Visitor Management
// ══════════════════════════════════════════════════════════

function VisitorManagementTab({
  canCreate,
  canManagePasses,
}: {
  canCreate: boolean;
  canManagePasses: boolean;
}) {
  const qc = useQueryClient();
  const [visitorDrawer, visitorDrawerHandlers] = useDisclosure(false);
  const [passDrawer, passDrawerHandlers] = useDisclosure(false);
  const [selectedRegistration, setSelectedRegistration] = useState<string | null>(null);

  const visitorForm = useForm<FrontOfficeVisitorFormInput>({
    resolver: zodResolver(frontOfficeVisitorFormSchema),
    defaultValues: DEFAULT_VISITOR_FORM_VALUES,
  });

  const passForm = useForm<FrontOfficeVisitorPassFormInput>({
    resolver: zodResolver(frontOfficeVisitorPassFormSchema),
    defaultValues: DEFAULT_VISITOR_PASS_FORM_VALUES,
  });

  const { data: visitors, isLoading: loadingVisitors } = useQuery<VisitorRegistration[]>({
    queryKey: ["front-office", "visitors"],
    queryFn: () => frontOfficeService.listVisitors(),
  });

  const { data: passes, isLoading: loadingPasses } = useQuery<VisitorPass[]>({
    queryKey: ["front-office", "passes"],
    queryFn: () => frontOfficeService.listVisitorPasses(),
  });

  const { data: logs } = useQuery<VisitorLog[]>({
    queryKey: ["front-office", "visitor-logs"],
    queryFn: () => frontOfficeService.listVisitorLogs({ active_only: "true" }),
  });

  const createVisitor = useMutation({
    mutationFn: (data: FrontOfficeVisitorFormInput) =>
      frontOfficeService.createVisitor(toCreateVisitorRequest(data)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "visitors"] });
      visitorDrawerHandlers.close();
      notifications.show({ message: "Visitor registered", color: "success" });
      visitorForm.reset(DEFAULT_VISITOR_FORM_VALUES);
    },
  });

  const createPass = useMutation({
    mutationFn: (data: FrontOfficeVisitorPassFormInput) =>
      selectedRegistration
        ? frontOfficeService.createVisitorPass(
            toCreateVisitorPassRequest(selectedRegistration, data),
          )
        : Promise.reject(new Error("Select a visitor registration before issuing a pass")),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "passes"] });
      passDrawerHandlers.close();
      passForm.reset(DEFAULT_VISITOR_PASS_FORM_VALUES);
      notifications.show({ message: "Pass issued", color: "success" });
    },
  });

  const revokePass = useMutation({
    mutationFn: (id: string) =>
      frontOfficeService.revokeVisitorPass(id, { reason: "Revoked by staff" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "passes"] });
      notifications.show({ message: "Pass revoked", color: "orange" });
    },
  });

  const checkIn = useMutation({
    mutationFn: (passId: string) => frontOfficeService.checkInVisitor(passId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "visitor-logs"] });
      notifications.show({ message: "Visitor checked in", color: "success" });
    },
  });

  const checkOut = useMutation({
    mutationFn: (passId: string) => frontOfficeService.checkOutVisitor(passId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "visitor-logs"] });
      notifications.show({ message: "Visitor checked out", color: "primary" });
    },
  });

  const visitorColumns = [
    { key: "visitor_name", label: "Name", render: (r: VisitorRegistration) => r.visitor_name },
    { key: "phone", label: "Phone", render: (r: VisitorRegistration) => r.phone ?? "—" },
    {
      key: "category",
      label: "Category",
      render: (r: VisitorRegistration) => (
        <Badge size="sm" variant="light">
          {r.category}
        </Badge>
      ),
    },
    { key: "id_type", label: "ID Type", render: (r: VisitorRegistration) => r.id_type ?? "—" },
    { key: "purpose", label: "Purpose", render: (r: VisitorRegistration) => r.purpose ?? "—" },
    {
      key: "created_at",
      label: "Registered",
      render: (r: VisitorRegistration) => new Date(r.created_at).toLocaleString(),
    },
    {
      key: "actions",
      label: "",
      render: (r: VisitorRegistration) =>
        canManagePasses ? (
          <Tooltip label="Issue Pass">
            <ActionIcon
              variant="light"
              color="primary"
              onClick={() => {
                setSelectedRegistration(r.id);
                passDrawerHandlers.open();
              }}
              aria-label="QR code"
            >
              <IconQrcode size={16} />
            </ActionIcon>
          </Tooltip>
        ) : null,
    },
  ];

  const passColumns = [
    { key: "pass_number", label: "Pass #", render: (r: VisitorPass) => r.pass_number },
    {
      key: "status",
      label: "Status",
      render: (r: VisitorPass) => (
        <Badge color={passStatusColors[r.status] ?? "slate"}>{r.status}</Badge>
      ),
    },
    {
      key: "valid_from",
      label: "Valid From",
      render: (r: VisitorPass) => new Date(r.valid_from).toLocaleString(),
    },
    {
      key: "valid_until",
      label: "Valid Until",
      render: (r: VisitorPass) => new Date(r.valid_until).toLocaleString(),
    },
    { key: "bed_number", label: "Bed", render: (r: VisitorPass) => r.bed_number ?? "—" },
    {
      key: "actions",
      label: "",
      render: (r: VisitorPass) => (
        <Group gap="xs">
          {r.status === "active" && canManagePasses && (
            <>
              <Tooltip label="Check In">
                <ActionIcon
                  variant="light"
                  color="success"
                  onClick={() => checkIn.mutate(r.id)}
                  aria-label="Confirm"
                >
                  <IconCheck size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Check Out">
                <ActionIcon
                  variant="light"
                  color="primary"
                  onClick={() => checkOut.mutate(r.id)}
                  aria-label="Time"
                >
                  <IconClock size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Revoke">
                <ActionIcon
                  variant="light"
                  color="danger"
                  onClick={() => revokePass.mutate(r.id)}
                  aria-label="Close"
                >
                  <IconX size={16} />
                </ActionIcon>
              </Tooltip>
            </>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack gap="lg">
      {/* Visitors */}
      <div>
        <Group justify="space-between" mb="sm">
          <Text fw={600}>Visitor Registrations</Text>
          {canCreate && (
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={visitorDrawerHandlers.open}
            >
              Register Visitor
            </Button>
          )}
        </Group>
        <DataTable
          columns={visitorColumns}
          data={visitors ?? []}
          loading={loadingVisitors}
          rowKey={(r: VisitorRegistration) => r.id}
        />
      </div>

      {/* Active Passes */}
      <div>
        <Group justify="space-between" mb="sm">
          <Text fw={600}>
            Visitor Passes ({passes?.filter((p) => p.status === "active").length ?? 0} active)
          </Text>
        </Group>
        <DataTable
          columns={passColumns}
          data={passes ?? []}
          loading={loadingPasses}
          rowKey={(r: VisitorPass) => r.id}
        />
      </div>

      {/* Active visitor count */}
      {logs && logs.length > 0 && (
        <Text size="sm" c="dimmed">
          Currently inside: {logs.length} visitor(s)
        </Text>
      )}

      {/* Register Visitor Drawer */}
      <Drawer
        opened={visitorDrawer}
        onClose={visitorDrawerHandlers.close}
        title="Register Visitor"
        position="right"
        size="xl"
      >
        <Stack
          component="form"
          gap="sm"
          onSubmit={visitorForm.handleSubmit((values) => createVisitor.mutate(values))}
        >
          <TextInput
            label="Visitor Name"
            required
            error={visitorForm.formState.errors.visitor_name?.message}
            {...visitorForm.register("visitor_name")}
          />
          <TextInput
            label="Phone"
            error={visitorForm.formState.errors.phone?.message}
            {...visitorForm.register("phone")}
          />
          <Controller
            control={visitorForm.control}
            name="id_type"
            render={({ field, fieldState }) => (
              <Select
                label="ID Type"
                data={VISITOR_ID_TYPE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                clearable
              />
            )}
          />
          <TextInput
            label="ID Number"
            error={visitorForm.formState.errors.id_number?.message}
            {...visitorForm.register("id_number")}
          />
          <TextInput
            label="Relationship"
            error={visitorForm.formState.errors.relationship?.message}
            {...visitorForm.register("relationship")}
          />
          <Controller
            control={visitorForm.control}
            name="category"
            render={({ field, fieldState }) => (
              <Select
                label="Category"
                data={VISITOR_CATEGORY_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Textarea
            label="Purpose"
            error={visitorForm.formState.errors.purpose?.message}
            {...visitorForm.register("purpose")}
          />
          <Button type="submit" loading={createVisitor.isPending}>
            Register
          </Button>
        </Stack>
      </Drawer>

      {/* Issue Pass Drawer */}
      <Drawer
        opened={passDrawer}
        onClose={passDrawerHandlers.close}
        title="Issue Visitor Pass"
        position="right"
        size="sm"
      >
        <Stack
          component="form"
          gap="sm"
          onSubmit={passForm.handleSubmit((values) => createPass.mutate(values))}
        >
          <Text size="sm" c="dimmed">
            Issuing pass for registration: {selectedRegistration?.slice(0, 8)}...
          </Text>
          <Controller
            control={passForm.control}
            name="valid_hours"
            render={({ field, fieldState }) => (
              <NumberInput
                label="Valid Hours"
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                min={1}
                max={24}
              />
            )}
          />
          <Button type="submit" loading={createPass.isPending} disabled={!selectedRegistration}>
            Issue Pass
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 3 — Queue Configuration
// ══════════════════════════════════════════════════════════

function QueueConfigTab({
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
        <Badge color={priorityColors[r.priority] ?? "slate"}>{r.priority}</Badge>
      ),
    },
    { key: "weight", label: "Weight", render: (r: QueuePriorityRule) => String(r.weight) },
    {
      key: "is_active",
      label: "Active",
      render: (r: QueuePriorityRule) =>
        r.is_active ? <Badge color="success">Yes</Badge> : <Badge color="slate">No</Badge>,
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
        r.is_active ? <Badge color="success">Yes</Badge> : <Badge color="slate">No</Badge>,
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
          <Button type="submit" loading={createRule.isPending}>
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
                label="Show Patient Name"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Controller
            control={displayConfigForm.control}
            name="show_wait_time"
            render={({ field }) => (
              <Switch
                label="Show Wait Time"
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
          <Button type="submit" loading={createConfig.isPending}>
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
          <Button type="submit" loading={createHours.isPending}>
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

function EnquiryDeskTab({ canCreate, canManage }: { canCreate: boolean; canManage: boolean }) {
  const qc = useQueryClient();
  const [drawer, drawerHandlers] = useDisclosure(false);

  const enquiryForm = useForm<FrontOfficeEnquiryFormInput>({
    resolver: zodResolver(frontOfficeEnquiryFormSchema),
    defaultValues: DEFAULT_ENQUIRY_FORM_VALUES,
  });

  const { data: enquiries, isLoading } = useQuery<FrontOfficeEnquiryLog[]>({
    queryKey: ["front-office", "enquiries"],
    queryFn: () => frontOfficeService.listEnquiries(),
  });

  const createEnquiry = useMutation({
    mutationFn: (data: FrontOfficeEnquiryFormInput) =>
      frontOfficeService.createEnquiry(toCreateEnquiryRequest(data)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "enquiries"] });
      drawerHandlers.close();
      notifications.show({ message: "Enquiry logged", color: "success" });
      enquiryForm.reset(DEFAULT_ENQUIRY_FORM_VALUES);
    },
  });

  const resolveEnquiry = useMutation({
    mutationFn: (id: string) => frontOfficeService.resolveEnquiry(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "enquiries"] });
      notifications.show({ message: "Enquiry resolved", color: "success" });
    },
  });

  const columns = [
    {
      key: "caller_name",
      label: "Caller",
      render: (r: FrontOfficeEnquiryLog) => r.caller_name ?? "—",
    },
    {
      key: "caller_phone",
      label: "Phone",
      render: (r: FrontOfficeEnquiryLog) => r.caller_phone ?? "—",
    },
    {
      key: "enquiry_type",
      label: "Type",
      render: (r: FrontOfficeEnquiryLog) => (
        <Badge variant="light" size="sm">
          {r.enquiry_type}
        </Badge>
      ),
    },
    {
      key: "response_text",
      label: "Response",
      render: (r: FrontOfficeEnquiryLog) => r.response_text ?? "—",
    },
    {
      key: "resolved",
      label: "Resolved",
      render: (r: FrontOfficeEnquiryLog) =>
        r.resolved ? <Badge color="success">Yes</Badge> : <Badge color="orange">No</Badge>,
    },
    {
      key: "created_at",
      label: "Time",
      render: (r: FrontOfficeEnquiryLog) => new Date(r.created_at).toLocaleString(),
    },
    {
      key: "actions",
      label: "",
      render: (r: FrontOfficeEnquiryLog) =>
        !r.resolved && canManage ? (
          <Tooltip label="Mark Resolved">
            <ActionIcon
              variant="light"
              color="success"
              onClick={() => resolveEnquiry.mutate(r.id)}
              aria-label="Confirm"
            >
              <IconCheck size={16} />
            </ActionIcon>
          </Tooltip>
        ) : null,
    },
  ];

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600}>Enquiry Log</Text>
        {canCreate && (
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={drawerHandlers.open}>
            Log Enquiry
          </Button>
        )}
      </Group>
      <DataTable
        columns={columns}
        data={enquiries ?? []}
        loading={isLoading}
        rowKey={(r: FrontOfficeEnquiryLog) => r.id}
      />

      <Drawer
        opened={drawer}
        onClose={drawerHandlers.close}
        title="Log Enquiry"
        position="right"
        size="xl"
      >
        <Stack
          component="form"
          gap="sm"
          onSubmit={enquiryForm.handleSubmit((values) => createEnquiry.mutate(values))}
        >
          <TextInput
            label="Caller Name"
            error={enquiryForm.formState.errors.caller_name?.message}
            {...enquiryForm.register("caller_name")}
          />
          <TextInput
            label="Caller Phone"
            error={enquiryForm.formState.errors.caller_phone?.message}
            {...enquiryForm.register("caller_phone")}
          />
          <Controller
            control={enquiryForm.control}
            name="enquiry_type"
            render={({ field, fieldState }) => (
              <Select
                label="Enquiry Type"
                data={ENQUIRY_TYPE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Textarea
            label="Response"
            error={enquiryForm.formState.errors.response_text?.message}
            rows={3}
            {...enquiryForm.register("response_text")}
          />
          <Button type="submit" loading={createEnquiry.isPending}>
            Log Enquiry
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 5 — Visitor Analytics
// ══════════════════════════════════════════════════════════

function VisitorAnalyticsTab() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: analytics, isLoading } = useQuery<VisitorAnalytics>({
    queryKey: ["front-office", "visitor-analytics", from, to],
    queryFn: () =>
      frontOfficeService.visitorAnalytics({ from: from || undefined, to: to || undefined }),
  });

  const byDeptChart = analytics
    ? Object.entries(analytics.by_department).map(([dept, count]) => ({
        department: dept,
        visitors: count,
      }))
    : [];

  const byHourChart = analytics
    ? Object.entries(analytics.by_hour).map(([hour, count]) => ({
        hour,
        visitors: count,
      }))
    : [];

  return (
    <Stack gap="md">
      <Group>
        <TextInput
          placeholder="From date"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.currentTarget.value)}
          w={160}
        />
        <TextInput
          placeholder="To date"
          type="date"
          value={to}
          onChange={(e) => setTo(e.currentTarget.value)}
          w={160}
        />
      </Group>

      {isLoading && (
        <Text size="sm" c="dimmed">
          Loading analytics...
        </Text>
      )}

      {analytics && (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Card withBorder p="md">
              <Text size="xs" c="dimmed">
                Total Visitors
              </Text>
              <Text size="xl" fw={700} c="primary">
                {analytics.total_visitors}
              </Text>
            </Card>
            <Card withBorder p="md">
              <Text size="xs" c="dimmed">
                Avg Visit Duration
              </Text>
              <Text size="xl" fw={700} c="orange">
                {Math.round(analytics.avg_visit_duration_minutes)} min
              </Text>
            </Card>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Card withBorder p="sm">
              <Text fw={600} size="sm" mb="sm">
                Visitors by Department
              </Text>
              {byDeptChart.length > 0 ? (
                <BarChart
                  h={220}
                  data={byDeptChart}
                  dataKey="department"
                  series={[{ name: "visitors", color: "primary" }]}
                />
              ) : (
                <Text size="sm" c="dimmed">
                  No data
                </Text>
              )}
            </Card>
            <Card withBorder p="sm">
              <Text fw={600} size="sm" mb="sm">
                Visitors by Hour
              </Text>
              {byHourChart.length > 0 ? (
                <BarChart
                  h={220}
                  data={byHourChart}
                  dataKey="hour"
                  series={[{ name: "visitors", color: "teal" }]}
                />
              ) : (
                <Text size="sm" c="dimmed">
                  No data
                </Text>
              )}
            </Card>
          </SimpleGrid>
        </>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 6 — Queue Metrics
// ══════════════════════════════════════════════════════════

function QueueMetricsTab() {
  const { data: metrics = [], isLoading } = useQuery<QueueMetrics[]>({
    queryKey: ["front-office", "queue-metrics"],
    queryFn: () => frontOfficeService.queueMetrics(),
  });

  const cols: Column<QueueMetrics>[] = [
    {
      key: "department",
      label: "Department",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.department}
        </Text>
      ),
    },
    {
      key: "current_waiting",
      label: "Currently Waiting",
      render: (r) => (
        <Badge
          color={r.current_waiting > 10 ? "danger" : r.current_waiting > 5 ? "orange" : "success"}
        >
          {r.current_waiting}
        </Badge>
      ),
    },
    {
      key: "avg_wait_minutes",
      label: "Avg Wait (min)",
      render: (r) => <Text size="sm">{Math.round(r.avg_wait_minutes)}</Text>,
    },
    {
      key: "longest_wait_minutes",
      label: "Longest Wait (min)",
      render: (r) => (
        <Text size="sm" c={r.longest_wait_minutes > 30 ? "danger" : undefined}>
          {Math.round(r.longest_wait_minutes)}
        </Text>
      ),
    },
    {
      key: "throughput_per_hour",
      label: "Throughput/hr",
      render: (r) => <Text size="sm">{r.throughput_per_hour.toFixed(1)}</Text>,
    },
  ];

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Real-time queue performance metrics by department
      </Text>
      <DataTable columns={cols} data={metrics} loading={isLoading} rowKey={(r) => r.department} />
    </Stack>
  );
}

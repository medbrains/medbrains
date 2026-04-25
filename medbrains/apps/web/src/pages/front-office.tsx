import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
  SimpleGrid,
  Card,
  Switch,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconDoorEnter,
  IconQrcode,
  IconCheck,
  IconX,
  IconClock,
  IconPhone,
  IconSettings,
  IconUsers,
  IconChartBar,
  IconGauge,
} from "@tabler/icons-react";
import { BarChart } from "@mantine/charts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  VisitingHours,
  VisitorRegistration,
  VisitorPass,
  VisitorLog,
  QueuePriorityRule,
  QueueDisplayConfig,
  FrontOfficeEnquiryLog,
  QueueStatsResponse,
  UpsertVisitingHoursRequest,
  CreateVisitorRequest,
  CreateVisitorPassRequest,
  UpsertQueuePriorityRequest,
  UpsertDisplayConfigRequest,
  CreateEnquiryRequest,
  VisitorAnalytics as VisitorAnalyticsType,
  QueueMetrics as QueueMetricsRow,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../components";
import type { Column } from "../components/DataTable";
import { useRequirePermission } from "../hooks/useRequirePermission";

// ── Constants ──────────────────────────────────────────

const VISITOR_CATEGORIES = [
  { value: "general", label: "General" },
  { value: "legal_counsel", label: "Legal Counsel" },
  { value: "religious", label: "Religious" },
  { value: "vip", label: "VIP" },
  { value: "media", label: "Media" },
  { value: "vendor", label: "Vendor" },
  { value: "emergency", label: "Emergency" },
];

const ID_TYPES = [
  { value: "aadhaar", label: "Aadhaar" },
  { value: "driving_license", label: "Driving License" },
  { value: "passport", label: "Passport" },
  { value: "pan", label: "PAN Card" },
  { value: "voter_id", label: "Voter ID" },
];

const QUEUE_PRIORITIES = [
  { value: "normal", label: "Normal" },
  { value: "elderly", label: "Elderly" },
  { value: "disabled", label: "Disabled" },
  { value: "pregnant", label: "Pregnant" },
  { value: "emergency_referral", label: "Emergency Referral" },
  { value: "vip", label: "VIP" },
];

const ENQUIRY_TYPES = [
  { value: "patient_status", label: "Patient Status" },
  { value: "visiting_hours", label: "Visiting Hours" },
  { value: "doctor_availability", label: "Doctor Availability" },
  { value: "general", label: "General" },
  { value: "billing", label: "Billing" },
];

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
      <PageHeader title="Front Office" subtitle="Queue dashboard, visitor management & enquiry desk" />
      <Tabs defaultValue="queue">
        <Tabs.List>
          <Tabs.Tab value="queue" leftSection={<IconUsers size={16} />}>Queue Dashboard</Tabs.Tab>
          <Tabs.Tab value="visitors" leftSection={<IconDoorEnter size={16} />}>Visitor Management</Tabs.Tab>
          <Tabs.Tab value="config" leftSection={<IconSettings size={16} />}>Queue Configuration</Tabs.Tab>
          <Tabs.Tab value="enquiry" leftSection={<IconPhone size={16} />}>Enquiry Desk</Tabs.Tab>
          <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>Visitor Analytics</Tabs.Tab>
          <Tabs.Tab value="metrics" leftSection={<IconGauge size={16} />}>Queue Metrics</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="queue" pt="md"><QueueDashboardTab /></Tabs.Panel>
        <Tabs.Panel value="visitors" pt="md">
          <VisitorManagementTab
            canCreate={canCreateVisitors}
            canManagePasses={canManagePasses}
          />
        </Tabs.Panel>
        <Tabs.Panel value="config" pt="md">
          <QueueConfigTab canManage={canManageQueue} canManageVisitors={canManageVisitors} />
        </Tabs.Panel>
        <Tabs.Panel value="enquiry" pt="md">
          <EnquiryDeskTab canCreate={canCreateEnquiry} canManage={canManageEnquiry} />
        </Tabs.Panel>
        <Tabs.Panel value="analytics" pt="md"><VisitorAnalyticsTab /></Tabs.Panel>
        <Tabs.Panel value="metrics" pt="md"><QueueMetricsTab /></Tabs.Panel>
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
    queryFn: () => api.getQueueStats(),
  });

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">Real-time queue statistics across departments (today)</Text>
      {isLoading && <Text size="sm">Loading...</Text>}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
        {stats?.map((s) => (
          <Card key={s.department_id ?? "all"} withBorder padding="md">
            <Text fw={600} size="sm">{s.department_id ?? "All Departments"}</Text>
            <Group mt="xs" gap="lg">
              <div>
                <Text size="xl" fw={700} c="primary">{s.waiting_count}</Text>
                <Text size="xs" c="dimmed">Waiting</Text>
              </div>
              <div>
                <Text size="xl" fw={700} c="orange">
                  {s.avg_wait_minutes != null ? `${Math.round(s.avg_wait_minutes)} min` : "—"}
                </Text>
                <Text size="xs" c="dimmed">Avg Wait</Text>
              </div>
            </Group>
          </Card>
        ))}
        {stats?.length === 0 && (
          <Text size="sm" c="dimmed">No queue data for today</Text>
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

  // Visitor form state
  const [vName, setVName] = useState("");
  const [vPhone, setVPhone] = useState("");
  const [vIdType, setVIdType] = useState<string | null>(null);
  const [vIdNumber, setVIdNumber] = useState("");
  const [vRelationship, setVRelationship] = useState("");
  const [vCategory, setVCategory] = useState<string | null>("general");
  const [vPurpose, setVPurpose] = useState("");

  // Pass form state
  const [passHours, setPassHours] = useState<number | string>(2);

  const { data: visitors, isLoading: loadingVisitors } = useQuery<VisitorRegistration[]>({
    queryKey: ["front-office", "visitors"],
    queryFn: () => api.listVisitors(),
  });

  const { data: passes, isLoading: loadingPasses } = useQuery<VisitorPass[]>({
    queryKey: ["front-office", "passes"],
    queryFn: () => api.listVisitorPasses(),
  });

  const { data: logs } = useQuery<VisitorLog[]>({
    queryKey: ["front-office", "visitor-logs"],
    queryFn: () => api.listVisitorLogs({ active_only: "true" }),
  });

  const createVisitor = useMutation({
    mutationFn: (data: CreateVisitorRequest) => api.createVisitor(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "visitors"] });
      visitorDrawerHandlers.close();
      notifications.show({ message: "Visitor registered", color: "success" });
      setVName(""); setVPhone(""); setVIdType(null); setVIdNumber("");
      setVRelationship(""); setVCategory("general"); setVPurpose("");
    },
  });

  const createPass = useMutation({
    mutationFn: (data: CreateVisitorPassRequest) => api.createVisitorPass(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "passes"] });
      passDrawerHandlers.close();
      notifications.show({ message: "Pass issued", color: "success" });
    },
  });

  const revokePass = useMutation({
    mutationFn: (id: string) => api.revokeVisitorPass(id, { reason: "Revoked by staff" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "passes"] });
      notifications.show({ message: "Pass revoked", color: "orange" });
    },
  });

  const checkIn = useMutation({
    mutationFn: (passId: string) => api.checkInVisitor(passId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "visitor-logs"] });
      notifications.show({ message: "Visitor checked in", color: "success" });
    },
  });

  const checkOut = useMutation({
    mutationFn: (passId: string) => api.checkOutVisitor(passId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "visitor-logs"] });
      notifications.show({ message: "Visitor checked out", color: "primary" });
    },
  });

  const visitorColumns = [
    { key: "visitor_name", label: "Name", render: (r: VisitorRegistration) => r.visitor_name },
    { key: "phone", label: "Phone", render: (r: VisitorRegistration) => r.phone ?? "—" },
    {
      key: "category", label: "Category",
      render: (r: VisitorRegistration) => <Badge size="sm" variant="light">{r.category}</Badge>,
    },
    { key: "id_type", label: "ID Type", render: (r: VisitorRegistration) => r.id_type ?? "—" },
    { key: "purpose", label: "Purpose", render: (r: VisitorRegistration) => r.purpose ?? "—" },
    { key: "created_at", label: "Registered", render: (r: VisitorRegistration) => new Date(r.created_at).toLocaleString() },
    {
      key: "actions", label: "",
      render: (r: VisitorRegistration) =>
        canManagePasses ? (
          <Tooltip label="Issue Pass">
            <ActionIcon
              variant="light"
              color="primary"
              onClick={() => { setSelectedRegistration(r.id); passDrawerHandlers.open(); }}
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
      key: "status", label: "Status",
      render: (r: VisitorPass) => <Badge color={passStatusColors[r.status] ?? "slate"}>{r.status}</Badge>,
    },
    { key: "valid_from", label: "Valid From", render: (r: VisitorPass) => new Date(r.valid_from).toLocaleString() },
    { key: "valid_until", label: "Valid Until", render: (r: VisitorPass) => new Date(r.valid_until).toLocaleString() },
    { key: "bed_number", label: "Bed", render: (r: VisitorPass) => r.bed_number ?? "—" },
    {
      key: "actions", label: "",
      render: (r: VisitorPass) => (
        <Group gap="xs">
          {r.status === "active" && canManagePasses && (
            <>
              <Tooltip label="Check In">
                <ActionIcon variant="light" color="success" onClick={() => checkIn.mutate(r.id)} aria-label="Confirm">
                  <IconCheck size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Check Out">
                <ActionIcon variant="light" color="primary" onClick={() => checkOut.mutate(r.id)} aria-label="Time">
                  <IconClock size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Revoke">
                <ActionIcon variant="light" color="danger" onClick={() => revokePass.mutate(r.id)} aria-label="Close">
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
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={visitorDrawerHandlers.open}>
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
          <Text fw={600}>Visitor Passes ({passes?.filter((p) => p.status === "active").length ?? 0} active)</Text>
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
      <Drawer opened={visitorDrawer} onClose={visitorDrawerHandlers.close} title="Register Visitor" position="right" size="xl">
        <Stack gap="sm">
          <TextInput label="Visitor Name" required value={vName} onChange={(e) => setVName(e.currentTarget.value)} />
          <TextInput label="Phone" value={vPhone} onChange={(e) => setVPhone(e.currentTarget.value)} />
          <Select label="ID Type" data={ID_TYPES} value={vIdType} onChange={setVIdType} clearable />
          <TextInput label="ID Number" value={vIdNumber} onChange={(e) => setVIdNumber(e.currentTarget.value)} />
          <TextInput label="Relationship" value={vRelationship} onChange={(e) => setVRelationship(e.currentTarget.value)} />
          <Select label="Category" data={VISITOR_CATEGORIES} value={vCategory} onChange={setVCategory} />
          <Textarea label="Purpose" value={vPurpose} onChange={(e) => setVPurpose(e.currentTarget.value)} />
          <Button
            onClick={() =>
              createVisitor.mutate({
                visitor_name: vName,
                phone: vPhone || undefined,
                id_type: vIdType ?? undefined,
                id_number: vIdNumber || undefined,
                relationship: vRelationship || undefined,
                category: vCategory ?? undefined,
                purpose: vPurpose || undefined,
              })
            }
            loading={createVisitor.isPending}
            disabled={!vName}
          >
            Register
          </Button>
        </Stack>
      </Drawer>

      {/* Issue Pass Drawer */}
      <Drawer opened={passDrawer} onClose={passDrawerHandlers.close} title="Issue Visitor Pass" position="right" size="sm">
        <Stack gap="sm">
          <Text size="sm" c="dimmed">Issuing pass for registration: {selectedRegistration?.slice(0, 8)}...</Text>
          <NumberInput label="Valid Hours" value={passHours} onChange={setPassHours} min={1} max={24} />
          <Button
            onClick={() => {
              if (selectedRegistration) {
                createPass.mutate({
                  registration_id: selectedRegistration,
                  valid_hours: typeof passHours === "number" ? passHours : 2,
                });
              }
            }}
            loading={createPass.isPending}
          >
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

function QueueConfigTab({ canManage, canManageVisitors }: { canManage: boolean; canManageVisitors: boolean }) {
  const qc = useQueryClient();
  const [ruleDrawer, ruleDrawerHandlers] = useDisclosure(false);
  const [configDrawer, configDrawerHandlers] = useDisclosure(false);
  const [hoursDrawer, hoursDrawerHandlers] = useDisclosure(false);

  // Priority rule form
  const [rulePriority, setRulePriority] = useState<string | null>("normal");
  const [ruleWeight, setRuleWeight] = useState<number | string>(1);

  // Display config form
  const [cfgName, setCfgName] = useState("");
  const [cfgType, setCfgType] = useState<string | null>("waiting_area");
  const [cfgDoctors, setCfgDoctors] = useState<number | string>(4);
  const [cfgShowName, setCfgShowName] = useState(false);
  const [cfgShowWait, setCfgShowWait] = useState(true);
  const [cfgAnnounce, setCfgAnnounce] = useState(false);

  // Visiting hours form
  const [hDay, setHDay] = useState<string | null>("1");
  const [hStart, setHStart] = useState("09:00");
  const [hEnd, setHEnd] = useState("17:00");
  const [hMax, setHMax] = useState<number | string>(2);

  const { data: rules, isLoading: loadingRules } = useQuery<QueuePriorityRule[]>({
    queryKey: ["front-office", "queue-priority"],
    queryFn: () => api.listQueuePriorityRules(),
  });

  const { data: configs, isLoading: loadingConfigs } = useQuery<QueueDisplayConfig[]>({
    queryKey: ["front-office", "display-config"],
    queryFn: () => api.listQueueDisplayConfig(),
  });

  const { data: hours, isLoading: loadingHours } = useQuery<VisitingHours[]>({
    queryKey: ["front-office", "visiting-hours"],
    queryFn: () => api.listVisitingHours(),
  });

  const createRule = useMutation({
    mutationFn: (data: UpsertQueuePriorityRequest) => api.upsertQueuePriorityRule(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "queue-priority"] });
      ruleDrawerHandlers.close();
      notifications.show({ message: "Priority rule added", color: "success" });
    },
  });

  const createConfig = useMutation({
    mutationFn: (data: UpsertDisplayConfigRequest) => api.upsertQueueDisplayConfig(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "display-config"] });
      configDrawerHandlers.close();
      notifications.show({ message: "Display config saved", color: "success" });
    },
  });

  const createHours = useMutation({
    mutationFn: (data: UpsertVisitingHoursRequest) => api.upsertVisitingHours(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "visiting-hours"] });
      hoursDrawerHandlers.close();
      notifications.show({ message: "Visiting hours saved", color: "success" });
    },
  });

  const ruleColumns = [
    {
      key: "priority", label: "Priority",
      render: (r: QueuePriorityRule) => <Badge color={priorityColors[r.priority] ?? "slate"}>{r.priority}</Badge>,
    },
    { key: "weight", label: "Weight", render: (r: QueuePriorityRule) => String(r.weight) },
    {
      key: "is_active", label: "Active",
      render: (r: QueuePriorityRule) => r.is_active ? <Badge color="success">Yes</Badge> : <Badge color="slate">No</Badge>,
    },
  ];

  const configColumns = [
    { key: "location_name", label: "Location", render: (r: QueueDisplayConfig) => r.location_name },
    { key: "display_type", label: "Type", render: (r: QueueDisplayConfig) => r.display_type },
    { key: "doctors_per_screen", label: "Doctors/Screen", render: (r: QueueDisplayConfig) => String(r.doctors_per_screen) },
    {
      key: "show_wait_time", label: "Show Wait",
      render: (r: QueueDisplayConfig) => r.show_wait_time ? "Yes" : "No",
    },
    {
      key: "announcement_enabled", label: "Announce",
      render: (r: QueueDisplayConfig) => r.announcement_enabled ? "Yes" : "No",
    },
  ];

  const hoursColumns = [
    { key: "day_of_week", label: "Day", render: (r: VisitingHours) => DAY_NAMES[r.day_of_week] ?? String(r.day_of_week) },
    { key: "start_time", label: "Start", render: (r: VisitingHours) => r.start_time },
    { key: "end_time", label: "End", render: (r: VisitingHours) => r.end_time },
    { key: "max_visitors_per_patient", label: "Max Visitors", render: (r: VisitingHours) => String(r.max_visitors_per_patient) },
    {
      key: "is_active", label: "Active",
      render: (r: VisitingHours) => r.is_active ? <Badge color="success">Yes</Badge> : <Badge color="slate">No</Badge>,
    },
  ];

  return (
    <Stack gap="lg">
      {/* Visiting Hours */}
      <div>
        <Group justify="space-between" mb="sm">
          <Text fw={600}>Visiting Hours</Text>
          {canManageVisitors && (
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={hoursDrawerHandlers.open}>
              Add Hours
            </Button>
          )}
        </Group>
        <DataTable columns={hoursColumns} data={hours ?? []} loading={loadingHours} rowKey={(r: VisitingHours) => r.id} />
      </div>

      {/* Priority Rules */}
      <div>
        <Group justify="space-between" mb="sm">
          <Text fw={600}>Queue Priority Rules</Text>
          {canManage && (
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={ruleDrawerHandlers.open}>
              Add Rule
            </Button>
          )}
        </Group>
        <DataTable columns={ruleColumns} data={rules ?? []} loading={loadingRules} rowKey={(r: QueuePriorityRule) => r.id} />
      </div>

      {/* Display Config */}
      <div>
        <Group justify="space-between" mb="sm">
          <Text fw={600}>Display Configuration</Text>
          {canManage && (
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={configDrawerHandlers.open}>
              Add Config
            </Button>
          )}
        </Group>
        <DataTable columns={configColumns} data={configs ?? []} loading={loadingConfigs} rowKey={(r: QueueDisplayConfig) => r.id} />
      </div>

      {/* Priority Rule Drawer */}
      <Drawer opened={ruleDrawer} onClose={ruleDrawerHandlers.close} title="Add Priority Rule" position="right" size="sm">
        <Stack gap="sm">
          <Select label="Priority" data={QUEUE_PRIORITIES} value={rulePriority} onChange={setRulePriority} />
          <NumberInput label="Weight (higher = called sooner)" value={ruleWeight} onChange={setRuleWeight} min={1} max={100} />
          <Button
            onClick={() => createRule.mutate({ priority: rulePriority ?? "normal", weight: typeof ruleWeight === "number" ? ruleWeight : 1 })}
            loading={createRule.isPending}
          >
            Save
          </Button>
        </Stack>
      </Drawer>

      {/* Display Config Drawer */}
      <Drawer opened={configDrawer} onClose={configDrawerHandlers.close} title="Add Display Config" position="right" size="xl">
        <Stack gap="sm">
          <TextInput label="Location Name" required value={cfgName} onChange={(e) => setCfgName(e.currentTarget.value)} />
          <Select label="Display Type" data={["waiting_area", "doctor_room", "counter"]} value={cfgType} onChange={setCfgType} />
          <NumberInput label="Doctors Per Screen" value={cfgDoctors} onChange={setCfgDoctors} min={1} max={20} />
          <Switch label="Show Patient Name" checked={cfgShowName} onChange={(e) => setCfgShowName(e.currentTarget.checked)} />
          <Switch label="Show Wait Time" checked={cfgShowWait} onChange={(e) => setCfgShowWait(e.currentTarget.checked)} />
          <Switch label="Enable Announcements" checked={cfgAnnounce} onChange={(e) => setCfgAnnounce(e.currentTarget.checked)} />
          <Button
            onClick={() =>
              createConfig.mutate({
                location_name: cfgName,
                display_type: cfgType ?? undefined,
                doctors_per_screen: typeof cfgDoctors === "number" ? cfgDoctors : undefined,
                show_patient_name: cfgShowName,
                show_wait_time: cfgShowWait,
                announcement_enabled: cfgAnnounce,
              })
            }
            loading={createConfig.isPending}
            disabled={!cfgName}
          >
            Save
          </Button>
        </Stack>
      </Drawer>

      {/* Visiting Hours Drawer */}
      <Drawer opened={hoursDrawer} onClose={hoursDrawerHandlers.close} title="Add Visiting Hours" position="right" size="sm">
        <Stack gap="sm">
          <Select
            label="Day of Week"
            data={DAY_NAMES.map((d, i) => ({ value: String(i), label: d }))}
            value={hDay}
            onChange={setHDay}
          />
          <TextInput label="Start Time" value={hStart} onChange={(e) => setHStart(e.currentTarget.value)} placeholder="HH:MM" />
          <TextInput label="End Time" value={hEnd} onChange={(e) => setHEnd(e.currentTarget.value)} placeholder="HH:MM" />
          <NumberInput label="Max Visitors Per Patient" value={hMax} onChange={setHMax} min={1} max={10} />
          <Button
            onClick={() =>
              createHours.mutate({
                day_of_week: Number(hDay ?? 1),
                start_time: hStart,
                end_time: hEnd,
                max_visitors_per_patient: typeof hMax === "number" ? hMax : 2,
              })
            }
            loading={createHours.isPending}
          >
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

  const [eName, setEName] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [eType, setEType] = useState<string | null>("general");
  const [eResponse, setEResponse] = useState("");

  const { data: enquiries, isLoading } = useQuery<FrontOfficeEnquiryLog[]>({
    queryKey: ["front-office", "enquiries"],
    queryFn: () => api.listEnquiries(),
  });

  const createEnquiry = useMutation({
    mutationFn: (data: CreateEnquiryRequest) => api.createEnquiry(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "enquiries"] });
      drawerHandlers.close();
      notifications.show({ message: "Enquiry logged", color: "success" });
      setEName(""); setEPhone(""); setEType("general"); setEResponse("");
    },
  });

  const resolveEnquiry = useMutation({
    mutationFn: (id: string) => api.resolveEnquiry(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "enquiries"] });
      notifications.show({ message: "Enquiry resolved", color: "success" });
    },
  });

  const columns = [
    { key: "caller_name", label: "Caller", render: (r: FrontOfficeEnquiryLog) => r.caller_name ?? "—" },
    { key: "caller_phone", label: "Phone", render: (r: FrontOfficeEnquiryLog) => r.caller_phone ?? "—" },
    {
      key: "enquiry_type", label: "Type",
      render: (r: FrontOfficeEnquiryLog) => <Badge variant="light" size="sm">{r.enquiry_type}</Badge>,
    },
    { key: "response_text", label: "Response", render: (r: FrontOfficeEnquiryLog) => r.response_text ?? "—" },
    {
      key: "resolved", label: "Resolved",
      render: (r: FrontOfficeEnquiryLog) => r.resolved ? <Badge color="success">Yes</Badge> : <Badge color="orange">No</Badge>,
    },
    { key: "created_at", label: "Time", render: (r: FrontOfficeEnquiryLog) => new Date(r.created_at).toLocaleString() },
    {
      key: "actions", label: "",
      render: (r: FrontOfficeEnquiryLog) =>
        !r.resolved && canManage ? (
          <Tooltip label="Mark Resolved">
            <ActionIcon variant="light" color="success" onClick={() => resolveEnquiry.mutate(r.id)} aria-label="Confirm">
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
      <DataTable columns={columns} data={enquiries ?? []} loading={isLoading} rowKey={(r: FrontOfficeEnquiryLog) => r.id} />

      <Drawer opened={drawer} onClose={drawerHandlers.close} title="Log Enquiry" position="right" size="xl">
        <Stack gap="sm">
          <TextInput label="Caller Name" value={eName} onChange={(e) => setEName(e.currentTarget.value)} />
          <TextInput label="Caller Phone" value={ePhone} onChange={(e) => setEPhone(e.currentTarget.value)} />
          <Select label="Enquiry Type" data={ENQUIRY_TYPES} value={eType} onChange={setEType} />
          <Textarea label="Response" value={eResponse} onChange={(e) => setEResponse(e.currentTarget.value)} rows={3} />
          <Button
            onClick={() =>
              createEnquiry.mutate({
                caller_name: eName || undefined,
                caller_phone: ePhone || undefined,
                enquiry_type: eType ?? undefined,
                response_text: eResponse || undefined,
              })
            }
            loading={createEnquiry.isPending}
          >
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

  const { data, isLoading } = useQuery({
    queryKey: ["front-office", "visitor-analytics", from, to],
    queryFn: () => api.visitorAnalytics({ from: from || undefined, to: to || undefined }),
  });

  const analytics = data as VisitorAnalyticsType | undefined;

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
        <TextInput placeholder="From date" type="date" value={from} onChange={(e) => setFrom(e.currentTarget.value)} w={160} />
        <TextInput placeholder="To date" type="date" value={to} onChange={(e) => setTo(e.currentTarget.value)} w={160} />
      </Group>

      {isLoading && <Text size="sm" c="dimmed">Loading analytics...</Text>}

      {analytics && (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Card withBorder p="md">
              <Text size="xs" c="dimmed">Total Visitors</Text>
              <Text size="xl" fw={700} c="primary">{analytics.total_visitors}</Text>
            </Card>
            <Card withBorder p="md">
              <Text size="xs" c="dimmed">Avg Visit Duration</Text>
              <Text size="xl" fw={700} c="orange">{Math.round(analytics.avg_visit_duration_minutes)} min</Text>
            </Card>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Card withBorder p="sm">
              <Text fw={600} size="sm" mb="sm">Visitors by Department</Text>
              {byDeptChart.length > 0 ? (
                <BarChart
                  h={220}
                  data={byDeptChart}
                  dataKey="department"
                  series={[{ name: "visitors", color: "primary" }]}
                />
              ) : (
                <Text size="sm" c="dimmed">No data</Text>
              )}
            </Card>
            <Card withBorder p="sm">
              <Text fw={600} size="sm" mb="sm">Visitors by Hour</Text>
              {byHourChart.length > 0 ? (
                <BarChart
                  h={220}
                  data={byHourChart}
                  dataKey="hour"
                  series={[{ name: "visitors", color: "teal" }]}
                />
              ) : (
                <Text size="sm" c="dimmed">No data</Text>
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
  const { data, isLoading } = useQuery({
    queryKey: ["front-office", "queue-metrics"],
    queryFn: () => api.queueMetrics(),
  });

  const metrics = (data ?? []) as QueueMetricsRow[];

  const cols: Column<QueueMetricsRow>[] = [
    { key: "department", label: "Department", render: (r) => <Text size="sm" fw={500}>{r.department}</Text> },
    { key: "current_waiting", label: "Currently Waiting", render: (r) => <Badge color={r.current_waiting > 10 ? "danger" : r.current_waiting > 5 ? "orange" : "success"}>{r.current_waiting}</Badge> },
    { key: "avg_wait_minutes", label: "Avg Wait (min)", render: (r) => <Text size="sm">{Math.round(r.avg_wait_minutes)}</Text> },
    { key: "longest_wait_minutes", label: "Longest Wait (min)", render: (r) => <Text size="sm" c={r.longest_wait_minutes > 30 ? "danger" : undefined}>{Math.round(r.longest_wait_minutes)}</Text> },
    { key: "throughput_per_hour", label: "Throughput/hr", render: (r) => <Text size="sm">{r.throughput_per_hour.toFixed(1)}</Text> },
  ];

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">Real-time queue performance metrics by department</Text>
      <DataTable columns={cols} data={metrics} loading={isLoading} rowKey={(r) => r.department} />
    </Stack>
  );
}

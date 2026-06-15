import { zodResolver } from "@hookform/resolvers/zod";
import {
  Drawer,
  Group,
  NumberInput,
  Select,
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
import {
  type SecurityAccessCardFormInput,
  type SecurityAccessLogFormInput,
  type SecurityCameraFormInput,
  type SecurityCodeDebriefFormInput,
  type SecurityIncidentFormInput,
  type SecurityPatientTagFormInput,
  type SecurityZoneFormInput,
  securityAccessCardFormSchema,
  securityAccessLogFormSchema,
  securityCameraFormSchema,
  securityCodeDebriefFormSchema,
  securityIncidentFormSchema,
  securityPatientTagFormSchema,
  securityZoneFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  ResolveSecurityTagAlertRequest,
  SecurityAccessCard,
  SecurityAccessLog,
  SecurityCamera,
  SecurityCodeDebrief,
  SecurityIncident,
  SecurityPatientTag,
  SecurityTagAlert,
  SecurityZone,
  UpdateSecurityIncidentRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBabyCarriage,
  IconCheck,
  IconFileReport,
  IconPencil,
  IconPlus,
  IconShieldLock,
  IconVideo,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import {
  defaultSecurityAccessCardFormValues,
  defaultSecurityAccessLogFormValues,
  defaultSecurityCameraFormValues,
  defaultSecurityCodeDebriefFormValues,
  defaultSecurityIncidentFormValues,
  defaultSecurityPatientTagFormValues,
  defaultSecurityZoneFormValues,
  securityAccessCardFormToRequest,
  securityAccessLogFormToRequest,
  securityCameraFormToRequest,
  securityCodeDebriefFormToRequest,
  securityIncidentFormToRequest,
  securityPatientTagFormToRequest,
  securityZoneFormToRequest,
} from "@/forms/security.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { securityService } from "@/services/security.service";

// ── Constants ──────────────────────────────────────────

const ZONE_LEVELS = [
  { value: "public", label: "Public" },
  { value: "general", label: "General" },
  { value: "restricted", label: "Restricted" },
  { value: "high_security", label: "High Security" },
  { value: "critical", label: "Critical" },
];

const ACCESS_METHODS = [
  { value: "card", label: "Card" },
  { value: "biometric", label: "Biometric" },
  { value: "pin", label: "PIN" },
  { value: "manual", label: "Manual" },
];

const INCIDENT_SEVERITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const INCIDENT_CATEGORIES = [
  { value: "theft", label: "Theft" },
  { value: "assault", label: "Assault" },
  { value: "trespass", label: "Trespass" },
  { value: "property_damage", label: "Property Damage" },
  { value: "policy_violation", label: "Policy Violation" },
  { value: "elopement", label: "Elopement" },
  { value: "other", label: "Other" },
];

const TAG_TYPES = [
  { value: "infant_rfid", label: "Infant RFID" },
  { value: "wander_guard", label: "Wander Guard" },
  { value: "elopement_risk", label: "Elopement Risk" },
];

const CAMERA_TYPES = [
  { value: "dome", label: "Dome" },
  { value: "bullet", label: "Bullet" },
  { value: "ptz", label: "PTZ" },
  { value: "box", label: "Box" },
  { value: "fisheye", label: "Fisheye" },
];

const SEVERITY_COLORS: Record<string, BadgeTone> = {
  low: "primary",
  medium: "warning",
  high: "warning",
  critical: "danger",
};

const ZONE_LEVEL_COLORS: Record<string, BadgeTone> = {
  public: "neutral",
  general: "primary",
  restricted: "warning",
  high_security: "danger",
  critical: "accent",
};

const STATUS_COLORS: Record<string, BadgeTone> = {
  reported: "primary",
  investigating: "warning",
  resolved: "success",
  closed: "neutral",
};

const ALERT_STATUS_COLORS: Record<string, BadgeTone> = {
  active: "success",
  alert_triggered: "danger",
  resolved: "primary",
  deactivated: "neutral",
};

// ══════════════════════════════════════════════════════════
//  Access Control Tab
// ══════════════════════════════════════════════════════════

function AccessControlTab() {
  const canManage = useHasPermission(P.SECURITY.ACCESS_MANAGE);
  const qc = useQueryClient();

  // ── Zones ──
  const { data: zones = [], isLoading: zonesLoading } = useQuery({
    queryKey: ["sec-zones"],
    queryFn: () => securityService.listSecurityZones(),
  });
  const [zoneOpened, { open: openZone, close: closeZone }] = useDisclosure(false);
  const zoneForm = useForm<SecurityZoneFormInput>({
    resolver: zodResolver(securityZoneFormSchema),
    defaultValues: defaultSecurityZoneFormValues,
  });
  const afterHoursRestricted = zoneForm.watch("after_hours_restricted");
  const handleOpenZone = () => {
    zoneForm.reset(defaultSecurityZoneFormValues);
    openZone();
  };
  const createZoneMut = useMutation({
    mutationFn: (values: SecurityZoneFormInput) =>
      securityService.createSecurityZone(securityZoneFormToRequest(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sec-zones"] });
      zoneForm.reset(defaultSecurityZoneFormValues);
      closeZone();
      notifications.show({
        title: "Zone Created",
        message: "Security zone added",
        color: "success",
      });
    },
  });

  const zoneColumns: Column<SecurityZone>[] = [
    { key: "zone_code", label: "Code", render: (r) => <Text fw={600}>{r.zone_code}</Text> },
    { key: "name", label: "Name", render: (r) => <Text>{r.name}</Text> },
    {
      key: "level",
      label: "Level",
      render: (r) => (
        <Badge tone={ZONE_LEVEL_COLORS[r.level] ?? "neutral"}>{r.level.replace("_", " ")}</Badge>
      ),
    },
    {
      key: "after_hours",
      label: "After Hours",
      render: (r) =>
        r.after_hours_restricted ? (
          <Badge tone="warning">Restricted</Badge>
        ) : (
          <Text c="dimmed">Open</Text>
        ),
    },
    {
      key: "is_active",
      label: "Status",
      render: (r) => (
        <Badge tone={r.is_active ? "success" : "neutral"}>
          {r.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  // ── Access Cards ──
  const { data: cards = [], isLoading: cardsLoading } = useQuery({
    queryKey: ["sec-cards"],
    queryFn: () => securityService.listSecurityAccessCards(),
  });
  const [cardOpened, { open: openCard, close: closeCard }] = useDisclosure(false);
  const cardForm = useForm<SecurityAccessCardFormInput>({
    resolver: zodResolver(securityAccessCardFormSchema),
    defaultValues: defaultSecurityAccessCardFormValues,
  });
  const handleOpenCard = () => {
    cardForm.reset(defaultSecurityAccessCardFormValues);
    openCard();
  };
  const createCardMut = useMutation({
    mutationFn: (values: SecurityAccessCardFormInput) =>
      securityService.createSecurityAccessCard(securityAccessCardFormToRequest(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sec-cards"] });
      cardForm.reset(defaultSecurityAccessCardFormValues);
      closeCard();
      notifications.show({
        title: "Card Issued",
        message: "Access card created",
        color: "success",
      });
    },
  });
  const deactivateCardMut = useMutation({
    mutationFn: (id: string) =>
      securityService.deactivateSecurityAccessCard(id, "Manual deactivation"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sec-cards"] });
      notifications.show({
        title: "Card Deactivated",
        message: "Access card deactivated",
        color: "orange",
      });
    },
  });

  const cardColumns: Column<SecurityAccessCard>[] = [
    { key: "card_number", label: "Card #", render: (r) => <Text fw={600}>{r.card_number}</Text> },
    {
      key: "employee_id",
      label: "Employee",
      render: (r) => <Text size="sm">{r.employee_id.slice(0, 8)}...</Text>,
    },
    { key: "card_type", label: "Type", render: (r) => <Text>{r.card_type ?? "standard"}</Text> },
    { key: "issued_date", label: "Issued", render: (r) => <Text size="sm">{r.issued_date}</Text> },
    {
      key: "is_active",
      label: "Status",
      render: (r) => (
        <Badge tone={r.is_active ? "success" : "neutral"}>
          {r.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions" as const,
            label: "Actions",
            render: (r: SecurityAccessCard) =>
              r.is_active ? (
                <Tooltip label="Deactivate">
                  <IconButton
                    tone="danger"
                    onClick={() => deactivateCardMut.mutate(r.id)}
                    aria-label="Deactivate"
                  >
                    <IconX size={16} />
                  </IconButton>
                </Tooltip>
              ) : (
                <Text c="dimmed">—</Text>
              ),
          },
        ]
      : []),
  ];

  // ── Access Logs ──
  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["sec-access-logs"],
    queryFn: () => securityService.listSecurityAccessLogs(),
  });
  const [logOpened, { open: openLog, close: closeLog }] = useDisclosure(false);
  const logForm = useForm<SecurityAccessLogFormInput>({
    resolver: zodResolver(securityAccessLogFormSchema),
    defaultValues: defaultSecurityAccessLogFormValues,
  });
  const handleOpenLog = () => {
    logForm.reset(defaultSecurityAccessLogFormValues);
    openLog();
  };
  const createLogMut = useMutation({
    mutationFn: (values: SecurityAccessLogFormInput) =>
      securityService.createSecurityAccessLog(securityAccessLogFormToRequest(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sec-access-logs"] });
      logForm.reset(defaultSecurityAccessLogFormValues);
      closeLog();
      notifications.show({
        title: "Log Recorded",
        message: "Access log entry created",
        color: "success",
      });
    },
  });

  const logColumns: Column<SecurityAccessLog>[] = [
    {
      key: "zone_id",
      label: "Zone",
      render: (r) => (
        <Text size="sm">
          {zones.find((z) => z.id === r.zone_id)?.zone_code ?? r.zone_id.slice(0, 8)}
        </Text>
      ),
    },
    {
      key: "person_name",
      label: "Person",
      render: (r) => <Text>{r.person_name ?? r.employee_id?.slice(0, 8) ?? "—"}</Text>,
    },
    {
      key: "access_method",
      label: "Method",
      render: (r) => <Badge tone="neutral">{r.access_method}</Badge>,
    },
    {
      key: "direction",
      label: "Direction",
      render: (r) => (
        <Badge tone={r.direction === "entry" ? "success" : "warning"}>{r.direction}</Badge>
      ),
    },
    {
      key: "granted",
      label: "Access",
      render: (r) => (
        <Badge tone={r.granted ? "success" : "danger"}>{r.granted ? "Granted" : "Denied"}</Badge>
      ),
    },
    {
      key: "is_after_hours",
      label: "After Hours",
      render: (r) =>
        r.is_after_hours ? <Badge tone="warning">Yes</Badge> : <Text c="dimmed">No</Text>,
    },
    {
      key: "accessed_at",
      label: "Time",
      render: (r) => <Text size="sm">{new Date(r.accessed_at).toLocaleString()}</Text>,
    },
  ];

  return (
    <Stack>
      <Text fw={600} size="lg">
        Security Zones
      </Text>
      <Group>
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={handleOpenZone}>
            Add Zone
          </Button>
        )}
      </Group>
      <DataTable columns={zoneColumns} data={zones} loading={zonesLoading} rowKey={(r) => r.id} />

      <Text fw={600} size="lg" mt="lg">
        Access Cards
      </Text>
      <Group>
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={handleOpenCard}>
            Issue Card
          </Button>
        )}
      </Group>
      <DataTable columns={cardColumns} data={cards} loading={cardsLoading} rowKey={(r) => r.id} />

      <Text fw={600} size="lg" mt="lg">
        Access Logs
      </Text>
      <Group>
        {canManage && (
          <Button tone="secondary" leftSection={<IconPlus size={16} />} onClick={handleOpenLog}>
            Log Entry
          </Button>
        )}
      </Group>
      <DataTable columns={logColumns} data={logs} loading={logsLoading} rowKey={(r) => r.id} />

      {/* Zone Drawer */}
      <Drawer
        opened={zoneOpened}
        onClose={closeZone}
        title="Add Security Zone"
        position="right"
        size="xl"
      >
        <Stack
          component="form"
          onSubmit={zoneForm.handleSubmit((values) => createZoneMut.mutate(values))}
        >
          <TextInput
            label="Zone Code"
            required
            {...zoneForm.register("zone_code")}
            error={zoneForm.formState.errors.zone_code?.message}
          />
          <TextInput
            label="Zone Name"
            required
            {...zoneForm.register("name")}
            error={zoneForm.formState.errors.name?.message}
          />
          <Controller
            control={zoneForm.control}
            name="level"
            render={({ field, fieldState }) => (
              <Select
                label="Security Level"
                data={ZONE_LEVELS}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Textarea
            label="Description"
            {...zoneForm.register("description")}
            error={zoneForm.formState.errors.description?.message}
          />
          <Controller
            control={zoneForm.control}
            name="after_hours_restricted"
            render={({ field }) => (
              <Switch
                label="After Hours Restricted"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          {afterHoursRestricted && (
            <Group grow>
              <TextInput
                label="Start Time"
                placeholder="22:00"
                {...zoneForm.register("after_hours_start")}
                error={zoneForm.formState.errors.after_hours_start?.message}
              />
              <TextInput
                label="End Time"
                placeholder="06:00"
                {...zoneForm.register("after_hours_end")}
                error={zoneForm.formState.errors.after_hours_end?.message}
              />
            </Group>
          )}
          <Button tone="primary" type="submit" loading={createZoneMut.isPending}>
            Create Zone
          </Button>
        </Stack>
      </Drawer>

      {/* Card Drawer */}
      <Drawer
        opened={cardOpened}
        onClose={closeCard}
        title="Issue Access Card"
        position="right"
        size="xl"
      >
        <Stack
          component="form"
          onSubmit={cardForm.handleSubmit((values) => createCardMut.mutate(values))}
        >
          <TextInput
            label="Employee ID"
            required
            {...cardForm.register("employee_id")}
            error={cardForm.formState.errors.employee_id?.message}
          />
          <TextInput
            label="Card Number"
            required
            {...cardForm.register("card_number")}
            error={cardForm.formState.errors.card_number?.message}
          />
          <Controller
            control={cardForm.control}
            name="card_type"
            render={({ field, fieldState }) => (
              <Select
                label="Card Type"
                data={[
                  { value: "standard", label: "Standard" },
                  { value: "temporary", label: "Temporary" },
                  { value: "contractor", label: "Contractor" },
                ]}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                error={fieldState.error?.message}
              />
            )}
          />
          <Button tone="primary" type="submit" loading={createCardMut.isPending}>
            Issue Card
          </Button>
        </Stack>
      </Drawer>

      {/* Access Log Drawer */}
      <Drawer
        opened={logOpened}
        onClose={closeLog}
        title="Record Access Log"
        position="right"
        size="xl"
      >
        <Stack
          component="form"
          onSubmit={logForm.handleSubmit((values) => createLogMut.mutate(values))}
        >
          <Controller
            control={logForm.control}
            name="zone_id"
            render={({ field, fieldState }) => (
              <Select
                label="Zone"
                required
                data={zones.map((z) => ({ value: z.id, label: `${z.zone_code} — ${z.name}` }))}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                error={fieldState.error?.message}
              />
            )}
          />
          <TextInput
            label="Person Name"
            {...logForm.register("person_name")}
            error={logForm.formState.errors.person_name?.message}
          />
          <Controller
            control={logForm.control}
            name="access_method"
            render={({ field, fieldState }) => (
              <Select
                label="Access Method"
                data={ACCESS_METHODS}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={logForm.control}
            name="direction"
            render={({ field, fieldState }) => (
              <Select
                label="Direction"
                data={[
                  { value: "entry", label: "Entry" },
                  { value: "exit", label: "Exit" },
                ]}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={logForm.control}
            name="granted"
            render={({ field }) => (
              <Switch
                label="Granted"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Controller
            control={logForm.control}
            name="is_after_hours"
            render={({ field }) => (
              <Switch
                label="After Hours"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Button tone="primary" type="submit" loading={createLogMut.isPending}>
            Record Log
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  CCTV Tab
// ══════════════════════════════════════════════════════════

function CctvTab() {
  const canManage = useHasPermission(P.SECURITY.CCTV_MANAGE);
  const qc = useQueryClient();

  const { data: cameras = [], isLoading } = useQuery({
    queryKey: ["sec-cameras"],
    queryFn: () => securityService.listSecurityCameras(),
  });
  const { data: zones = [] } = useQuery({
    queryKey: ["sec-zones"],
    queryFn: () => securityService.listSecurityZones(),
  });
  const [opened, { open, close }] = useDisclosure(false);
  const cameraForm = useForm<SecurityCameraFormInput>({
    resolver: zodResolver(securityCameraFormSchema),
    defaultValues: defaultSecurityCameraFormValues,
  });
  const handleOpen = () => {
    cameraForm.reset(defaultSecurityCameraFormValues);
    open();
  };
  const createMut = useMutation({
    mutationFn: (values: SecurityCameraFormInput) =>
      securityService.createSecurityCamera(securityCameraFormToRequest(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sec-cameras"] });
      cameraForm.reset(defaultSecurityCameraFormValues);
      close();
      notifications.show({ title: "Camera Added", message: "Camera registered", color: "success" });
    },
  });

  const columns: Column<SecurityCamera>[] = [
    { key: "name", label: "Name", render: (r) => <Text fw={600}>{r.name}</Text> },
    {
      key: "zone_id",
      label: "Zone",
      render: (r) => (
        <Text size="sm">{zones.find((z) => z.id === r.zone_id)?.zone_code ?? "—"}</Text>
      ),
    },
    { key: "camera_type", label: "Type", render: (r) => <Text>{r.camera_type ?? "—"}</Text> },
    { key: "resolution", label: "Resolution", render: (r) => <Text>{r.resolution ?? "—"}</Text> },
    {
      key: "retention_days",
      label: "Retention",
      render: (r) => <Text>{r.retention_days} days</Text>,
    },
    {
      key: "is_recording",
      label: "Recording",
      render: (r) => (
        <Badge tone={r.is_recording ? "success" : "danger"}>
          {r.is_recording ? "Recording" : "Offline"}
        </Badge>
      ),
    },
    {
      key: "is_active",
      label: "Status",
      render: (r) => (
        <Badge tone={r.is_active ? "success" : "neutral"}>
          {r.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  return (
    <Stack>
      {canManage && (
        <Group>
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={handleOpen}>
            Add Camera
          </Button>
        </Group>
      )}
      <DataTable columns={columns} data={cameras} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer opened={opened} onClose={close} title="Add Camera" position="right" size="xl">
        <Stack
          component="form"
          onSubmit={cameraForm.handleSubmit((values) => createMut.mutate(values))}
        >
          <TextInput
            label="Camera Name"
            required
            {...cameraForm.register("name")}
            error={cameraForm.formState.errors.name?.message}
          />
          <TextInput
            label="Camera ID"
            {...cameraForm.register("camera_id")}
            error={cameraForm.formState.errors.camera_id?.message}
          />
          <Controller
            control={cameraForm.control}
            name="zone_id"
            render={({ field, fieldState }) => (
              <Select
                label="Zone"
                data={zones.map((z) => ({ value: z.id, label: `${z.zone_code} — ${z.name}` }))}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                error={fieldState.error?.message}
              />
            )}
          />
          <TextInput
            label="Location Description"
            {...cameraForm.register("location_description")}
            error={cameraForm.formState.errors.location_description?.message}
          />
          <Controller
            control={cameraForm.control}
            name="camera_type"
            render={({ field, fieldState }) => (
              <Select
                label="Camera Type"
                data={CAMERA_TYPES}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <TextInput
            label="Resolution"
            placeholder="1080p"
            {...cameraForm.register("resolution")}
            error={cameraForm.formState.errors.resolution?.message}
          />
          <Controller
            control={cameraForm.control}
            name="retention_days"
            render={({ field, fieldState }) => (
              <NumberInput
                label="Retention Days"
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                min={1}
                max={365}
              />
            )}
          />
          <TextInput
            label="IP Address"
            {...cameraForm.register("ip_address")}
            error={cameraForm.formState.errors.ip_address?.message}
          />
          <Button tone="primary" type="submit" loading={createMut.isPending}>
            Add Camera
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Incidents Tab
// ══════════════════════════════════════════════════════════

function IncidentsTab() {
  const canCreate = useHasPermission(P.SECURITY.INCIDENTS_CREATE);
  const canUpdate = useHasPermission(P.SECURITY.INCIDENTS_UPDATE);
  const qc = useQueryClient();

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["sec-incidents"],
    queryFn: () => securityService.listSecurityIncidents(),
  });
  const { data: zones = [] } = useQuery({
    queryKey: ["sec-zones"],
    queryFn: () => securityService.listSecurityZones(),
  });
  const [opened, { open, close }] = useDisclosure(false);
  const incidentForm = useForm<SecurityIncidentFormInput>({
    resolver: zodResolver(securityIncidentFormSchema),
    defaultValues: defaultSecurityIncidentFormValues,
  });
  const policeNotified = incidentForm.watch("police_notified");
  const handleOpen = () => {
    incidentForm.reset(defaultSecurityIncidentFormValues);
    open();
  };
  const createMut = useMutation({
    mutationFn: (values: SecurityIncidentFormInput) =>
      securityService.createSecurityIncident(securityIncidentFormToRequest(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sec-incidents"] });
      incidentForm.reset(defaultSecurityIncidentFormValues);
      close();
      notifications.show({
        title: "Incident Reported",
        message: "Security incident created",
        color: "success",
      });
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSecurityIncidentRequest }) =>
      securityService.updateSecurityIncident(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sec-incidents"] });
      notifications.show({
        title: "Incident Updated",
        message: "Status updated",
        color: "success",
      });
    },
  });

  const columns: Column<SecurityIncident>[] = [
    {
      key: "incident_number",
      label: "Incident #",
      render: (r) => (
        <Text fw={600} size="sm">
          {r.incident_number}
        </Text>
      ),
    },
    {
      key: "severity",
      label: "Severity",
      render: (r) => <Badge tone={SEVERITY_COLORS[r.severity] ?? "neutral"}>{r.severity}</Badge>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <Badge tone={STATUS_COLORS[r.status] ?? "neutral"}>{r.status}</Badge>,
    },
    {
      key: "category",
      label: "Category",
      render: (r) => <Text>{r.category.replace("_", " ")}</Text>,
    },
    {
      key: "zone_id",
      label: "Zone",
      render: (r) => (
        <Text size="sm">{zones.find((z) => z.id === r.zone_id)?.zone_code ?? "—"}</Text>
      ),
    },
    {
      key: "occurred_at",
      label: "Occurred",
      render: (r) => <Text size="sm">{new Date(r.occurred_at).toLocaleString()}</Text>,
    },
    {
      key: "police_notified",
      label: "Police",
      render: (r) =>
        r.police_notified ? <Badge tone="danger">Yes</Badge> : <Text c="dimmed">No</Text>,
    },
    ...(canUpdate
      ? [
          {
            key: "actions" as const,
            label: "Actions",
            render: (r: SecurityIncident) =>
              r.status === "reported" ? (
                <Tooltip label="Start Investigation">
                  <IconButton
                    tone="default"
                    onClick={() =>
                      updateMut.mutate({ id: r.id, body: { status: "investigating" } })
                    }
                    aria-label="Start Investigation"
                  >
                    <IconPencil size={16} />
                  </IconButton>
                </Tooltip>
              ) : r.status === "investigating" ? (
                <Tooltip label="Resolve">
                  <IconButton
                    tone="success"
                    onClick={() => updateMut.mutate({ id: r.id, body: { status: "resolved" } })}
                    aria-label="Resolve"
                  >
                    <IconCheck size={16} />
                  </IconButton>
                </Tooltip>
              ) : (
                <Text c="dimmed">—</Text>
              ),
          },
        ]
      : []),
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={handleOpen}>
            Report Incident
          </Button>
        </Group>
      )}
      <DataTable columns={columns} data={incidents} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer
        opened={opened}
        onClose={close}
        title="Report Security Incident"
        position="right"
        size="lg"
      >
        <Stack
          component="form"
          onSubmit={incidentForm.handleSubmit((values) => createMut.mutate(values))}
        >
          <Controller
            control={incidentForm.control}
            name="severity"
            render={({ field, fieldState }) => (
              <Select
                label="Severity"
                data={INCIDENT_SEVERITIES}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={incidentForm.control}
            name="category"
            render={({ field, fieldState }) => (
              <Select
                label="Category"
                required
                data={INCIDENT_CATEGORIES}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={incidentForm.control}
            name="zone_id"
            render={({ field, fieldState }) => (
              <Select
                label="Zone"
                data={zones.map((z) => ({ value: z.id, label: `${z.zone_code} — ${z.name}` }))}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                error={fieldState.error?.message}
              />
            )}
          />
          <TextInput
            label="Location"
            {...incidentForm.register("location_description")}
            error={incidentForm.formState.errors.location_description?.message}
          />
          <Textarea
            label="Description"
            required
            minRows={3}
            {...incidentForm.register("description")}
            error={incidentForm.formState.errors.description?.message}
          />
          <Controller
            control={incidentForm.control}
            name="police_notified"
            render={({ field }) => (
              <Switch
                label="Police Notified"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          {policeNotified && (
            <TextInput
              label="Police Report Number"
              {...incidentForm.register("police_report_number")}
              error={incidentForm.formState.errors.police_report_number?.message}
            />
          )}
          <Button tone="primary" type="submit" loading={createMut.isPending}>
            Submit Report
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Patient Safety Tab
// ══════════════════════════════════════════════════════════

function PatientSafetyTab() {
  const canManage = useHasPermission(P.SECURITY.PATIENT_SAFETY_MANAGE);
  const qc = useQueryClient();

  const { data: tags = [], isLoading: tagsLoading } = useQuery({
    queryKey: ["sec-patient-tags"],
    queryFn: () => securityService.listSecurityPatientTags(),
  });
  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ["sec-tag-alerts"],
    queryFn: () => securityService.listSecurityTagAlerts(),
  });
  const { data: zones = [] } = useQuery({
    queryKey: ["sec-zones"],
    queryFn: () => securityService.listSecurityZones(),
  });
  const [opened, { open, close }] = useDisclosure(false);
  const tagForm = useForm<SecurityPatientTagFormInput>({
    resolver: zodResolver(securityPatientTagFormSchema),
    defaultValues: defaultSecurityPatientTagFormValues,
  });
  const handleOpen = () => {
    tagForm.reset(defaultSecurityPatientTagFormValues);
    open();
  };

  const createTagMut = useMutation({
    mutationFn: (values: SecurityPatientTagFormInput) =>
      securityService.createSecurityPatientTag(securityPatientTagFormToRequest(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sec-patient-tags"] });
      tagForm.reset(defaultSecurityPatientTagFormValues);
      close();
      notifications.show({
        title: "Tag Activated",
        message: "Patient safety tag activated",
        color: "success",
      });
    },
  });
  const deactivateTagMut = useMutation({
    mutationFn: (id: string) => securityService.deactivateSecurityPatientTag(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sec-patient-tags"] });
      notifications.show({
        title: "Tag Deactivated",
        message: "Patient tag deactivated",
        color: "orange",
      });
    },
  });
  const resolveAlertMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ResolveSecurityTagAlertRequest }) =>
      securityService.resolveSecurityTagAlert(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sec-tag-alerts"] });
      notifications.show({
        title: "Alert Resolved",
        message: "Tag alert resolved",
        color: "success",
      });
    },
  });

  const tagColumns: Column<SecurityPatientTag>[] = [
    {
      key: "patient_id",
      label: "Patient",
      render: (r) => <PatientNameCell patientId={r.patient_id} showUhid={false} />,
    },
    {
      key: "tag_type",
      label: "Tag Type",
      render: (r) => <Badge tone="neutral">{r.tag_type.replace("_", " ")}</Badge>,
    },
    {
      key: "tag_identifier",
      label: "Tag ID",
      render: (r) => <Text size="sm">{r.tag_identifier ?? "—"}</Text>,
    },
    {
      key: "allowed_zone_id",
      label: "Zone",
      render: (r) => (
        <Text size="sm">{zones.find((z) => z.id === r.allowed_zone_id)?.zone_code ?? "—"}</Text>
      ),
    },
    {
      key: "alert_status",
      label: "Status",
      render: (r) => (
        <Badge tone={ALERT_STATUS_COLORS[r.alert_status] ?? "neutral"}>
          {r.alert_status.replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "activated_at",
      label: "Activated",
      render: (r) => <Text size="sm">{new Date(r.activated_at).toLocaleString()}</Text>,
    },
    ...(canManage
      ? [
          {
            key: "actions" as const,
            label: "Actions",
            render: (r: SecurityPatientTag) =>
              r.alert_status !== "deactivated" ? (
                <Tooltip label="Deactivate Tag">
                  <IconButton
                    tone="danger"
                    onClick={() => deactivateTagMut.mutate(r.id)}
                    aria-label="Deactivate Tag"
                  >
                    <IconX size={16} />
                  </IconButton>
                </Tooltip>
              ) : (
                <Text c="dimmed">—</Text>
              ),
          },
        ]
      : []),
  ];

  const alertColumns: Column<SecurityTagAlert>[] = [
    {
      key: "alert_type",
      label: "Alert Type",
      render: (r) => <Badge tone="danger">{r.alert_type.replace("_", " ")}</Badge>,
    },
    {
      key: "triggered_at",
      label: "Triggered",
      render: (r) => <Text size="sm">{new Date(r.triggered_at).toLocaleString()}</Text>,
    },
    {
      key: "zone_id",
      label: "Zone",
      render: (r) => (
        <Text size="sm">{zones.find((z) => z.id === r.zone_id)?.zone_code ?? "—"}</Text>
      ),
    },
    {
      key: "is_resolved",
      label: "Status",
      render: (r) => (
        <Badge tone={r.is_resolved ? "success" : "danger"}>
          {r.is_resolved ? "Resolved" : "Active"}
        </Badge>
      ),
    },
    {
      key: "was_false_alarm",
      label: "False Alarm",
      render: (r) =>
        r.is_resolved ? (
          r.was_false_alarm ? (
            <Badge tone="warning">Yes</Badge>
          ) : (
            <Text c="dimmed">No</Text>
          )
        ) : (
          <Text c="dimmed">—</Text>
        ),
    },
    ...(canManage
      ? [
          {
            key: "actions" as const,
            label: "Actions",
            render: (r: SecurityTagAlert) =>
              !r.is_resolved ? (
                <Group gap="xs">
                  <Tooltip label="Resolve">
                    <IconButton
                      tone="success"
                      onClick={() =>
                        resolveAlertMut.mutate({ id: r.id, body: { was_false_alarm: false } })
                      }
                      aria-label="Resolve"
                    >
                      <IconCheck size={16} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip label="False Alarm">
                    <IconButton
                      tone="default"
                      onClick={() =>
                        resolveAlertMut.mutate({
                          id: r.id,
                          body: { was_false_alarm: true, resolution_notes: "False alarm" },
                        })
                      }
                      aria-label="False Alarm"
                    >
                      <IconX size={16} />
                    </IconButton>
                  </Tooltip>
                </Group>
              ) : (
                <Text c="dimmed">—</Text>
              ),
          },
        ]
      : []),
  ];

  return (
    <Stack>
      <Text fw={600} size="lg">
        Active Patient Tags
      </Text>
      <Group>
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={handleOpen}>
            Activate Tag
          </Button>
        )}
      </Group>
      <DataTable columns={tagColumns} data={tags} loading={tagsLoading} rowKey={(r) => r.id} />

      <Text fw={600} size="lg" mt="lg">
        Tag Alerts
      </Text>
      <DataTable
        columns={alertColumns}
        data={alerts}
        loading={alertsLoading}
        rowKey={(r) => r.id}
      />

      <Drawer
        opened={opened}
        onClose={close}
        title="Activate Patient Safety Tag"
        position="right"
        size="xl"
      >
        <Stack
          component="form"
          onSubmit={tagForm.handleSubmit((values) => createTagMut.mutate(values))}
        >
          <Controller
            control={tagForm.control}
            name="patient_id"
            render={({ field, fieldState }) => (
              <PatientSearchSelect
                value={field.value}
                onChange={field.onChange}
                required
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={tagForm.control}
            name="tag_type"
            render={({ field, fieldState }) => (
              <Select
                label="Tag Type"
                required
                data={TAG_TYPES}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <TextInput
            label="Tag Identifier"
            {...tagForm.register("tag_identifier")}
            error={tagForm.formState.errors.tag_identifier?.message}
          />
          <Controller
            control={tagForm.control}
            name="allowed_zone_id"
            render={({ field, fieldState }) => (
              <Select
                label="Allowed Zone"
                data={zones.map((z) => ({ value: z.id, label: `${z.zone_code} — ${z.name}` }))}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                error={fieldState.error?.message}
              />
            )}
          />
          <TextInput
            label="Mother ID (for infant tags)"
            {...tagForm.register("mother_id")}
            error={tagForm.formState.errors.mother_id?.message}
          />
          <Button tone="primary" type="submit" loading={createTagMut.isPending}>
            Activate Tag
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Code Debriefs Tab
// ══════════════════════════════════════════════════════════

function CodeDebriefsTab() {
  const canCreate = useHasPermission(P.SECURITY.DEBRIEFS_CREATE);
  const qc = useQueryClient();

  const { data: debriefs = [], isLoading } = useQuery({
    queryKey: ["sec-debriefs"],
    queryFn: () => securityService.listSecurityCodeDebriefs(),
  });
  const [opened, { open, close }] = useDisclosure(false);
  const debriefForm = useForm<SecurityCodeDebriefFormInput>({
    resolver: zodResolver(securityCodeDebriefFormSchema),
    defaultValues: defaultSecurityCodeDebriefFormValues,
  });
  const handleOpen = () => {
    debriefForm.reset(defaultSecurityCodeDebriefFormValues);
    open();
  };
  const createMut = useMutation({
    mutationFn: (values: SecurityCodeDebriefFormInput) =>
      securityService.createSecurityCodeDebrief(securityCodeDebriefFormToRequest(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sec-debriefs"] });
      debriefForm.reset(defaultSecurityCodeDebriefFormValues);
      close();
      notifications.show({
        title: "Debrief Created",
        message: "Code debrief recorded",
        color: "success",
      });
    },
  });

  const columns: Column<SecurityCodeDebrief>[] = [
    {
      key: "code_activation_id",
      label: "Code Activation",
      render: (r) => <Text size="sm">{r.code_activation_id.slice(0, 8)}...</Text>,
    },
    { key: "debrief_date", label: "Date", render: (r) => <Text>{r.debrief_date}</Text> },
    {
      key: "response_time_seconds",
      label: "Response (sec)",
      render: (r) => <Text>{r.response_time_seconds ?? "—"}</Text>,
    },
    {
      key: "total_duration_minutes",
      label: "Duration (min)",
      render: (r) => <Text>{r.total_duration_minutes ?? "—"}</Text>,
    },
    {
      key: "action_items",
      label: "Actions",
      render: (r) => (
        <Badge tone="neutral">
          {Array.isArray(r.action_items) ? `${r.action_items.length} items` : "—"}
        </Badge>
      ),
    },
    {
      key: "created_at",
      label: "Created",
      render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleString()}</Text>,
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={handleOpen}>
            New Debrief
          </Button>
        </Group>
      )}
      <DataTable columns={columns} data={debriefs} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer
        opened={opened}
        onClose={close}
        title="Create Code Debrief"
        position="right"
        size="lg"
      >
        <Stack
          component="form"
          onSubmit={debriefForm.handleSubmit((values) => createMut.mutate(values))}
        >
          <TextInput
            label="Code Activation ID"
            required
            {...debriefForm.register("code_activation_id")}
            error={debriefForm.formState.errors.code_activation_id?.message}
          />
          <Controller
            control={debriefForm.control}
            name="response_time_seconds"
            render={({ field, fieldState }) => (
              <NumberInput
                label="Response Time (seconds)"
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                min={0}
              />
            )}
          />
          <Controller
            control={debriefForm.control}
            name="total_duration_minutes"
            render={({ field, fieldState }) => (
              <NumberInput
                label="Total Duration (minutes)"
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                min={0}
              />
            )}
          />
          <Textarea
            label="What Went Well"
            minRows={2}
            {...debriefForm.register("what_went_well")}
            error={debriefForm.formState.errors.what_went_well?.message}
          />
          <Textarea
            label="What Went Wrong"
            minRows={2}
            {...debriefForm.register("what_went_wrong")}
            error={debriefForm.formState.errors.what_went_wrong?.message}
          />
          <Textarea
            label="Root Cause"
            minRows={2}
            {...debriefForm.register("root_cause")}
            error={debriefForm.formState.errors.root_cause?.message}
          />
          <Textarea
            label="Lessons Learned"
            minRows={2}
            {...debriefForm.register("lessons_learned")}
            error={debriefForm.formState.errors.lessons_learned?.message}
          />
          <Textarea
            label="Equipment Issues"
            {...debriefForm.register("equipment_issues")}
            error={debriefForm.formState.errors.equipment_issues?.message}
          />
          <Textarea
            label="Training Gaps"
            {...debriefForm.register("training_gaps")}
            error={debriefForm.formState.errors.training_gaps?.message}
          />
          <Textarea
            label="Protocol Changes Recommended"
            {...debriefForm.register("protocol_changes_recommended")}
            error={debriefForm.formState.errors.protocol_changes_recommended?.message}
          />
          <Button tone="primary" type="submit" loading={createMut.isPending}>
            Create Debrief
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════

export function SecurityPage() {
  useRequirePermission(P.SECURITY.ACCESS_LIST);

  return (
    <div>
      <PageHeader
        title="Security Department"
        subtitle="Access control, CCTV, incident management, patient safety tags"
      />
      <Tabs defaultValue="access">
        <Tabs.List>
          <Tabs.Tab value="access" leftSection={<IconShieldLock size={16} />}>
            Access Control
          </Tabs.Tab>
          <Tabs.Tab value="cctv" leftSection={<IconVideo size={16} />}>
            CCTV
          </Tabs.Tab>
          <Tabs.Tab value="incidents" leftSection={<IconAlertTriangle size={16} />}>
            Incidents
          </Tabs.Tab>
          <Tabs.Tab value="patient-safety" leftSection={<IconBabyCarriage size={16} />}>
            Patient Safety
          </Tabs.Tab>
          <Tabs.Tab value="debriefs" leftSection={<IconFileReport size={16} />}>
            Code Debriefs
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="access" pt="md">
          <AccessControlTab />
        </Tabs.Panel>
        <Tabs.Panel value="cctv" pt="md">
          <CctvTab />
        </Tabs.Panel>
        <Tabs.Panel value="incidents" pt="md">
          <IncidentsTab />
        </Tabs.Panel>
        <Tabs.Panel value="patient-safety" pt="md">
          <PatientSafetyTab />
        </Tabs.Panel>
        <Tabs.Panel value="debriefs" pt="md">
          <CodeDebriefsTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

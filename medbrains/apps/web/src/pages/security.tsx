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
  Switch,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconShieldLock,
  IconVideo,
  IconAlertTriangle,
  IconBabyCarriage,
  IconFileReport,
  IconPencil,
  IconX,
  IconCheck,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  SecurityZone,
  SecurityAccessLog,
  SecurityAccessCard,
  SecurityCamera,
  SecurityIncident,
  SecurityPatientTag,
  SecurityTagAlert,
  SecurityCodeDebrief,
  CreateSecurityZoneRequest,
  CreateSecurityAccessLogRequest,
  CreateSecurityAccessCardRequest,
  CreateSecurityCameraRequest,
  CreateSecurityIncidentRequest,
  UpdateSecurityIncidentRequest,
  CreateSecurityPatientTagRequest,
  ResolveSecurityTagAlertRequest,
  CreateSecurityCodeDebriefRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../components";
import { PatientSearchSelect } from "../components/PatientSearchSelect";
import { useRequirePermission } from "../hooks/useRequirePermission";
import type { Column } from "../components/DataTable";

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

const SEVERITY_COLORS: Record<string, string> = {
  low: "primary",
  medium: "warning",
  high: "orange",
  critical: "danger",
};

const ZONE_LEVEL_COLORS: Record<string, string> = {
  public: "slate",
  general: "primary",
  restricted: "orange",
  high_security: "danger",
  critical: "violet",
};

const STATUS_COLORS: Record<string, string> = {
  reported: "primary",
  investigating: "warning",
  resolved: "success",
  closed: "slate",
};

const ALERT_STATUS_COLORS: Record<string, string> = {
  active: "success",
  alert_triggered: "danger",
  resolved: "primary",
  deactivated: "slate",
};

// ══════════════════════════════════════════════════════════
//  Access Control Tab
// ══════════════════════════════════════════════════════════

function AccessControlTab() {
  const canManage = useHasPermission(P.SECURITY.ACCESS_MANAGE);
  const qc = useQueryClient();

  // ── Zones ──
  const { data: zones = [], isLoading: zonesLoading } = useQuery({ queryKey: ["sec-zones"], queryFn: () => api.listSecurityZones() });
  const [zoneOpened, { open: openZone, close: closeZone }] = useDisclosure(false);
  const [zoneForm, setZoneForm] = useState<CreateSecurityZoneRequest>({ name: "", zone_code: "" });
  const createZoneMut = useMutation({
    mutationFn: (d: CreateSecurityZoneRequest) => api.createSecurityZone(d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["sec-zones"] }); closeZone(); notifications.show({ title: "Zone Created", message: "Security zone added", color: "success" }); },
  });

  const zoneColumns: Column<SecurityZone>[] = [
    { key: "zone_code", label: "Code", render: (r) => <Text fw={600}>{r.zone_code}</Text> },
    { key: "name", label: "Name", render: (r) => <Text>{r.name}</Text> },
    { key: "level", label: "Level", render: (r) => <Badge color={ZONE_LEVEL_COLORS[r.level] ?? "slate"}>{r.level.replace("_", " ")}</Badge> },
    { key: "after_hours", label: "After Hours", render: (r) => r.after_hours_restricted ? <Badge color="orange">Restricted</Badge> : <Text c="dimmed">Open</Text> },
    { key: "is_active", label: "Status", render: (r) => <Badge color={r.is_active ? "success" : "slate"}>{r.is_active ? "Active" : "Inactive"}</Badge> },
  ];

  // ── Access Cards ──
  const { data: cards = [], isLoading: cardsLoading } = useQuery({ queryKey: ["sec-cards"], queryFn: () => api.listSecurityAccessCards() });
  const [cardOpened, { open: openCard, close: closeCard }] = useDisclosure(false);
  const [cardForm, setCardForm] = useState<CreateSecurityAccessCardRequest>({ employee_id: "", card_number: "" });
  const createCardMut = useMutation({
    mutationFn: (d: CreateSecurityAccessCardRequest) => api.createSecurityAccessCard(d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["sec-cards"] }); closeCard(); notifications.show({ title: "Card Issued", message: "Access card created", color: "success" }); },
  });
  const deactivateCardMut = useMutation({
    mutationFn: (id: string) => api.deactivateSecurityAccessCard(id, "Manual deactivation"),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["sec-cards"] }); notifications.show({ title: "Card Deactivated", message: "Access card deactivated", color: "orange" }); },
  });

  const cardColumns: Column<SecurityAccessCard>[] = [
    { key: "card_number", label: "Card #", render: (r) => <Text fw={600}>{r.card_number}</Text> },
    { key: "employee_id", label: "Employee", render: (r) => <Text size="sm">{r.employee_id.slice(0, 8)}...</Text> },
    { key: "card_type", label: "Type", render: (r) => <Text>{r.card_type ?? "standard"}</Text> },
    { key: "issued_date", label: "Issued", render: (r) => <Text size="sm">{r.issued_date}</Text> },
    { key: "is_active", label: "Status", render: (r) => <Badge color={r.is_active ? "success" : "slate"}>{r.is_active ? "Active" : "Inactive"}</Badge> },
    ...(canManage ? [{
      key: "actions" as const, label: "Actions", render: (r: SecurityAccessCard) => r.is_active ? (
        <Tooltip label="Deactivate">
          <ActionIcon color="danger" variant="light" onClick={() => deactivateCardMut.mutate(r.id)} aria-label="Close">
            <IconX size={16} />
          </ActionIcon>
        </Tooltip>
      ) : <Text c="dimmed">—</Text>,
    }] : []),
  ];

  // ── Access Logs ──
  const { data: logs = [], isLoading: logsLoading } = useQuery({ queryKey: ["sec-access-logs"], queryFn: () => api.listSecurityAccessLogs() });
  const [logOpened, { open: openLog, close: closeLog }] = useDisclosure(false);
  const [logForm, setLogForm] = useState<CreateSecurityAccessLogRequest>({ zone_id: "" });
  const createLogMut = useMutation({
    mutationFn: (d: CreateSecurityAccessLogRequest) => api.createSecurityAccessLog(d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["sec-access-logs"] }); closeLog(); notifications.show({ title: "Log Recorded", message: "Access log entry created", color: "success" }); },
  });

  const logColumns: Column<SecurityAccessLog>[] = [
    { key: "zone_id", label: "Zone", render: (r) => <Text size="sm">{zones.find((z) => z.id === r.zone_id)?.zone_code ?? r.zone_id.slice(0, 8)}</Text> },
    { key: "person_name", label: "Person", render: (r) => <Text>{r.person_name ?? r.employee_id?.slice(0, 8) ?? "—"}</Text> },
    { key: "access_method", label: "Method", render: (r) => <Badge variant="light">{r.access_method}</Badge> },
    { key: "direction", label: "Direction", render: (r) => <Badge color={r.direction === "entry" ? "success" : "orange"}>{r.direction}</Badge> },
    { key: "granted", label: "Access", render: (r) => <Badge color={r.granted ? "success" : "danger"}>{r.granted ? "Granted" : "Denied"}</Badge> },
    { key: "is_after_hours", label: "After Hours", render: (r) => r.is_after_hours ? <Badge color="orange">Yes</Badge> : <Text c="dimmed">No</Text> },
    { key: "accessed_at", label: "Time", render: (r) => <Text size="sm">{new Date(r.accessed_at).toLocaleString()}</Text> },
  ];

  return (
    <Stack>
      <Text fw={600} size="lg">Security Zones</Text>
      <Group>
        {canManage && <Button leftSection={<IconPlus size={16} />} onClick={openZone}>Add Zone</Button>}
      </Group>
      <DataTable columns={zoneColumns} data={zones} loading={zonesLoading} rowKey={(r) => r.id} />

      <Text fw={600} size="lg" mt="lg">Access Cards</Text>
      <Group>
        {canManage && <Button leftSection={<IconPlus size={16} />} onClick={openCard}>Issue Card</Button>}
      </Group>
      <DataTable columns={cardColumns} data={cards} loading={cardsLoading} rowKey={(r) => r.id} />

      <Text fw={600} size="lg" mt="lg">Access Logs</Text>
      <Group>
        {canManage && <Button leftSection={<IconPlus size={16} />} variant="light" onClick={openLog}>Log Entry</Button>}
      </Group>
      <DataTable columns={logColumns} data={logs} loading={logsLoading} rowKey={(r) => r.id} />

      {/* Zone Drawer */}
      <Drawer opened={zoneOpened} onClose={closeZone} title="Add Security Zone" position="right" size="md">
        <Stack>
          <TextInput label="Zone Code" required value={zoneForm.zone_code} onChange={(e) => setZoneForm({ ...zoneForm, zone_code: e.currentTarget.value })} />
          <TextInput label="Zone Name" required value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.currentTarget.value })} />
          <Select label="Security Level" data={ZONE_LEVELS} value={zoneForm.level ?? null} onChange={(v) => setZoneForm({ ...zoneForm, level: (v as CreateSecurityZoneRequest["level"]) ?? undefined })} />
          <Textarea label="Description" value={zoneForm.description ?? ""} onChange={(e) => setZoneForm({ ...zoneForm, description: e.currentTarget.value })} />
          <Switch label="After Hours Restricted" checked={zoneForm.after_hours_restricted ?? false} onChange={(e) => setZoneForm({ ...zoneForm, after_hours_restricted: e.currentTarget.checked })} />
          {zoneForm.after_hours_restricted && (
            <Group grow>
              <TextInput label="Start Time" placeholder="22:00" value={zoneForm.after_hours_start ?? ""} onChange={(e) => setZoneForm({ ...zoneForm, after_hours_start: e.currentTarget.value })} />
              <TextInput label="End Time" placeholder="06:00" value={zoneForm.after_hours_end ?? ""} onChange={(e) => setZoneForm({ ...zoneForm, after_hours_end: e.currentTarget.value })} />
            </Group>
          )}
          <Button onClick={() => createZoneMut.mutate(zoneForm)} loading={createZoneMut.isPending}>Create Zone</Button>
        </Stack>
      </Drawer>

      {/* Card Drawer */}
      <Drawer opened={cardOpened} onClose={closeCard} title="Issue Access Card" position="right" size="md">
        <Stack>
          <TextInput label="Employee ID" required value={cardForm.employee_id} onChange={(e) => setCardForm({ ...cardForm, employee_id: e.currentTarget.value })} />
          <TextInput label="Card Number" required value={cardForm.card_number} onChange={(e) => setCardForm({ ...cardForm, card_number: e.currentTarget.value })} />
          <Select label="Card Type" data={[{ value: "standard", label: "Standard" }, { value: "temporary", label: "Temporary" }, { value: "contractor", label: "Contractor" }]} value={cardForm.card_type ?? null} onChange={(v) => setCardForm({ ...cardForm, card_type: v ?? undefined })} />
          <Button onClick={() => createCardMut.mutate(cardForm)} loading={createCardMut.isPending}>Issue Card</Button>
        </Stack>
      </Drawer>

      {/* Access Log Drawer */}
      <Drawer opened={logOpened} onClose={closeLog} title="Record Access Log" position="right" size="md">
        <Stack>
          <Select label="Zone" required data={zones.map((z) => ({ value: z.id, label: `${z.zone_code} — ${z.name}` }))} value={logForm.zone_id || null} onChange={(v) => setLogForm({ ...logForm, zone_id: v ?? "" })} />
          <TextInput label="Person Name" value={logForm.person_name ?? ""} onChange={(e) => setLogForm({ ...logForm, person_name: e.currentTarget.value })} />
          <Select label="Access Method" data={ACCESS_METHODS} value={logForm.access_method ?? null} onChange={(v) => setLogForm({ ...logForm, access_method: (v as CreateSecurityAccessLogRequest["access_method"]) ?? undefined })} />
          <Select label="Direction" data={[{ value: "entry", label: "Entry" }, { value: "exit", label: "Exit" }]} value={logForm.direction ?? null} onChange={(v) => setLogForm({ ...logForm, direction: v ?? undefined })} />
          <Switch label="Granted" checked={logForm.granted ?? true} onChange={(e) => setLogForm({ ...logForm, granted: e.currentTarget.checked })} />
          <Switch label="After Hours" checked={logForm.is_after_hours ?? false} onChange={(e) => setLogForm({ ...logForm, is_after_hours: e.currentTarget.checked })} />
          <Button onClick={() => createLogMut.mutate(logForm)} loading={createLogMut.isPending}>Record Log</Button>
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

  const { data: cameras = [], isLoading } = useQuery({ queryKey: ["sec-cameras"], queryFn: () => api.listSecurityCameras() });
  const { data: zones = [] } = useQuery({ queryKey: ["sec-zones"], queryFn: () => api.listSecurityZones() });
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<CreateSecurityCameraRequest>({ name: "" });
  const createMut = useMutation({
    mutationFn: (d: CreateSecurityCameraRequest) => api.createSecurityCamera(d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["sec-cameras"] }); close(); notifications.show({ title: "Camera Added", message: "Camera registered", color: "success" }); },
  });

  const columns: Column<SecurityCamera>[] = [
    { key: "name", label: "Name", render: (r) => <Text fw={600}>{r.name}</Text> },
    { key: "zone_id", label: "Zone", render: (r) => <Text size="sm">{zones.find((z) => z.id === r.zone_id)?.zone_code ?? "—"}</Text> },
    { key: "camera_type", label: "Type", render: (r) => <Text>{r.camera_type ?? "—"}</Text> },
    { key: "resolution", label: "Resolution", render: (r) => <Text>{r.resolution ?? "—"}</Text> },
    { key: "retention_days", label: "Retention", render: (r) => <Text>{r.retention_days} days</Text> },
    { key: "is_recording", label: "Recording", render: (r) => <Badge color={r.is_recording ? "success" : "danger"}>{r.is_recording ? "Recording" : "Offline"}</Badge> },
    { key: "is_active", label: "Status", render: (r) => <Badge color={r.is_active ? "success" : "slate"}>{r.is_active ? "Active" : "Inactive"}</Badge> },
  ];

  return (
    <Stack>
      {canManage && (
        <Group>
          <Button leftSection={<IconPlus size={16} />} onClick={open}>Add Camera</Button>
        </Group>
      )}
      <DataTable columns={columns} data={cameras} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer opened={opened} onClose={close} title="Add Camera" position="right" size="md">
        <Stack>
          <TextInput label="Camera Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
          <TextInput label="Camera ID" value={form.camera_id ?? ""} onChange={(e) => setForm({ ...form, camera_id: e.currentTarget.value })} />
          <Select label="Zone" data={zones.map((z) => ({ value: z.id, label: `${z.zone_code} — ${z.name}` }))} value={form.zone_id ?? null} onChange={(v) => setForm({ ...form, zone_id: v ?? undefined })} />
          <TextInput label="Location Description" value={form.location_description ?? ""} onChange={(e) => setForm({ ...form, location_description: e.currentTarget.value })} />
          <Select label="Camera Type" data={CAMERA_TYPES} value={form.camera_type ?? null} onChange={(v) => setForm({ ...form, camera_type: v ?? undefined })} />
          <TextInput label="Resolution" placeholder="1080p" value={form.resolution ?? ""} onChange={(e) => setForm({ ...form, resolution: e.currentTarget.value })} />
          <NumberInput label="Retention Days" value={form.retention_days ?? 30} onChange={(v) => setForm({ ...form, retention_days: typeof v === "number" ? v : 30 })} min={1} max={365} />
          <TextInput label="IP Address" value={form.ip_address ?? ""} onChange={(e) => setForm({ ...form, ip_address: e.currentTarget.value })} />
          <Button onClick={() => createMut.mutate(form)} loading={createMut.isPending}>Add Camera</Button>
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

  const { data: incidents = [], isLoading } = useQuery({ queryKey: ["sec-incidents"], queryFn: () => api.listSecurityIncidents() });
  const { data: zones = [] } = useQuery({ queryKey: ["sec-zones"], queryFn: () => api.listSecurityZones() });
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<CreateSecurityIncidentRequest>({ category: "", description: "" });
  const createMut = useMutation({
    mutationFn: (d: CreateSecurityIncidentRequest) => api.createSecurityIncident(d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["sec-incidents"] }); close(); notifications.show({ title: "Incident Reported", message: "Security incident created", color: "success" }); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSecurityIncidentRequest }) => api.updateSecurityIncident(id, body),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["sec-incidents"] }); notifications.show({ title: "Incident Updated", message: "Status updated", color: "success" }); },
  });

  const columns: Column<SecurityIncident>[] = [
    { key: "incident_number", label: "Incident #", render: (r) => <Text fw={600} size="sm">{r.incident_number}</Text> },
    { key: "severity", label: "Severity", render: (r) => <Badge color={SEVERITY_COLORS[r.severity] ?? "slate"}>{r.severity}</Badge> },
    { key: "status", label: "Status", render: (r) => <Badge color={STATUS_COLORS[r.status] ?? "slate"}>{r.status}</Badge> },
    { key: "category", label: "Category", render: (r) => <Text>{r.category.replace("_", " ")}</Text> },
    { key: "zone_id", label: "Zone", render: (r) => <Text size="sm">{zones.find((z) => z.id === r.zone_id)?.zone_code ?? "—"}</Text> },
    { key: "occurred_at", label: "Occurred", render: (r) => <Text size="sm">{new Date(r.occurred_at).toLocaleString()}</Text> },
    { key: "police_notified", label: "Police", render: (r) => r.police_notified ? <Badge color="danger">Yes</Badge> : <Text c="dimmed">No</Text> },
    ...(canUpdate ? [{
      key: "actions" as const, label: "Actions", render: (r: SecurityIncident) => r.status === "reported" ? (
        <Tooltip label="Start Investigation">
          <ActionIcon color="warning" variant="light" onClick={() => updateMut.mutate({ id: r.id, body: { status: "investigating" } })} aria-label="Edit">
            <IconPencil size={16} />
          </ActionIcon>
        </Tooltip>
      ) : r.status === "investigating" ? (
        <Tooltip label="Resolve">
          <ActionIcon color="success" variant="light" onClick={() => updateMut.mutate({ id: r.id, body: { status: "resolved" } })} aria-label="Confirm">
            <IconCheck size={16} />
          </ActionIcon>
        </Tooltip>
      ) : <Text c="dimmed">—</Text>,
    }] : []),
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button leftSection={<IconPlus size={16} />} onClick={open}>Report Incident</Button>
        </Group>
      )}
      <DataTable columns={columns} data={incidents} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer opened={opened} onClose={close} title="Report Security Incident" position="right" size="lg">
        <Stack>
          <Select label="Severity" data={INCIDENT_SEVERITIES} value={form.severity ?? null} onChange={(v) => setForm({ ...form, severity: (v as CreateSecurityIncidentRequest["severity"]) ?? undefined })} />
          <Select label="Category" required data={INCIDENT_CATEGORIES} value={form.category || null} onChange={(v) => setForm({ ...form, category: v ?? "" })} />
          <Select label="Zone" data={zones.map((z) => ({ value: z.id, label: `${z.zone_code} — ${z.name}` }))} value={form.zone_id ?? null} onChange={(v) => setForm({ ...form, zone_id: v ?? undefined })} />
          <TextInput label="Location" value={form.location_description ?? ""} onChange={(e) => setForm({ ...form, location_description: e.currentTarget.value })} />
          <Textarea label="Description" required minRows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.currentTarget.value })} />
          <Switch label="Police Notified" checked={form.police_notified ?? false} onChange={(e) => setForm({ ...form, police_notified: e.currentTarget.checked })} />
          {form.police_notified && (
            <TextInput label="Police Report Number" value={form.police_report_number ?? ""} onChange={(e) => setForm({ ...form, police_report_number: e.currentTarget.value })} />
          )}
          <Button onClick={() => createMut.mutate(form)} loading={createMut.isPending}>Submit Report</Button>
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

  const { data: tags = [], isLoading: tagsLoading } = useQuery({ queryKey: ["sec-patient-tags"], queryFn: () => api.listSecurityPatientTags() });
  const { data: alerts = [], isLoading: alertsLoading } = useQuery({ queryKey: ["sec-tag-alerts"], queryFn: () => api.listSecurityTagAlerts() });
  const { data: zones = [] } = useQuery({ queryKey: ["sec-zones"], queryFn: () => api.listSecurityZones() });
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<CreateSecurityPatientTagRequest>({ patient_id: "", tag_type: "infant_rfid" });

  const createTagMut = useMutation({
    mutationFn: (d: CreateSecurityPatientTagRequest) => api.createSecurityPatientTag(d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["sec-patient-tags"] }); close(); notifications.show({ title: "Tag Activated", message: "Patient safety tag activated", color: "success" }); },
  });
  const deactivateTagMut = useMutation({
    mutationFn: (id: string) => api.deactivateSecurityPatientTag(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["sec-patient-tags"] }); notifications.show({ title: "Tag Deactivated", message: "Patient tag deactivated", color: "orange" }); },
  });
  const resolveAlertMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ResolveSecurityTagAlertRequest }) => api.resolveSecurityTagAlert(id, body),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["sec-tag-alerts"] }); notifications.show({ title: "Alert Resolved", message: "Tag alert resolved", color: "success" }); },
  });

  const tagColumns: Column<SecurityPatientTag>[] = [
    { key: "patient_id", label: "Patient", render: (r) => <Text size="sm">{r.patient_id.slice(0, 8)}...</Text> },
    { key: "tag_type", label: "Tag Type", render: (r) => <Badge variant="light">{r.tag_type.replace("_", " ")}</Badge> },
    { key: "tag_identifier", label: "Tag ID", render: (r) => <Text size="sm">{r.tag_identifier ?? "—"}</Text> },
    { key: "allowed_zone_id", label: "Zone", render: (r) => <Text size="sm">{zones.find((z) => z.id === r.allowed_zone_id)?.zone_code ?? "—"}</Text> },
    { key: "alert_status", label: "Status", render: (r) => <Badge color={ALERT_STATUS_COLORS[r.alert_status] ?? "slate"}>{r.alert_status.replace("_", " ")}</Badge> },
    { key: "activated_at", label: "Activated", render: (r) => <Text size="sm">{new Date(r.activated_at).toLocaleString()}</Text> },
    ...(canManage ? [{
      key: "actions" as const, label: "Actions", render: (r: SecurityPatientTag) => r.alert_status !== "deactivated" ? (
        <Tooltip label="Deactivate Tag">
          <ActionIcon color="danger" variant="light" onClick={() => deactivateTagMut.mutate(r.id)} aria-label="Close">
            <IconX size={16} />
          </ActionIcon>
        </Tooltip>
      ) : <Text c="dimmed">—</Text>,
    }] : []),
  ];

  const alertColumns: Column<SecurityTagAlert>[] = [
    { key: "alert_type", label: "Alert Type", render: (r) => <Badge color="danger">{r.alert_type.replace("_", " ")}</Badge> },
    { key: "triggered_at", label: "Triggered", render: (r) => <Text size="sm">{new Date(r.triggered_at).toLocaleString()}</Text> },
    { key: "zone_id", label: "Zone", render: (r) => <Text size="sm">{zones.find((z) => z.id === r.zone_id)?.zone_code ?? "—"}</Text> },
    { key: "is_resolved", label: "Status", render: (r) => <Badge color={r.is_resolved ? "success" : "danger"}>{r.is_resolved ? "Resolved" : "Active"}</Badge> },
    { key: "was_false_alarm", label: "False Alarm", render: (r) => r.is_resolved ? (r.was_false_alarm ? <Badge color="warning">Yes</Badge> : <Text c="dimmed">No</Text>) : <Text c="dimmed">—</Text> },
    ...(canManage ? [{
      key: "actions" as const, label: "Actions", render: (r: SecurityTagAlert) => !r.is_resolved ? (
        <Group gap="xs">
          <Tooltip label="Resolve">
            <ActionIcon color="success" variant="light" onClick={() => resolveAlertMut.mutate({ id: r.id, body: { was_false_alarm: false } })} aria-label="Confirm">
              <IconCheck size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="False Alarm">
            <ActionIcon color="warning" variant="light" onClick={() => resolveAlertMut.mutate({ id: r.id, body: { was_false_alarm: true, resolution_notes: "False alarm" } })} aria-label="Close">
              <IconX size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ) : <Text c="dimmed">—</Text>,
    }] : []),
  ];

  return (
    <Stack>
      <Text fw={600} size="lg">Active Patient Tags</Text>
      <Group>
        {canManage && <Button leftSection={<IconPlus size={16} />} onClick={open}>Activate Tag</Button>}
      </Group>
      <DataTable columns={tagColumns} data={tags} loading={tagsLoading} rowKey={(r) => r.id} />

      <Text fw={600} size="lg" mt="lg">Tag Alerts</Text>
      <DataTable columns={alertColumns} data={alerts} loading={alertsLoading} rowKey={(r) => r.id} />

      <Drawer opened={opened} onClose={close} title="Activate Patient Safety Tag" position="right" size="md">
        <Stack>
          <PatientSearchSelect value={form.patient_id} onChange={(id) => setForm({ ...form, patient_id: id })} required />
          <Select label="Tag Type" required data={TAG_TYPES} value={form.tag_type || null} onChange={(v) => setForm({ ...form, tag_type: (v as CreateSecurityPatientTagRequest["tag_type"]) ?? "infant_rfid" })} />
          <TextInput label="Tag Identifier" value={form.tag_identifier ?? ""} onChange={(e) => setForm({ ...form, tag_identifier: e.currentTarget.value })} />
          <Select label="Allowed Zone" data={zones.map((z) => ({ value: z.id, label: `${z.zone_code} — ${z.name}` }))} value={form.allowed_zone_id ?? null} onChange={(v) => setForm({ ...form, allowed_zone_id: v ?? undefined })} />
          <TextInput label="Mother ID (for infant tags)" value={form.mother_id ?? ""} onChange={(e) => setForm({ ...form, mother_id: e.currentTarget.value || undefined })} />
          <Button onClick={() => createTagMut.mutate(form)} loading={createTagMut.isPending}>Activate Tag</Button>
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

  const { data: debriefs = [], isLoading } = useQuery({ queryKey: ["sec-debriefs"], queryFn: () => api.listSecurityCodeDebriefs() });
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<CreateSecurityCodeDebriefRequest>({ code_activation_id: "" });
  const createMut = useMutation({
    mutationFn: (d: CreateSecurityCodeDebriefRequest) => api.createSecurityCodeDebrief(d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["sec-debriefs"] }); close(); notifications.show({ title: "Debrief Created", message: "Code debrief recorded", color: "success" }); },
  });

  const columns: Column<SecurityCodeDebrief>[] = [
    { key: "code_activation_id", label: "Code Activation", render: (r) => <Text size="sm">{r.code_activation_id.slice(0, 8)}...</Text> },
    { key: "debrief_date", label: "Date", render: (r) => <Text>{r.debrief_date}</Text> },
    { key: "response_time_seconds", label: "Response (sec)", render: (r) => <Text>{r.response_time_seconds ?? "—"}</Text> },
    { key: "total_duration_minutes", label: "Duration (min)", render: (r) => <Text>{r.total_duration_minutes ?? "—"}</Text> },
    { key: "action_items", label: "Actions", render: (r) => <Badge variant="light">{Array.isArray(r.action_items) ? `${(r.action_items as unknown[]).length} items` : "—"}</Badge> },
    { key: "created_at", label: "Created", render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleString()}</Text> },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button leftSection={<IconPlus size={16} />} onClick={open}>New Debrief</Button>
        </Group>
      )}
      <DataTable columns={columns} data={debriefs} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer opened={opened} onClose={close} title="Create Code Debrief" position="right" size="lg">
        <Stack>
          <TextInput label="Code Activation ID" required value={form.code_activation_id} onChange={(e) => setForm({ ...form, code_activation_id: e.currentTarget.value })} />
          <NumberInput label="Response Time (seconds)" value={form.response_time_seconds ?? undefined} onChange={(v) => setForm({ ...form, response_time_seconds: typeof v === "number" ? v : undefined })} min={0} />
          <NumberInput label="Total Duration (minutes)" value={form.total_duration_minutes ?? undefined} onChange={(v) => setForm({ ...form, total_duration_minutes: typeof v === "number" ? v : undefined })} min={0} />
          <Textarea label="What Went Well" minRows={2} value={form.what_went_well ?? ""} onChange={(e) => setForm({ ...form, what_went_well: e.currentTarget.value })} />
          <Textarea label="What Went Wrong" minRows={2} value={form.what_went_wrong ?? ""} onChange={(e) => setForm({ ...form, what_went_wrong: e.currentTarget.value })} />
          <Textarea label="Root Cause" minRows={2} value={form.root_cause ?? ""} onChange={(e) => setForm({ ...form, root_cause: e.currentTarget.value })} />
          <Textarea label="Lessons Learned" minRows={2} value={form.lessons_learned ?? ""} onChange={(e) => setForm({ ...form, lessons_learned: e.currentTarget.value })} />
          <Textarea label="Equipment Issues" value={form.equipment_issues ?? ""} onChange={(e) => setForm({ ...form, equipment_issues: e.currentTarget.value })} />
          <Textarea label="Training Gaps" value={form.training_gaps ?? ""} onChange={(e) => setForm({ ...form, training_gaps: e.currentTarget.value })} />
          <Textarea label="Protocol Changes Recommended" value={form.protocol_changes_recommended ?? ""} onChange={(e) => setForm({ ...form, protocol_changes_recommended: e.currentTarget.value })} />
          <Button onClick={() => createMut.mutate(form)} loading={createMut.isPending}>Create Debrief</Button>
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
          <Tabs.Tab value="access" leftSection={<IconShieldLock size={16} />}>Access Control</Tabs.Tab>
          <Tabs.Tab value="cctv" leftSection={<IconVideo size={16} />}>CCTV</Tabs.Tab>
          <Tabs.Tab value="incidents" leftSection={<IconAlertTriangle size={16} />}>Incidents</Tabs.Tab>
          <Tabs.Tab value="patient-safety" leftSection={<IconBabyCarriage size={16} />}>Patient Safety</Tabs.Tab>
          <Tabs.Tab value="debriefs" leftSection={<IconFileReport size={16} />}>Code Debriefs</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="access" pt="md"><AccessControlTab /></Tabs.Panel>
        <Tabs.Panel value="cctv" pt="md"><CctvTab /></Tabs.Panel>
        <Tabs.Panel value="incidents" pt="md"><IncidentsTab /></Tabs.Panel>
        <Tabs.Panel value="patient-safety" pt="md"><PatientSafetyTab /></Tabs.Panel>
        <Tabs.Panel value="debriefs" pt="md"><CodeDebriefsTab /></Tabs.Panel>
      </Tabs>
    </div>
  );
}

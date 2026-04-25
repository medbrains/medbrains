import { useState } from "react";
import {
  ActionIcon, Badge, Button, Card, Drawer, Group, NumberInput,
  Select, SimpleGrid, Stack, Switch, Tabs, Text, TextInput, Textarea, Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconPlus, IconMail, IconStethoscope, IconAlertTriangle,
  IconMoodSad, IconStar, IconSettings, IconCheck, IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../components";
import { EmployeeSearchSelect } from "../components/EmployeeSearchSelect";
import { useRequirePermission } from "../hooks/useRequirePermission";
import type { Column } from "../components/DataTable";
import type {
  CommMessageRow, CommClinicalMessageRow, CommCriticalAlertRow,
  CommComplaintRow, CommFeedbackSurveyRow, CommTemplateRow,
} from "@medbrains/types";

const CHANNEL_COLORS: Record<string, string> = { sms: "blue", whatsapp: "green", email: "violet", push: "orange", ivr: "cyan", portal: "teal" };
const MSG_STATUS_COLORS: Record<string, string> = { queued: "gray", sent: "blue", delivered: "green", failed: "red", read: "teal" };
const PRIORITY_COLORS: Record<string, string> = { routine: "blue", urgent: "orange", critical: "red", stat: "red" };
const ALERT_STATUS_COLORS: Record<string, string> = { triggered: "red", acknowledged: "blue", escalated: "orange", resolved: "green", expired: "gray" };
const COMPLAINT_STATUS_COLORS: Record<string, string> = { open: "red", assigned: "blue", in_progress: "orange", pending_review: "yellow", resolved: "green", closed: "gray", reopened: "red" };
const SEVERITY_COLORS: Record<string, string> = { low: "blue", medium: "yellow", high: "orange", critical: "red" };
const FEEDBACK_COLORS: Record<string, string> = { bedside: "teal", post_discharge: "blue", nps: "violet", department: "orange", kiosk: "cyan" };

// ── Messages Tab ────────────────────────────────────────
function MessagesTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.COMMUNICATIONS.MESSAGES_CREATE);
  const [opened, { open, close }] = useDisclosure(false);
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [form, setForm] = useState<any>({});

  const { data = [], isLoading } = useQuery({
    queryKey: ["comm-messages", channelFilter, statusFilter],
    queryFn: () => api.listCommMessages({ channel: channelFilter ?? undefined, status: statusFilter ?? undefined }),
  });

  const createMut = useMutation({
    mutationFn: (d: any) => api.createCommMessage(d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["comm-messages"] }); close(); notifications.show({ title: "Queued", message: "Message queued", color: "green" }); },
  });

  const cols: Column<CommMessageRow>[] = [
    { key: "message_code", label: "Code", render: (r) => <Text fw={600} size="sm">{r.message_code}</Text> },
    { key: "channel", label: "Channel", render: (r) => <Badge size="sm" color={CHANNEL_COLORS[r.channel] ?? "gray"}>{r.channel}</Badge> },
    { key: "status", label: "Status", render: (r) => <Badge size="sm" color={MSG_STATUS_COLORS[r.status] ?? "gray"}>{r.status}</Badge> },
    { key: "recipient_name", label: "Recipient", render: (r) => <Text size="sm">{r.recipient_name ?? r.recipient_contact}</Text> },
    { key: "body", label: "Body", render: (r) => <Text size="sm" lineClamp={1}>{r.body}</Text> },
    { key: "created_at", label: "Created", render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleString()}</Text> },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Group>
          <Select placeholder="Channel" clearable value={channelFilter} onChange={setChannelFilter} data={Object.keys(CHANNEL_COLORS).map((s) => ({ value: s, label: s }))} w={140} />
          <Select placeholder="Status" clearable value={statusFilter} onChange={setStatusFilter} data={Object.keys(MSG_STATUS_COLORS).map((s) => ({ value: s, label: s }))} w={140} />
        </Group>
        {canCreate && <Button leftSection={<IconPlus size={16} />} onClick={() => { setForm({}); open(); }}>Send Message</Button>}
      </Group>
      <DataTable columns={cols} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer opened={opened} onClose={close} title="Send Message" position="right" size="xl">
        <Stack>
          <Select label="Channel" required data={Object.keys(CHANNEL_COLORS)} value={form.channel ?? null} onChange={(v) => setForm({ ...form, channel: v })} />
          <TextInput label="Recipient Name" value={form.recipient_name ?? ""} onChange={(e) => setForm({ ...form, recipient_name: e.currentTarget.value })} />
          <TextInput label="Recipient Contact" required value={form.recipient_contact ?? ""} onChange={(e) => setForm({ ...form, recipient_contact: e.currentTarget.value })} />
          <TextInput label="Subject" value={form.subject ?? ""} onChange={(e) => setForm({ ...form, subject: e.currentTarget.value })} />
          <Textarea label="Body" required minRows={3} value={form.body ?? ""} onChange={(e) => setForm({ ...form, body: e.currentTarget.value })} />
          <Button onClick={() => { if (!form.channel || !form.recipient_contact || !form.body) return; createMut.mutate(form); }} loading={createMut.isPending}>Queue Message</Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ── Clinical Tab ────────────────────────────────────────
function ClinicalTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.COMMUNICATIONS.CLINICAL_CREATE);
  const canAck = useHasPermission(P.COMMUNICATIONS.CLINICAL_ACKNOWLEDGE);
  const [opened, { open, close }] = useDisclosure(false);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [form, setForm] = useState<any>({});

  const { data = [], isLoading } = useQuery({
    queryKey: ["comm-clinical", priorityFilter],
    queryFn: () => api.listClinicalMessages({ priority: priorityFilter ?? undefined }),
  });

  const createMut = useMutation({
    mutationFn: (d: any) => api.createClinicalMessage(d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["comm-clinical"] }); close(); notifications.show({ title: "Sent", message: "Clinical message sent", color: "green" }); },
  });

  const ackMut = useMutation({
    mutationFn: (id: string) => api.acknowledgeClinicalMessage(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["comm-clinical"] }); notifications.show({ title: "Acknowledged", message: "Message acknowledged", color: "blue" }); },
  });

  const cols: Column<CommClinicalMessageRow>[] = [
    { key: "message_code", label: "Code", render: (r) => <Text fw={600} size="sm">{r.message_code}</Text> },
    { key: "priority", label: "Priority", render: (r) => <Badge size="sm" color={PRIORITY_COLORS[r.priority] ?? "gray"}>{r.priority}</Badge> },
    { key: "message_type", label: "Type", render: (r) => <Badge size="sm" variant="light">{r.message_type.replace(/_/g, " ")}</Badge> },
    { key: "subject", label: "Subject", render: (r) => <Text size="sm">{r.subject ?? "—"}</Text> },
    { key: "body", label: "Body", render: (r) => <Text size="sm" lineClamp={1}>{r.body}</Text> },
    { key: "is_read", label: "Read", render: (r) => <Badge size="xs" color={r.is_read ? "green" : "gray"}>{r.is_read ? "Yes" : "No"}</Badge> },
    { key: "actions", label: "", render: (r) => !r.acknowledged_at && canAck ? (
      <ActionIcon variant="subtle" color="blue" size="sm" onClick={() => ackMut.mutate(r.id)} aria-label="Confirm"><IconCheck size={14} /></ActionIcon>
    ) : null },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select placeholder="Priority" clearable value={priorityFilter} onChange={setPriorityFilter} data={Object.keys(PRIORITY_COLORS)} w={140} />
        {canCreate && <Button leftSection={<IconPlus size={16} />} onClick={() => { setForm({}); open(); }}>New Message</Button>}
      </Group>
      <DataTable columns={cols} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer opened={opened} onClose={close} title="Clinical Message" position="right" size="xl">
        <Stack>
          <EmployeeSearchSelect label="Recipient" value={form.recipient_id ?? ""} onChange={(id) => setForm({ ...form, recipient_id: id })} required />
          <Select label="Type" required data={["general", "sbar_handover", "referral", "discharge_comm", "intercom_code"]} value={form.message_type ?? null} onChange={(v) => setForm({ ...form, message_type: v })} />
          <Select label="Priority" data={Object.keys(PRIORITY_COLORS)} value={form.priority ?? null} onChange={(v) => setForm({ ...form, priority: v })} />
          <TextInput label="Subject" value={form.subject ?? ""} onChange={(e) => setForm({ ...form, subject: e.currentTarget.value })} />
          <Textarea label="Body" required minRows={3} value={form.body ?? ""} onChange={(e) => setForm({ ...form, body: e.currentTarget.value })} />
          <Switch label="Urgent" checked={form.is_urgent ?? false} onChange={(e) => setForm({ ...form, is_urgent: e.currentTarget.checked })} />
          <Button onClick={() => { if (!form.recipient_id || !form.message_type || !form.body) return; createMut.mutate(form); }} loading={createMut.isPending}>Send</Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ── Alerts Tab ──────────────────────────────────────────
function AlertsTab() {
  const qc = useQueryClient();
  const canManage = useHasPermission(P.COMMUNICATIONS.ALERTS_MANAGE);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["comm-alerts", statusFilter],
    queryFn: () => api.listCommAlerts({ status: statusFilter ?? undefined }),
  });

  const ackMut = useMutation({
    mutationFn: (id: string) => api.acknowledgeCommAlert(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["comm-alerts"] }); notifications.show({ title: "Acknowledged", message: "Alert acknowledged", color: "blue" }); },
  });

  const resolveMut = useMutation({
    mutationFn: (id: string) => api.resolveCommAlert(id, {}),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["comm-alerts"] }); notifications.show({ title: "Resolved", message: "Alert resolved", color: "green" }); },
  });

  const active = data.filter((a) => a.status === "triggered" || a.status === "acknowledged");

  const cols: Column<CommCriticalAlertRow>[] = [
    { key: "alert_code", label: "Code", render: (r) => <Text fw={600} size="sm">{r.alert_code}</Text> },
    { key: "alert_source", label: "Source", render: (r) => <Badge size="sm" variant="light">{r.alert_source}</Badge> },
    { key: "priority", label: "Priority", render: (r) => <Badge size="sm" color={PRIORITY_COLORS[r.priority] ?? "gray"}>{r.priority}</Badge> },
    { key: "status", label: "Status", render: (r) => <Badge size="sm" color={ALERT_STATUS_COLORS[r.status] ?? "gray"}>{r.status}</Badge> },
    { key: "title", label: "Title", render: (r) => <Text size="sm">{r.title}</Text> },
    { key: "alert_value", label: "Value", render: (r) => <Text size="sm" fw={600} c="red">{r.alert_value ?? "—"}</Text> },
    { key: "normal_range", label: "Normal", render: (r) => <Text size="sm" c="dimmed">{r.normal_range ?? "—"}</Text> },
    { key: "actions", label: "", render: (r) => {
      if (!canManage) return null;
      return (
        <Group gap={4}>
          {r.status === "triggered" && <Tooltip label="Acknowledge"><ActionIcon variant="subtle" color="blue" size="sm" onClick={() => ackMut.mutate(r.id)} aria-label="Confirm"><IconCheck size={14} /></ActionIcon></Tooltip>}
          {(r.status === "triggered" || r.status === "acknowledged") && <Tooltip label="Resolve"><ActionIcon variant="subtle" color="green" size="sm" onClick={() => resolveMut.mutate(r.id)} aria-label="Close"><IconX size={14} /></ActionIcon></Tooltip>}
        </Group>
      );
    }},
  ];

  return (
    <>
      <SimpleGrid cols={{ base: 2, md: 3 }} mb="md">
        <Card withBorder><Text size="xs" c="dimmed">Active Alerts</Text><Text size="xl" fw={700} c="red">{active.length}</Text></Card>
        <Card withBorder><Text size="xs" c="dimmed">Escalated</Text><Text size="xl" fw={700} c="orange">{data.filter((a) => a.status === "escalated").length}</Text></Card>
        <Card withBorder><Text size="xs" c="dimmed">Resolved Today</Text><Text size="xl" fw={700} c="green">{data.filter((a) => a.status === "resolved").length}</Text></Card>
      </SimpleGrid>
      <Group mb="md">
        <Select placeholder="Status" clearable value={statusFilter} onChange={setStatusFilter} data={Object.keys(ALERT_STATUS_COLORS)} w={160} />
      </Group>
      <DataTable columns={cols} data={data} loading={isLoading} rowKey={(r) => r.id} />
    </>
  );
}

// ── Complaints Tab ──────────────────────────────────────
function ComplaintsTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.COMMUNICATIONS.COMPLAINTS_CREATE);
  const canManage = useHasPermission(P.COMMUNICATIONS.COMPLAINTS_MANAGE);
  const [opened, { open, close }] = useDisclosure(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [form, setForm] = useState<any>({});

  const { data = [], isLoading } = useQuery({
    queryKey: ["comm-complaints", statusFilter],
    queryFn: () => api.listComplaints({ status: statusFilter ?? undefined }),
  });

  const createMut = useMutation({
    mutationFn: (d: any) => api.createComplaint(d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["comm-complaints"] }); close(); notifications.show({ title: "Registered", message: "Complaint registered", color: "green" }); },
  });

  const resolveMut = useMutation({
    mutationFn: (id: string) => api.resolveComplaint(id, {}),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["comm-complaints"] }); notifications.show({ title: "Resolved", message: "Complaint resolved", color: "green" }); },
  });

  const cols: Column<CommComplaintRow>[] = [
    { key: "complaint_code", label: "Code", render: (r) => <Text fw={600} size="sm">{r.complaint_code}</Text> },
    { key: "source", label: "Source", render: (r) => <Badge size="sm" variant="light">{r.source.replace(/_/g, " ")}</Badge> },
    { key: "status", label: "Status", render: (r) => <Badge size="sm" color={COMPLAINT_STATUS_COLORS[r.status] ?? "gray"}>{r.status.replace(/_/g, " ")}</Badge> },
    { key: "severity", label: "Severity", render: (r) => <Badge size="sm" color={SEVERITY_COLORS[r.severity ?? "medium"] ?? "gray"}>{r.severity ?? "medium"}</Badge> },
    { key: "complainant_name", label: "Complainant", render: (r) => <Text size="sm">{r.complainant_name}</Text> },
    { key: "subject", label: "Subject", render: (r) => <Text size="sm" lineClamp={1}>{r.subject}</Text> },
    { key: "sla_deadline", label: "SLA", render: (r) => {
      if (!r.sla_deadline) return <Text size="sm">—</Text>;
      const remaining = (new Date(r.sla_deadline).getTime() - Date.now()) / 3600000;
      return <Badge size="sm" color={r.sla_breached ? "red" : remaining < 4 ? "orange" : "green"}>{r.sla_breached ? "Breached" : `${Math.round(remaining)}h`}</Badge>;
    }},
    { key: "actions", label: "", render: (r) => canManage && r.status !== "resolved" && r.status !== "closed" ? (
      <Tooltip label="Resolve"><ActionIcon variant="subtle" color="green" size="sm" onClick={() => resolveMut.mutate(r.id)} aria-label="Confirm"><IconCheck size={14} /></ActionIcon></Tooltip>
    ) : null },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select placeholder="Status" clearable value={statusFilter} onChange={setStatusFilter} data={Object.keys(COMPLAINT_STATUS_COLORS).map((s) => ({ value: s, label: s.replace(/_/g, " ") }))} w={180} />
        {canCreate && <Button leftSection={<IconPlus size={16} />} onClick={() => { setForm({}); open(); }}>New Complaint</Button>}
      </Group>
      <DataTable columns={cols} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer opened={opened} onClose={close} title="Register Complaint" position="right" size="xl">
        <Stack>
          <Select label="Source" required data={["walk_in", "phone", "email", "portal", "kiosk", "social_media", "google_review"]} value={form.source ?? null} onChange={(v) => setForm({ ...form, source: v })} />
          <TextInput label="Complainant Name" required value={form.complainant_name ?? ""} onChange={(e) => setForm({ ...form, complainant_name: e.currentTarget.value })} />
          <TextInput label="Phone" value={form.complainant_phone ?? ""} onChange={(e) => setForm({ ...form, complainant_phone: e.currentTarget.value })} />
          <TextInput label="Email" value={form.complainant_email ?? ""} onChange={(e) => setForm({ ...form, complainant_email: e.currentTarget.value })} />
          <Select label="Category" data={["clinical", "billing", "staff_behavior", "facilities", "wait_time", "food", "other"]} value={form.category ?? null} onChange={(v) => setForm({ ...form, category: v })} />
          <Select label="Severity" data={["low", "medium", "high", "critical"]} value={form.severity ?? null} onChange={(v) => setForm({ ...form, severity: v })} />
          <TextInput label="Subject" required value={form.subject ?? ""} onChange={(e) => setForm({ ...form, subject: e.currentTarget.value })} />
          <Textarea label="Description" required minRows={3} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.currentTarget.value })} />
          <NumberInput label="SLA Hours" value={form.sla_hours ?? 48} onChange={(v) => setForm({ ...form, sla_hours: v })} />
          <Button onClick={() => { if (!form.source || !form.complainant_name || !form.subject || !form.description) return; createMut.mutate(form); }} loading={createMut.isPending}>Register</Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ── Feedback Tab ────────────────────────────────────────
function FeedbackTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.COMMUNICATIONS.FEEDBACK_CREATE);
  const [opened, { open, close }] = useDisclosure(false);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [form, setForm] = useState<any>({});

  const { data = [], isLoading } = useQuery({
    queryKey: ["comm-feedback", typeFilter],
    queryFn: () => api.listCommFeedback({ feedback_type: typeFilter ?? undefined }),
  });

  const { data: stats } = useQuery({
    queryKey: ["comm-feedback-stats", typeFilter],
    queryFn: () => api.getCommFeedbackStats({ feedback_type: typeFilter ?? undefined }),
  });

  const createMut = useMutation({
    mutationFn: (d: any) => api.createCommFeedback(d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["comm-feedback"] }); void qc.invalidateQueries({ queryKey: ["comm-feedback-stats"] }); close(); notifications.show({ title: "Recorded", message: "Feedback recorded", color: "green" }); },
  });

  const cols: Column<CommFeedbackSurveyRow>[] = [
    { key: "feedback_code", label: "Code", render: (r) => <Text fw={600} size="sm">{r.feedback_code}</Text> },
    { key: "feedback_type", label: "Type", render: (r) => <Badge size="sm" color={FEEDBACK_COLORS[r.feedback_type] ?? "gray"}>{r.feedback_type.replace(/_/g, " ")}</Badge> },
    { key: "overall_rating", label: "Rating", render: (r) => <Text size="sm" fw={600}>{r.overall_rating ?? "—"}/5</Text> },
    { key: "nps_score", label: "NPS", render: (r) => <Text size="sm">{r.nps_score ?? "—"}/10</Text> },
    { key: "would_recommend", label: "Recommend", render: (r) => r.would_recommend != null ? <Badge size="xs" color={r.would_recommend ? "green" : "red"}>{r.would_recommend ? "Yes" : "No"}</Badge> : <Text size="sm">—</Text> },
    { key: "comments", label: "Comments", render: (r) => <Text size="sm" lineClamp={1}>{r.comments ?? "—"}</Text> },
    { key: "submitted_at", label: "Submitted", render: (r) => <Text size="sm">{new Date(r.submitted_at).toLocaleString()}</Text> },
  ];

  return (
    <>
      <SimpleGrid cols={{ base: 2, md: 4 }} mb="md">
        <Card withBorder><Text size="xs" c="dimmed">Total Responses</Text><Text size="xl" fw={700}>{stats?.total_responses ?? 0}</Text></Card>
        <Card withBorder><Text size="xs" c="dimmed">NPS Score</Text><Text size="xl" fw={700} c={stats && stats.nps_score >= 50 ? "green" : "orange"}>{stats?.nps_score?.toFixed(0) ?? 0}</Text></Card>
        <Card withBorder><Text size="xs" c="dimmed">Avg Rating</Text><Text size="xl" fw={700}>{stats?.avg_overall?.toFixed(1) ?? 0}/5</Text></Card>
        <Card withBorder><Text size="xs" c="dimmed">Would Recommend</Text><Text size="xl" fw={700}>{stats?.would_recommend_pct?.toFixed(0) ?? 0}%</Text></Card>
      </SimpleGrid>
      <Group justify="space-between" mb="md">
        <Select placeholder="Type" clearable value={typeFilter} onChange={setTypeFilter} data={Object.keys(FEEDBACK_COLORS).map((s) => ({ value: s, label: s.replace(/_/g, " ") }))} w={180} />
        {canCreate && <Button leftSection={<IconPlus size={16} />} onClick={() => { setForm({}); open(); }}>Collect Feedback</Button>}
      </Group>
      <DataTable columns={cols} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer opened={opened} onClose={close} title="Collect Feedback" position="right" size="xl">
        <Stack>
          <Select label="Type" required data={Object.keys(FEEDBACK_COLORS)} value={form.feedback_type ?? null} onChange={(v) => setForm({ ...form, feedback_type: v })} />
          <NumberInput label="Overall Rating (1-5)" min={1} max={5} value={form.overall_rating ?? ""} onChange={(v) => setForm({ ...form, overall_rating: v })} />
          <NumberInput label="NPS Score (0-10)" min={0} max={10} value={form.nps_score ?? ""} onChange={(v) => setForm({ ...form, nps_score: v })} />
          <NumberInput label="Staff Rating (1-5)" min={1} max={5} value={form.staff_rating ?? ""} onChange={(v) => setForm({ ...form, staff_rating: v })} />
          <NumberInput label="Cleanliness (1-5)" min={1} max={5} value={form.cleanliness_rating ?? ""} onChange={(v) => setForm({ ...form, cleanliness_rating: v })} />
          <Switch label="Would Recommend" checked={form.would_recommend ?? false} onChange={(e) => setForm({ ...form, would_recommend: e.currentTarget.checked })} />
          <Textarea label="Comments" value={form.comments ?? ""} onChange={(e) => setForm({ ...form, comments: e.currentTarget.value })} />
          <Textarea label="Suggestions" value={form.suggestions ?? ""} onChange={(e) => setForm({ ...form, suggestions: e.currentTarget.value })} />
          <Switch label="Anonymous" checked={form.is_anonymous ?? false} onChange={(e) => setForm({ ...form, is_anonymous: e.currentTarget.checked })} />
          <Button onClick={() => { if (!form.feedback_type) return; createMut.mutate(form); }} loading={createMut.isPending}>Submit</Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ── Config Tab ──────────────────────────────────────────
function ConfigTab() {
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [form, setForm] = useState<any>({});

  const { data = [], isLoading } = useQuery({
    queryKey: ["comm-templates"],
    queryFn: () => api.listCommTemplates(),
  });

  const createMut = useMutation({
    mutationFn: (d: any) => api.createCommTemplate(d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["comm-templates"] }); close(); notifications.show({ title: "Created", message: "Template created", color: "green" }); },
  });

  const cols: Column<CommTemplateRow>[] = [
    { key: "template_name", label: "Name", render: (r) => <Text fw={600} size="sm">{r.template_name}</Text> },
    { key: "template_code", label: "Code", render: (r) => <Text size="sm" c="dimmed">{r.template_code}</Text> },
    { key: "channel", label: "Channel", render: (r) => <Badge size="sm" color={CHANNEL_COLORS[r.channel] ?? "gray"}>{r.channel}</Badge> },
    { key: "template_type", label: "Type", render: (r) => <Badge size="sm" variant="light">{r.template_type.replace(/_/g, " ")}</Badge> },
    { key: "is_active", label: "Active", render: (r) => <Badge size="xs" color={r.is_active ? "green" : "gray"}>{r.is_active ? "Yes" : "No"}</Badge> },
    { key: "language", label: "Lang", render: (r) => <Text size="sm">{r.language ?? "en"}</Text> },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button leftSection={<IconPlus size={16} />} onClick={() => { setForm({}); open(); }}>Add Template</Button>
      </Group>
      <DataTable columns={cols} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer opened={opened} onClose={close} title="Add Template" position="right" size="xl">
        <Stack>
          <TextInput label="Name" required value={form.template_name ?? ""} onChange={(e) => setForm({ ...form, template_name: e.currentTarget.value })} />
          <TextInput label="Code" required value={form.template_code ?? ""} onChange={(e) => setForm({ ...form, template_code: e.currentTarget.value })} />
          <Select label="Channel" required data={Object.keys(CHANNEL_COLORS)} value={form.channel ?? null} onChange={(v) => setForm({ ...form, channel: v })} />
          <Select label="Type" required data={["appointment_reminder", "lab_result", "discharge_summary", "billing", "medication_reminder", "follow_up", "generic", "marketing"]} value={form.template_type ?? null} onChange={(v) => setForm({ ...form, template_type: v })} />
          <TextInput label="Subject" value={form.subject ?? ""} onChange={(e) => setForm({ ...form, subject: e.currentTarget.value })} />
          <Textarea label="Body Template" required minRows={4} value={form.body_template ?? ""} onChange={(e) => setForm({ ...form, body_template: e.currentTarget.value })} />
          <Button onClick={() => { if (!form.template_name || !form.template_code || !form.channel || !form.template_type || !form.body_template) return; createMut.mutate(form); }} loading={createMut.isPending}>Create</Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ── Main Page ───────────────────────────────────────────
export function CommunicationsPage() {
  useRequirePermission(P.COMMUNICATIONS.MESSAGES_LIST);
  const [activeTab, setActiveTab] = useState<string | null>("messages");

  return (
    <div>
      <PageHeader title="Communication Hub" subtitle="Messages, clinical comms, alerts, complaints & feedback" />
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="messages" leftSection={<IconMail size={16} />}>Messages</Tabs.Tab>
          <Tabs.Tab value="clinical" leftSection={<IconStethoscope size={16} />}>Clinical</Tabs.Tab>
          <Tabs.Tab value="alerts" leftSection={<IconAlertTriangle size={16} />}>Alerts</Tabs.Tab>
          <Tabs.Tab value="complaints" leftSection={<IconMoodSad size={16} />}>Complaints</Tabs.Tab>
          <Tabs.Tab value="feedback" leftSection={<IconStar size={16} />}>Feedback</Tabs.Tab>
          <Tabs.Tab value="config" leftSection={<IconSettings size={16} />}>Config</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="messages" pt="md"><MessagesTab /></Tabs.Panel>
        <Tabs.Panel value="clinical" pt="md"><ClinicalTab /></Tabs.Panel>
        <Tabs.Panel value="alerts" pt="md"><AlertsTab /></Tabs.Panel>
        <Tabs.Panel value="complaints" pt="md"><ComplaintsTab /></Tabs.Panel>
        <Tabs.Panel value="feedback" pt="md"><FeedbackTab /></Tabs.Panel>
        <Tabs.Panel value="config" pt="md"><ConfigTab /></Tabs.Panel>
      </Tabs>
    </div>
  );
}

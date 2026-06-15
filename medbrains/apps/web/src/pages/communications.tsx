import {
  ActionIcon,
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
  CommChannel,
  CommClinicalMessageRow,
  CommClinicalPriority,
  CommComplaintRow,
  CommComplaintSource,
  CommCriticalAlertRow,
  CommFeedbackSurveyRow,
  CommFeedbackType,
  CommMessageRow,
  CommTemplateRow,
  CommTemplateType,
  CreateCommClinicalRequest,
  CreateCommComplaintRequest,
  CreateCommFeedbackRequest,
  CreateCommMessageRequest,
  CreateCommTemplateRequest,
  CreateDltTemplateRequest,
  DltTemplate,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconCertificate,
  IconCheck,
  IconMail,
  IconMoodSad,
  IconPlus,
  IconSettings,
  IconStar,
  IconStethoscope,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Badge, type BadgeTone, Button } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { communicationsService } from "@/services/communications.service";

const CHANNEL_COLORS: Record<string, BadgeTone> = {
  sms: "info",
  whatsapp: "success",
  email: "accent",
  push: "warning",
  ivr: "info",
  portal: "success",
};
const MSG_STATUS_COLORS: Record<string, BadgeTone> = {
  queued: "neutral",
  sent: "info",
  delivered: "success",
  failed: "danger",
  read: "success",
};
const PRIORITY_COLORS: Record<string, BadgeTone> = {
  routine: "info",
  urgent: "warning",
  critical: "danger",
  stat: "danger",
};
const ALERT_STATUS_COLORS: Record<string, BadgeTone> = {
  triggered: "danger",
  acknowledged: "info",
  escalated: "warning",
  resolved: "success",
  expired: "neutral",
};
const COMPLAINT_STATUS_COLORS: Record<string, BadgeTone> = {
  open: "danger",
  assigned: "info",
  in_progress: "warning",
  pending_review: "warning",
  resolved: "success",
  closed: "neutral",
  reopened: "danger",
};
const SEVERITY_COLORS: Record<string, BadgeTone> = {
  low: "info",
  medium: "warning",
  high: "warning",
  critical: "danger",
};
const FEEDBACK_COLORS: Record<string, BadgeTone> = {
  bedside: "success",
  post_discharge: "info",
  nps: "accent",
  department: "warning",
  kiosk: "info",
};

type MessageForm = {
  channel: string | null;
  recipient_name: string;
  recipient_contact: string;
  subject: string;
  body: string;
};

type ClinicalMessageForm = {
  recipient_id: string | null;
  message_type: string | null;
  priority: string | null;
  subject: string;
  body: string;
  is_urgent: boolean;
};

type ComplaintForm = {
  source: string | null;
  complainant_name: string;
  complainant_phone: string;
  complainant_email: string;
  category: string | null;
  severity: string | null;
  subject: string;
  description: string;
  sla_hours: number | string;
};

type FeedbackForm = {
  feedback_type: string | null;
  overall_rating: number | string;
  nps_score: number | string;
  staff_rating: number | string;
  cleanliness_rating: number | string;
  would_recommend: boolean;
  comments: string;
  suggestions: string;
  is_anonymous: boolean;
};

type TemplateForm = {
  template_name: string;
  template_code: string;
  channel: string | null;
  template_type: string | null;
  subject: string;
  body_template: string;
};

const emptyMessageForm: MessageForm = {
  channel: null,
  recipient_name: "",
  recipient_contact: "",
  subject: "",
  body: "",
};

const emptyClinicalMessageForm: ClinicalMessageForm = {
  recipient_id: null,
  message_type: null,
  priority: null,
  subject: "",
  body: "",
  is_urgent: false,
};

const emptyComplaintForm: ComplaintForm = {
  source: null,
  complainant_name: "",
  complainant_phone: "",
  complainant_email: "",
  category: null,
  severity: null,
  subject: "",
  description: "",
  sla_hours: 48,
};

const emptyFeedbackForm: FeedbackForm = {
  feedback_type: null,
  overall_rating: "",
  nps_score: "",
  staff_rating: "",
  cleanliness_rating: "",
  would_recommend: false,
  comments: "",
  suggestions: "",
  is_anonymous: false,
};

const emptyTemplateForm: TemplateForm = {
  template_name: "",
  template_code: "",
  channel: null,
  template_type: null,
  subject: "",
  body_template: "",
};

function optionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function requiredText(value: string | null | undefined) {
  return optionalText(value) ?? null;
}

function numberValue(value: number | string) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function commChannel(value: string | null | undefined): CommChannel | null {
  if (
    value === "sms" ||
    value === "whatsapp" ||
    value === "email" ||
    value === "push" ||
    value === "ivr" ||
    value === "portal"
  ) {
    return value;
  }
  return null;
}

function clinicalPriority(value: string | null | undefined): CommClinicalPriority | undefined {
  if (value === "routine" || value === "urgent" || value === "critical" || value === "stat") {
    return value;
  }
  return undefined;
}

function complaintSource(value: string | null | undefined): CommComplaintSource | null {
  if (
    value === "walk_in" ||
    value === "phone" ||
    value === "email" ||
    value === "portal" ||
    value === "kiosk" ||
    value === "social_media" ||
    value === "google_review"
  ) {
    return value;
  }
  return null;
}

function feedbackType(value: string | null | undefined): CommFeedbackType | null {
  if (
    value === "bedside" ||
    value === "post_discharge" ||
    value === "nps" ||
    value === "department" ||
    value === "kiosk"
  ) {
    return value;
  }
  return null;
}

function templateType(value: string | null | undefined): CommTemplateType | null {
  if (
    value === "appointment_reminder" ||
    value === "lab_result" ||
    value === "discharge_summary" ||
    value === "billing" ||
    value === "medication_reminder" ||
    value === "follow_up" ||
    value === "generic" ||
    value === "marketing"
  ) {
    return value;
  }
  return null;
}

function messagePayload(form: MessageForm): CreateCommMessageRequest | null {
  const channel = commChannel(form.channel);
  const recipient_contact = requiredText(form.recipient_contact);
  const body = requiredText(form.body);
  if (!channel || !recipient_contact || !body) return null;
  return {
    channel,
    recipient_contact,
    body,
    recipient_name: optionalText(form.recipient_name),
    subject: optionalText(form.subject),
  };
}

function clinicalPayload(form: ClinicalMessageForm): CreateCommClinicalRequest | null {
  const recipient_id = requiredText(form.recipient_id);
  const message_type = requiredText(form.message_type);
  const body = requiredText(form.body);
  if (!recipient_id || !message_type || !body) return null;
  return {
    recipient_id,
    message_type,
    body,
    priority: clinicalPriority(form.priority),
    subject: optionalText(form.subject),
    is_urgent: form.is_urgent,
  };
}

function complaintPayload(form: ComplaintForm): CreateCommComplaintRequest | null {
  const source = complaintSource(form.source);
  const complainant_name = requiredText(form.complainant_name);
  const subject = requiredText(form.subject);
  const description = requiredText(form.description);
  if (!source || !complainant_name || !subject || !description) return null;
  return {
    source,
    complainant_name,
    subject,
    description,
    complainant_phone: optionalText(form.complainant_phone),
    complainant_email: optionalText(form.complainant_email),
    category: optionalText(form.category),
    severity: optionalText(form.severity),
    sla_hours: numberValue(form.sla_hours),
  };
}

function feedbackPayload(form: FeedbackForm): CreateCommFeedbackRequest | null {
  const selectedFeedbackType = feedbackType(form.feedback_type);
  if (!selectedFeedbackType) return null;
  return {
    feedback_type: selectedFeedbackType,
    overall_rating: numberValue(form.overall_rating),
    nps_score: numberValue(form.nps_score),
    staff_rating: numberValue(form.staff_rating),
    cleanliness_rating: numberValue(form.cleanliness_rating),
    would_recommend: form.would_recommend,
    comments: optionalText(form.comments),
    suggestions: optionalText(form.suggestions),
    is_anonymous: form.is_anonymous,
  };
}

function templatePayload(form: TemplateForm): CreateCommTemplateRequest | null {
  const template_name = requiredText(form.template_name);
  const template_code = requiredText(form.template_code);
  const channel = commChannel(form.channel);
  const selectedTemplateType = templateType(form.template_type);
  const body_template = requiredText(form.body_template);
  if (!template_name || !template_code || !channel || !selectedTemplateType || !body_template) {
    return null;
  }
  return {
    template_name,
    template_code,
    channel,
    template_type: selectedTemplateType,
    body_template,
    subject: optionalText(form.subject),
  };
}

function dltPayload(form: Partial<CreateDltTemplateRequest>): CreateDltTemplateRequest | null {
  const template_id = requiredText(form.template_id);
  const template_name = requiredText(form.template_name);
  const sender_id = requiredText(form.sender_id);
  const entity_id = requiredText(form.entity_id);
  const body_pattern = requiredText(form.body_pattern);
  if (!template_id || !template_name || !sender_id || !entity_id || !body_pattern) return null;
  return {
    template_id,
    template_name,
    sender_id,
    entity_id,
    body_pattern,
    category: form.category ?? "transactional",
    variable_count: form.variable_count,
    scope: optionalText(form.scope),
    language: form.language ?? "en",
    registered_at: optionalText(form.registered_at),
    expires_at: optionalText(form.expires_at),
    notes: optionalText(form.notes),
  };
}

// ── Messages Tab ────────────────────────────────────────
function MessagesTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.COMMUNICATIONS.MESSAGES_CREATE);
  const [opened, { open, close }] = useDisclosure(false);
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [form, setForm] = useState<MessageForm>(emptyMessageForm);

  const { data = [], isLoading } = useQuery({
    queryKey: ["comm-messages", channelFilter, statusFilter],
    queryFn: () =>
      communicationsService.listCommMessages({
        channel: channelFilter ?? undefined,
        status: statusFilter ?? undefined,
      }),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateCommMessageRequest) => communicationsService.createCommMessage(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["comm-messages"] });
      close();
      notifications.show({ title: "Queued", message: "Message queued", color: "green" });
    },
  });

  const cols: Column<CommMessageRow>[] = [
    {
      key: "message_code",
      label: "Code",
      render: (r) => (
        <Text fw={600} size="sm">
          {r.message_code}
        </Text>
      ),
    },
    {
      key: "channel",
      label: "Channel",
      render: (r) => (
        <Badge size="sm" tone={CHANNEL_COLORS[r.channel] ?? "neutral"}>
          {r.channel}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge size="sm" tone={MSG_STATUS_COLORS[r.status] ?? "neutral"}>
          {r.status}
        </Badge>
      ),
    },
    {
      key: "recipient_name",
      label: "Recipient",
      render: (r) => <Text size="sm">{r.recipient_name ?? r.recipient_contact}</Text>,
    },
    {
      key: "body",
      label: "Body",
      render: (r) => (
        <Text size="sm" lineClamp={1}>
          {r.body}
        </Text>
      ),
    },
    {
      key: "created_at",
      label: "Created",
      render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleString()}</Text>,
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Group>
          <Select
            placeholder="Channel"
            clearable
            value={channelFilter}
            onChange={setChannelFilter}
            data={Object.keys(CHANNEL_COLORS).map((s) => ({ value: s, label: s }))}
            w={140}
          />
          <Select
            placeholder="Status"
            clearable
            value={statusFilter}
            onChange={setStatusFilter}
            data={Object.keys(MSG_STATUS_COLORS).map((s) => ({ value: s, label: s }))}
            w={140}
          />
        </Group>
        {canCreate && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setForm(emptyMessageForm);
              open();
            }}
          >
            Send Message
          </Button>
        )}
      </Group>
      <DataTable columns={cols} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer opened={opened} onClose={close} title="Send Message" position="right" size="xl">
        <Stack>
          <Select
            label="Channel"
            required
            data={Object.keys(CHANNEL_COLORS)}
            value={form.channel ?? null}
            onChange={(v) => setForm({ ...form, channel: v })}
          />
          <TextInput
            label="Recipient Name"
            value={form.recipient_name ?? ""}
            onChange={(e) => setForm({ ...form, recipient_name: e.currentTarget.value })}
          />
          <TextInput
            label="Recipient Contact"
            required
            value={form.recipient_contact ?? ""}
            onChange={(e) => setForm({ ...form, recipient_contact: e.currentTarget.value })}
          />
          <TextInput
            label="Subject"
            value={form.subject ?? ""}
            onChange={(e) => setForm({ ...form, subject: e.currentTarget.value })}
          />
          <Textarea
            label="Body"
            required
            minRows={3}
            value={form.body ?? ""}
            onChange={(e) => setForm({ ...form, body: e.currentTarget.value })}
          />
          <Button
            tone="primary"
            onClick={() => {
              const payload = messagePayload(form);
              if (!payload) return;
              createMut.mutate(payload);
            }}
            loading={createMut.isPending}
          >
            Queue Message
          </Button>
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
  const [form, setForm] = useState<ClinicalMessageForm>(emptyClinicalMessageForm);

  const { data = [], isLoading } = useQuery({
    queryKey: ["comm-clinical", priorityFilter],
    queryFn: () =>
      communicationsService.listClinicalMessages({ priority: priorityFilter ?? undefined }),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateCommClinicalRequest) => communicationsService.createClinicalMessage(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["comm-clinical"] });
      close();
      notifications.show({ title: "Sent", message: "Clinical message sent", color: "green" });
    },
  });

  const ackMut = useMutation({
    mutationFn: (id: string) => communicationsService.acknowledgeClinicalMessage(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["comm-clinical"] });
      notifications.show({ title: "Acknowledged", message: "Message acknowledged", color: "blue" });
    },
  });

  const cols: Column<CommClinicalMessageRow>[] = [
    {
      key: "message_code",
      label: "Code",
      render: (r) => (
        <Text fw={600} size="sm">
          {r.message_code}
        </Text>
      ),
    },
    {
      key: "priority",
      label: "Priority",
      render: (r) => (
        <Badge size="sm" tone={PRIORITY_COLORS[r.priority] ?? "neutral"}>
          {r.priority}
        </Badge>
      ),
    },
    {
      key: "message_type",
      label: "Type",
      render: (r) => <Badge size="sm">{r.message_type.replace(/_/g, " ")}</Badge>,
    },
    { key: "subject", label: "Subject", render: (r) => <Text size="sm">{r.subject ?? "—"}</Text> },
    {
      key: "body",
      label: "Body",
      render: (r) => (
        <Text size="sm" lineClamp={1}>
          {r.body}
        </Text>
      ),
    },
    {
      key: "is_read",
      label: "Read",
      render: (r) => (
        <Badge size="xs" tone={r.is_read ? "success" : "neutral"}>
          {r.is_read ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        !r.acknowledged_at && canAck ? (
          <ActionIcon
            variant="subtle"
            color="blue"
            size="sm"
            onClick={() => ackMut.mutate(r.id)}
            aria-label="Confirm"
          >
            <IconCheck size={14} />
          </ActionIcon>
        ) : null,
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select
          placeholder="Priority"
          clearable
          value={priorityFilter}
          onChange={setPriorityFilter}
          data={Object.keys(PRIORITY_COLORS)}
          w={140}
        />
        {canCreate && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setForm(emptyClinicalMessageForm);
              open();
            }}
          >
            New Message
          </Button>
        )}
      </Group>
      <DataTable columns={cols} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer opened={opened} onClose={close} title="Clinical Message" position="right" size="xl">
        <Stack>
          <EmployeeSearchSelect
            label="Recipient"
            value={form.recipient_id ?? ""}
            onChange={(id) => setForm({ ...form, recipient_id: id })}
            required
          />
          <Select
            label="Type"
            required
            data={["general", "sbar_handover", "referral", "discharge_comm", "intercom_code"]}
            value={form.message_type ?? null}
            onChange={(v) => setForm({ ...form, message_type: v })}
          />
          <Select
            label="Priority"
            data={Object.keys(PRIORITY_COLORS)}
            value={form.priority ?? null}
            onChange={(v) => setForm({ ...form, priority: v })}
          />
          <TextInput
            label="Subject"
            value={form.subject ?? ""}
            onChange={(e) => setForm({ ...form, subject: e.currentTarget.value })}
          />
          <Textarea
            label="Body"
            required
            minRows={3}
            value={form.body ?? ""}
            onChange={(e) => setForm({ ...form, body: e.currentTarget.value })}
          />
          <Switch
            label="Urgent"
            checked={form.is_urgent ?? false}
            onChange={(e) => setForm({ ...form, is_urgent: e.currentTarget.checked })}
          />
          <Button
            tone="primary"
            onClick={() => {
              const payload = clinicalPayload(form);
              if (!payload) return;
              createMut.mutate(payload);
            }}
            loading={createMut.isPending}
          >
            Send
          </Button>
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
    queryFn: () => communicationsService.listCommAlerts({ status: statusFilter ?? undefined }),
  });

  const ackMut = useMutation({
    mutationFn: (id: string) => communicationsService.acknowledgeCommAlert(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["comm-alerts"] });
      notifications.show({ title: "Acknowledged", message: "Alert acknowledged", color: "blue" });
    },
  });

  const resolveMut = useMutation({
    mutationFn: (id: string) => communicationsService.resolveCommAlert(id, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["comm-alerts"] });
      notifications.show({ title: "Resolved", message: "Alert resolved", color: "green" });
    },
  });

  const active = data.filter((a) => a.status === "triggered" || a.status === "acknowledged");

  const cols: Column<CommCriticalAlertRow>[] = [
    {
      key: "alert_code",
      label: "Code",
      render: (r) => (
        <Text fw={600} size="sm">
          {r.alert_code}
        </Text>
      ),
    },
    {
      key: "alert_source",
      label: "Source",
      render: (r) => <Badge size="sm">{r.alert_source}</Badge>,
    },
    {
      key: "priority",
      label: "Priority",
      render: (r) => (
        <Badge size="sm" tone={PRIORITY_COLORS[r.priority] ?? "neutral"}>
          {r.priority}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge size="sm" tone={ALERT_STATUS_COLORS[r.status] ?? "neutral"}>
          {r.status}
        </Badge>
      ),
    },
    { key: "title", label: "Title", render: (r) => <Text size="sm">{r.title}</Text> },
    {
      key: "alert_value",
      label: "Value",
      render: (r) => (
        <Text size="sm" fw={600} c="red">
          {r.alert_value ?? "—"}
        </Text>
      ),
    },
    {
      key: "normal_range",
      label: "Normal",
      render: (r) => (
        <Text size="sm" c="dimmed">
          {r.normal_range ?? "—"}
        </Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) => {
        if (!canManage) return null;
        return (
          <Group gap={4}>
            {r.status === "triggered" && (
              <Tooltip label="Acknowledge">
                <ActionIcon
                  variant="subtle"
                  color="blue"
                  size="sm"
                  onClick={() => ackMut.mutate(r.id)}
                  aria-label="Confirm"
                >
                  <IconCheck size={14} />
                </ActionIcon>
              </Tooltip>
            )}
            {(r.status === "triggered" || r.status === "acknowledged") && (
              <Tooltip label="Resolve">
                <ActionIcon
                  variant="subtle"
                  color="green"
                  size="sm"
                  onClick={() => resolveMut.mutate(r.id)}
                  aria-label="Close"
                >
                  <IconX size={14} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        );
      },
    },
  ];

  return (
    <>
      <SimpleGrid cols={{ base: 2, md: 3 }} mb="md">
        <Card withBorder>
          <Text size="xs" c="dimmed">
            Active Alerts
          </Text>
          <Text size="xl" fw={700} c="red">
            {active.length}
          </Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">
            Escalated
          </Text>
          <Text size="xl" fw={700} c="orange">
            {data.filter((a) => a.status === "escalated").length}
          </Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">
            Resolved Today
          </Text>
          <Text size="xl" fw={700} c="green">
            {data.filter((a) => a.status === "resolved").length}
          </Text>
        </Card>
      </SimpleGrid>
      <Group mb="md">
        <Select
          placeholder="Status"
          clearable
          value={statusFilter}
          onChange={setStatusFilter}
          data={Object.keys(ALERT_STATUS_COLORS)}
          w={160}
        />
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
  const [form, setForm] = useState<ComplaintForm>(emptyComplaintForm);

  const { data = [], isLoading } = useQuery({
    queryKey: ["comm-complaints", statusFilter],
    queryFn: () => communicationsService.listComplaints({ status: statusFilter ?? undefined }),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateCommComplaintRequest) => communicationsService.createComplaint(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["comm-complaints"] });
      close();
      notifications.show({ title: "Registered", message: "Complaint registered", color: "green" });
    },
  });

  const resolveMut = useMutation({
    mutationFn: (id: string) => communicationsService.resolveComplaint(id, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["comm-complaints"] });
      notifications.show({ title: "Resolved", message: "Complaint resolved", color: "green" });
    },
  });

  const cols: Column<CommComplaintRow>[] = [
    {
      key: "complaint_code",
      label: "Code",
      render: (r) => (
        <Text fw={600} size="sm">
          {r.complaint_code}
        </Text>
      ),
    },
    {
      key: "source",
      label: "Source",
      render: (r) => <Badge size="sm">{r.source.replace(/_/g, " ")}</Badge>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge size="sm" tone={COMPLAINT_STATUS_COLORS[r.status] ?? "neutral"}>
          {r.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "severity",
      label: "Severity",
      render: (r) => (
        <Badge size="sm" tone={SEVERITY_COLORS[r.severity ?? "medium"] ?? "neutral"}>
          {r.severity ?? "medium"}
        </Badge>
      ),
    },
    {
      key: "complainant_name",
      label: "Complainant",
      render: (r) => <Text size="sm">{r.complainant_name}</Text>,
    },
    {
      key: "subject",
      label: "Subject",
      render: (r) => (
        <Text size="sm" lineClamp={1}>
          {r.subject}
        </Text>
      ),
    },
    {
      key: "sla_deadline",
      label: "SLA",
      render: (r) => {
        if (!r.sla_deadline) return <Text size="sm">—</Text>;
        const remaining = (new Date(r.sla_deadline).getTime() - Date.now()) / 3600000;
        return (
          <Badge size="sm" tone={r.sla_breached ? "danger" : remaining < 4 ? "warning" : "success"}>
            {r.sla_breached ? "Breached" : `${Math.round(remaining)}h`}
          </Badge>
        );
      },
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canManage && r.status !== "resolved" && r.status !== "closed" ? (
          <Tooltip label="Resolve">
            <ActionIcon
              variant="subtle"
              color="green"
              size="sm"
              onClick={() => resolveMut.mutate(r.id)}
              aria-label="Confirm"
            >
              <IconCheck size={14} />
            </ActionIcon>
          </Tooltip>
        ) : null,
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select
          placeholder="Status"
          clearable
          value={statusFilter}
          onChange={setStatusFilter}
          data={Object.keys(COMPLAINT_STATUS_COLORS).map((s) => ({
            value: s,
            label: s.replace(/_/g, " "),
          }))}
          w={180}
        />
        {canCreate && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setForm(emptyComplaintForm);
              open();
            }}
          >
            New Complaint
          </Button>
        )}
      </Group>
      <DataTable columns={cols} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer opened={opened} onClose={close} title="Register Complaint" position="right" size="xl">
        <Stack>
          <Select
            label="Source"
            required
            data={["walk_in", "phone", "email", "portal", "kiosk", "social_media", "google_review"]}
            value={form.source ?? null}
            onChange={(v) => setForm({ ...form, source: v })}
          />
          <TextInput
            label="Complainant Name"
            required
            value={form.complainant_name ?? ""}
            onChange={(e) => setForm({ ...form, complainant_name: e.currentTarget.value })}
          />
          <TextInput
            label="Phone"
            value={form.complainant_phone ?? ""}
            onChange={(e) => setForm({ ...form, complainant_phone: e.currentTarget.value })}
          />
          <TextInput
            label="Email"
            value={form.complainant_email ?? ""}
            onChange={(e) => setForm({ ...form, complainant_email: e.currentTarget.value })}
          />
          <Select
            label="Category"
            data={[
              "clinical",
              "billing",
              "staff_behavior",
              "facilities",
              "wait_time",
              "food",
              "other",
            ]}
            value={form.category ?? null}
            onChange={(v) => setForm({ ...form, category: v })}
          />
          <Select
            label="Severity"
            data={["low", "medium", "high", "critical"]}
            value={form.severity ?? null}
            onChange={(v) => setForm({ ...form, severity: v })}
          />
          <TextInput
            label="Subject"
            required
            value={form.subject ?? ""}
            onChange={(e) => setForm({ ...form, subject: e.currentTarget.value })}
          />
          <Textarea
            label="Description"
            required
            minRows={3}
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value })}
          />
          <NumberInput
            label="SLA Hours"
            value={form.sla_hours ?? 48}
            onChange={(v) => setForm({ ...form, sla_hours: v })}
          />
          <Button
            tone="primary"
            onClick={() => {
              const payload = complaintPayload(form);
              if (!payload) return;
              createMut.mutate(payload);
            }}
            loading={createMut.isPending}
          >
            Register
          </Button>
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
  const [form, setForm] = useState<FeedbackForm>(emptyFeedbackForm);

  const { data = [], isLoading } = useQuery({
    queryKey: ["comm-feedback", typeFilter],
    queryFn: () =>
      communicationsService.listCommFeedback({ feedback_type: typeFilter ?? undefined }),
  });

  const { data: stats } = useQuery({
    queryKey: ["comm-feedback-stats", typeFilter],
    queryFn: () =>
      communicationsService.getCommFeedbackStats({ feedback_type: typeFilter ?? undefined }),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateCommFeedbackRequest) => communicationsService.createCommFeedback(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["comm-feedback"] });
      void qc.invalidateQueries({ queryKey: ["comm-feedback-stats"] });
      close();
      notifications.show({ title: "Recorded", message: "Feedback recorded", color: "green" });
    },
  });

  const cols: Column<CommFeedbackSurveyRow>[] = [
    {
      key: "feedback_code",
      label: "Code",
      render: (r) => (
        <Text fw={600} size="sm">
          {r.feedback_code}
        </Text>
      ),
    },
    {
      key: "feedback_type",
      label: "Type",
      render: (r) => (
        <Badge size="sm" tone={FEEDBACK_COLORS[r.feedback_type] ?? "neutral"}>
          {r.feedback_type.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "overall_rating",
      label: "Rating",
      render: (r) => (
        <Text size="sm" fw={600}>
          {r.overall_rating ?? "—"}/5
        </Text>
      ),
    },
    {
      key: "nps_score",
      label: "NPS",
      render: (r) => <Text size="sm">{r.nps_score ?? "—"}/10</Text>,
    },
    {
      key: "would_recommend",
      label: "Recommend",
      render: (r) =>
        r.would_recommend != null ? (
          <Badge size="xs" tone={r.would_recommend ? "success" : "danger"}>
            {r.would_recommend ? "Yes" : "No"}
          </Badge>
        ) : (
          <Text size="sm">—</Text>
        ),
    },
    {
      key: "comments",
      label: "Comments",
      render: (r) => (
        <Text size="sm" lineClamp={1}>
          {r.comments ?? "—"}
        </Text>
      ),
    },
    {
      key: "submitted_at",
      label: "Submitted",
      render: (r) => <Text size="sm">{new Date(r.submitted_at).toLocaleString()}</Text>,
    },
  ];

  return (
    <>
      <SimpleGrid cols={{ base: 2, md: 4 }} mb="md">
        <Card withBorder>
          <Text size="xs" c="dimmed">
            Total Responses
          </Text>
          <Text size="xl" fw={700}>
            {stats?.total_responses ?? 0}
          </Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">
            NPS Score
          </Text>
          <Text size="xl" fw={700} c={stats && stats.nps_score >= 50 ? "green" : "orange"}>
            {stats?.nps_score?.toFixed(0) ?? 0}
          </Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">
            Avg Rating
          </Text>
          <Text size="xl" fw={700}>
            {stats?.avg_overall?.toFixed(1) ?? 0}/5
          </Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">
            Would Recommend
          </Text>
          <Text size="xl" fw={700}>
            {stats?.would_recommend_pct?.toFixed(0) ?? 0}%
          </Text>
        </Card>
      </SimpleGrid>
      <Group justify="space-between" mb="md">
        <Select
          placeholder="Type"
          clearable
          value={typeFilter}
          onChange={setTypeFilter}
          data={Object.keys(FEEDBACK_COLORS).map((s) => ({
            value: s,
            label: s.replace(/_/g, " "),
          }))}
          w={180}
        />
        {canCreate && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setForm(emptyFeedbackForm);
              open();
            }}
          >
            Collect Feedback
          </Button>
        )}
      </Group>
      <DataTable columns={cols} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer opened={opened} onClose={close} title="Collect Feedback" position="right" size="xl">
        <Stack>
          <Select
            label="Type"
            required
            data={Object.keys(FEEDBACK_COLORS)}
            value={form.feedback_type ?? null}
            onChange={(v) => setForm({ ...form, feedback_type: v })}
          />
          <NumberInput
            label="Overall Rating (1-5)"
            min={1}
            max={5}
            value={form.overall_rating ?? ""}
            onChange={(v) => setForm({ ...form, overall_rating: v })}
          />
          <NumberInput
            label="NPS Score (0-10)"
            min={0}
            max={10}
            value={form.nps_score ?? ""}
            onChange={(v) => setForm({ ...form, nps_score: v })}
          />
          <NumberInput
            label="Staff Rating (1-5)"
            min={1}
            max={5}
            value={form.staff_rating ?? ""}
            onChange={(v) => setForm({ ...form, staff_rating: v })}
          />
          <NumberInput
            label="Cleanliness (1-5)"
            min={1}
            max={5}
            value={form.cleanliness_rating ?? ""}
            onChange={(v) => setForm({ ...form, cleanliness_rating: v })}
          />
          <Switch
            label="Would Recommend"
            checked={form.would_recommend ?? false}
            onChange={(e) => setForm({ ...form, would_recommend: e.currentTarget.checked })}
          />
          <Textarea
            label="Comments"
            value={form.comments ?? ""}
            onChange={(e) => setForm({ ...form, comments: e.currentTarget.value })}
          />
          <Textarea
            label="Suggestions"
            value={form.suggestions ?? ""}
            onChange={(e) => setForm({ ...form, suggestions: e.currentTarget.value })}
          />
          <Switch
            label="Anonymous"
            checked={form.is_anonymous ?? false}
            onChange={(e) => setForm({ ...form, is_anonymous: e.currentTarget.checked })}
          />
          <Button
            tone="primary"
            onClick={() => {
              const payload = feedbackPayload(form);
              if (!payload) return;
              createMut.mutate(payload);
            }}
            loading={createMut.isPending}
          >
            Submit
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ── Config Tab ──────────────────────────────────────────
function ConfigTab() {
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<TemplateForm>(emptyTemplateForm);

  const { data = [], isLoading } = useQuery({
    queryKey: ["comm-templates"],
    queryFn: () => communicationsService.listCommTemplates(),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateCommTemplateRequest) => communicationsService.createCommTemplate(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["comm-templates"] });
      close();
      notifications.show({ title: "Created", message: "Template created", color: "green" });
    },
  });

  const cols: Column<CommTemplateRow>[] = [
    {
      key: "template_name",
      label: "Name",
      render: (r) => (
        <Text fw={600} size="sm">
          {r.template_name}
        </Text>
      ),
    },
    {
      key: "template_code",
      label: "Code",
      render: (r) => (
        <Text size="sm" c="dimmed">
          {r.template_code}
        </Text>
      ),
    },
    {
      key: "channel",
      label: "Channel",
      render: (r) => (
        <Badge size="sm" tone={CHANNEL_COLORS[r.channel] ?? "neutral"}>
          {r.channel}
        </Badge>
      ),
    },
    {
      key: "template_type",
      label: "Type",
      render: (r) => <Badge size="sm">{r.template_type.replace(/_/g, " ")}</Badge>,
    },
    {
      key: "is_active",
      label: "Active",
      render: (r) => (
        <Badge size="xs" tone={r.is_active ? "success" : "neutral"}>
          {r.is_active ? "Yes" : "No"}
        </Badge>
      ),
    },
    { key: "language", label: "Lang", render: (r) => <Text size="sm">{r.language ?? "en"}</Text> },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button
          tone="primary"
          leftSection={<IconPlus size={16} />}
          onClick={() => {
            setForm(emptyTemplateForm);
            open();
          }}
        >
          Add Template
        </Button>
      </Group>
      <DataTable columns={cols} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer opened={opened} onClose={close} title="Add Template" position="right" size="xl">
        <Stack>
          <TextInput
            label="Name"
            required
            value={form.template_name ?? ""}
            onChange={(e) => setForm({ ...form, template_name: e.currentTarget.value })}
          />
          <TextInput
            label="Code"
            required
            value={form.template_code ?? ""}
            onChange={(e) => setForm({ ...form, template_code: e.currentTarget.value })}
          />
          <Select
            label="Channel"
            required
            data={Object.keys(CHANNEL_COLORS)}
            value={form.channel ?? null}
            onChange={(v) => setForm({ ...form, channel: v })}
          />
          <Select
            label="Type"
            required
            data={[
              "appointment_reminder",
              "lab_result",
              "discharge_summary",
              "billing",
              "medication_reminder",
              "follow_up",
              "generic",
              "marketing",
            ]}
            value={form.template_type ?? null}
            onChange={(v) => setForm({ ...form, template_type: v })}
          />
          <TextInput
            label="Subject"
            value={form.subject ?? ""}
            onChange={(e) => setForm({ ...form, subject: e.currentTarget.value })}
          />
          <Textarea
            label="Body Template"
            required
            minRows={4}
            value={form.body_template ?? ""}
            onChange={(e) => setForm({ ...form, body_template: e.currentTarget.value })}
          />
          <Button
            tone="primary"
            onClick={() => {
              const payload = templatePayload(form);
              if (!payload) return;
              createMut.mutate(payload);
            }}
            loading={createMut.isPending}
          >
            Create
          </Button>
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
      <PageHeader
        title="Communication Hub"
        subtitle="Messages, clinical comms, alerts, complaints & feedback"
      />
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="messages" leftSection={<IconMail size={16} />}>
            Messages
          </Tabs.Tab>
          <Tabs.Tab value="clinical" leftSection={<IconStethoscope size={16} />}>
            Clinical
          </Tabs.Tab>
          <Tabs.Tab value="alerts" leftSection={<IconAlertTriangle size={16} />}>
            Alerts
          </Tabs.Tab>
          <Tabs.Tab value="complaints" leftSection={<IconMoodSad size={16} />}>
            Complaints
          </Tabs.Tab>
          <Tabs.Tab value="feedback" leftSection={<IconStar size={16} />}>
            Feedback
          </Tabs.Tab>
          <Tabs.Tab value="dlt" leftSection={<IconCertificate size={16} />}>
            DLT
          </Tabs.Tab>
          <Tabs.Tab value="config" leftSection={<IconSettings size={16} />}>
            Config
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="messages" pt="md">
          <MessagesTab />
        </Tabs.Panel>
        <Tabs.Panel value="clinical" pt="md">
          <ClinicalTab />
        </Tabs.Panel>
        <Tabs.Panel value="alerts" pt="md">
          <AlertsTab />
        </Tabs.Panel>
        <Tabs.Panel value="complaints" pt="md">
          <ComplaintsTab />
        </Tabs.Panel>
        <Tabs.Panel value="feedback" pt="md">
          <FeedbackTab />
        </Tabs.Panel>
        <Tabs.Panel value="dlt" pt="md">
          <DltTab />
        </Tabs.Panel>
        <Tabs.Panel value="config" pt="md">
          <ConfigTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

function DltTab() {
  const qc = useQueryClient();
  const canManage = useHasPermission("communications.dlt.manage");
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<Partial<CreateDltTemplateRequest>>({
    category: "transactional",
    language: "en",
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["dlt-templates"],
    queryFn: () => communicationsService.listDltTemplates(),
  });

  const createMut = useMutation({
    mutationFn: (data: CreateDltTemplateRequest) => communicationsService.createDltTemplate(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["dlt-templates"] });
      close();
      setForm({ category: "transactional", language: "en" });
      notifications.show({ title: "Registered", message: "DLT template added", color: "green" });
    },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      communicationsService.updateDltTemplate(id, { is_active }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["dlt-templates"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => communicationsService.deleteDltTemplate(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["dlt-templates"] }),
  });

  const cols: Column<DltTemplate>[] = [
    {
      key: "scope",
      label: "Scope",
      render: (r) => (
        <Text ff="monospace" size="xs">
          {r.scope ?? "—"}
        </Text>
      ),
    },
    {
      key: "template_id",
      label: "DLT ID",
      render: (r) => (
        <Text ff="monospace" size="xs">
          {r.template_id}
        </Text>
      ),
    },
    {
      key: "template_name",
      label: "Name",
      render: (r) => <Text size="sm">{r.template_name}</Text>,
    },
    {
      key: "sender_id",
      label: "Sender",
      render: (r) => <Badge>{r.sender_id}</Badge>,
    },
    {
      key: "category",
      label: "Category",
      render: (r) => <Badge size="sm">{r.category}</Badge>,
    },
    { key: "language", label: "Lang", render: (r) => <Text size="xs">{r.language}</Text> },
    {
      key: "expires_at",
      label: "Expires",
      render: (r) => (
        <Text size="xs" c={r.expires_at && new Date(r.expires_at) < new Date() ? "red" : undefined}>
          {r.expires_at ?? "—"}
        </Text>
      ),
    },
    {
      key: "is_active",
      label: "Active",
      render: (r) =>
        canManage ? (
          <Switch
            checked={r.is_active}
            onChange={(e) => toggleMut.mutate({ id: r.id, is_active: e.currentTarget.checked })}
          />
        ) : (
          <Badge tone={r.is_active ? "success" : "neutral"}>
            {r.is_active ? "Active" : "Inactive"}
          </Badge>
        ),
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canManage ? (
          <Tooltip label="Delete">
            <ActionIcon
              color="red"
              variant="subtle"
              size="sm"
              onClick={() => deleteMut.mutate(r.id)}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        ) : null,
    },
  ];

  return (
    <Stack>
      <Card withBorder padding="sm" radius="md">
        <Text size="sm" c="dimmed">
          India SMS regulation (TRAI TCCCPR 2018): every commercial / transactional SMS must use a
          registered DLT template. The SMS dispatcher refuses to send when{" "}
          <code>DLT_ENFORCE=true</code> and no active template matches the event scope. Register one
          row per <strong>scope × language</strong>.
        </Text>
      </Card>
      {canManage && (
        <Group>
          <Button tone="primary" leftSection={<IconPlus size={14} />} onClick={open}>
            Register Template
          </Button>
        </Group>
      )}
      <DataTable columns={cols} data={rows} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer
        opened={opened}
        onClose={close}
        title="Register DLT Template"
        position="right"
        size="md"
      >
        <Stack>
          <TextInput
            label="DLT Template ID"
            description="Issued by your DLT registrar (Jio/Airtel/VI/BSNL portal)"
            required
            value={form.template_id ?? ""}
            onChange={(e) => setForm({ ...form, template_id: e.currentTarget.value })}
          />
          <TextInput
            label="Template Name"
            required
            value={form.template_name ?? ""}
            onChange={(e) => setForm({ ...form, template_name: e.currentTarget.value })}
          />
          <Group grow>
            <Select
              label="Category"
              data={[
                { value: "transactional", label: "Transactional" },
                { value: "service_implicit", label: "Service Implicit" },
                { value: "service_explicit", label: "Service Explicit" },
                { value: "promotional", label: "Promotional" },
              ]}
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v ?? "transactional" })}
            />
            <Select
              label="Language"
              data={[
                { value: "en", label: "English" },
                { value: "hi", label: "Hindi" },
                { value: "ta", label: "Tamil" },
                { value: "te", label: "Telugu" },
                { value: "ml", label: "Malayalam" },
                { value: "kn", label: "Kannada" },
                { value: "mr", label: "Marathi" },
                { value: "bn", label: "Bengali" },
                { value: "gu", label: "Gujarati" },
              ]}
              value={form.language ?? "en"}
              onChange={(v) => setForm({ ...form, language: v ?? "en" })}
            />
          </Group>
          <Group grow>
            <TextInput
              label="Sender ID (Header)"
              placeholder="MEDBRN"
              required
              value={form.sender_id ?? ""}
              onChange={(e) => setForm({ ...form, sender_id: e.currentTarget.value.toUpperCase() })}
            />
            <TextInput
              label="Entity ID (PE)"
              required
              value={form.entity_id ?? ""}
              onChange={(e) => setForm({ ...form, entity_id: e.currentTarget.value })}
            />
          </Group>
          <TextInput
            label="Event Scope"
            description="Internal hook, e.g. sms.appointment_confirmation"
            placeholder="sms.appointment_confirmation"
            value={form.scope ?? ""}
            onChange={(e) => setForm({ ...form, scope: e.currentTarget.value })}
          />
          <Textarea
            label="Body Pattern"
            description="With {#var#} placeholders — must match registered DLT body byte-for-byte"
            required
            minRows={4}
            value={form.body_pattern ?? ""}
            onChange={(e) => setForm({ ...form, body_pattern: e.currentTarget.value })}
          />
          <NumberInput
            label="Variable count"
            min={0}
            max={20}
            value={form.variable_count ?? 0}
            onChange={(v) => setForm({ ...form, variable_count: Number(v) || 0 })}
          />
          <SimpleGrid cols={2}>
            <TextInput
              type="date"
              label="Registered on"
              value={form.registered_at ?? ""}
              onChange={(e) =>
                setForm({ ...form, registered_at: e.currentTarget.value || undefined })
              }
            />
            <TextInput
              type="date"
              label="Expires on"
              value={form.expires_at ?? ""}
              onChange={(e) => setForm({ ...form, expires_at: e.currentTarget.value || undefined })}
            />
          </SimpleGrid>
          <Textarea
            label="Notes"
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })}
          />
          <Group justify="flex-end">
            <Button tone="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              tone="primary"
              leftSection={<IconCheck size={14} />}
              loading={createMut.isPending}
              disabled={
                !form.template_id ||
                !form.template_name ||
                !form.body_pattern ||
                !form.sender_id ||
                !form.entity_id
              }
              onClick={() => {
                const payload = dltPayload(form);
                if (!payload) return;
                createMut.mutate(payload);
              }}
            >
              Register
            </Button>
          </Group>
        </Stack>
      </Drawer>
    </Stack>
  );
}

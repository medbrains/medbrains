import {
  Card,
  Drawer,
  Group,
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
  CommCriticalAlertRow,
  CommMessageRow,
  CommTemplateRow,
  CommTemplateType,
  CreateCommClinicalRequest,
  CreateCommMessageRequest,
  CreateCommTemplateRequest,
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
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { communicationsService } from "@/services/communications.service";
import { ComplaintsTab } from "./communications/complaints-tab";
import { DltTab } from "./communications/dlt-tab";
import { FeedbackTab } from "./communications/feedback-tab";
import { optionalText, requiredText } from "./communications/shared";

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

const emptyTemplateForm: TemplateForm = {
  template_name: "",
  template_code: "",
  channel: null,
  template_type: null,
  subject: "",
  body_template: "",
};

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
          <IconButton
            tone="primary"
            size="sm"
            onClick={() => ackMut.mutate(r.id)}
            aria-label="Confirm"
          >
            <IconCheck size={14} />
          </IconButton>
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
                <IconButton
                  tone="primary"
                  size="sm"
                  onClick={() => ackMut.mutate(r.id)}
                  aria-label="Confirm"
                >
                  <IconCheck size={14} />
                </IconButton>
              </Tooltip>
            )}
            {(r.status === "triggered" || r.status === "acknowledged") && (
              <Tooltip label="Resolve">
                <IconButton
                  tone="success"
                  size="sm"
                  onClick={() => resolveMut.mutate(r.id)}
                  aria-label="Close"
                >
                  <IconX size={14} />
                </IconButton>
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

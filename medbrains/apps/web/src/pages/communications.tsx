import { Drawer, Group, Select, Stack, Tabs, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type {
  CommTemplateRow,
  CommTemplateType,
  CreateCommTemplateRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconCertificate,
  IconMail,
  IconMoodSad,
  IconPlus,
  IconSettings,
  IconStar,
  IconStethoscope,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { communicationsService } from "@/services/communications.service";
import { AlertsTab } from "./communications/alerts-tab";
import { ClinicalTab } from "./communications/clinical-tab";
import { ComplaintsTab } from "./communications/complaints-tab";
import { DltTab } from "./communications/dlt-tab";
import { FeedbackTab } from "./communications/feedback-tab";
import { MessagesTab } from "./communications/messages-tab";
import { CHANNEL_COLORS, commChannel, optionalText, requiredText } from "./communications/shared";

type TemplateForm = {
  template_name: string;
  template_code: string;
  channel: string | null;
  template_type: string | null;
  subject: string;
  body_template: string;
};

const emptyTemplateForm: TemplateForm = {
  template_name: "",
  template_code: "",
  channel: null,
  template_type: null,
  subject: "",
  body_template: "",
};

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

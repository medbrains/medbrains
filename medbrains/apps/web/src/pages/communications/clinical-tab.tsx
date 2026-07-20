// IPD ClinicalTab — split from communications.tsx (pure move).

import { Drawer, Group, Select, Stack, Switch, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  CommClinicalMessageRow,
  CommClinicalPriority,
  CreateCommClinicalRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Badge, Button, IconButton } from "@/components/ui";
import { communicationsService } from "@/services/communications.service";
import { optionalText, PRIORITY_COLORS, requiredText } from "./shared";

function clinicalPriority(value: string | null | undefined): CommClinicalPriority | undefined {
  if (value === "routine" || value === "urgent" || value === "critical" || value === "stat") {
    return value;
  }
  return undefined;
}

type ClinicalMessageForm = {
  recipient_id: string | null;
  message_type: string | null;
  priority: string | null;
  subject: string;
  body: string;
  is_urgent: boolean;
};

const emptyClinicalMessageForm: ClinicalMessageForm = {
  recipient_id: null,
  message_type: null,
  priority: null,
  subject: "",
  body: "",
  is_urgent: false,
};

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

export function ClinicalTab() {
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

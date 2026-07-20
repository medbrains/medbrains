// Communications MessagesTab — split from communications.tsx (pure move).

import { Drawer, Group, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { CommMessageRow, CreateCommMessageRequest } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone, Button } from "@/components/ui";
import { communicationsService } from "@/services/communications.service";
import { CHANNEL_COLORS, commChannel, optionalText, requiredText } from "./shared";

const MSG_STATUS_COLORS: Record<string, BadgeTone> = {
  queued: "neutral",
  sent: "info",
  delivered: "success",
  failed: "danger",
  read: "success",
};

type MessageForm = {
  channel: string | null;
  recipient_name: string;
  recipient_contact: string;
  subject: string;
  body: string;
};

const emptyMessageForm: MessageForm = {
  channel: null,
  recipient_name: "",
  recipient_contact: "",
  subject: "",
  body: "",
};

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

export function MessagesTab() {
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

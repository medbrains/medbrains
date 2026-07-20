// IPD DltTab — split from communications.tsx (pure move).

import {
  Card,
  Drawer,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { CreateDltTemplateRequest, DltTemplate } from "@medbrains/types";
import { IconCheck, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button, IconButton } from "@/components/ui";
import { confirmDestructive } from "@/lib/confirm";
import { communicationsService } from "@/services/communications.service";
import { optionalText, requiredText } from "./shared";

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

export function DltTab() {
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
            <IconButton
              tone="danger"
              size="sm"
              onClick={() =>
                confirmDestructive({
                  title: "Delete",
                  message: "Permanently delete this record? This cannot be undone.",
                  onConfirm: () => deleteMut.mutate(r.id),
                })
              }
              aria-label="Delete"
            >
              <IconTrash size={14} />
            </IconButton>
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

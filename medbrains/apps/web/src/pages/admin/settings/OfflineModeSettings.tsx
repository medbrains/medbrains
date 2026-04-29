/**
 * OfflineModeSettings — admin tab to flip the tenant into offline-
 * tolerant mode and point browsers at a medbrains-edge appliance on
 * the hospital LAN.
 *
 * Reads/writes two keys under tenant_settings.clinical:
 *   offline_mode (boolean)  — flips TenantConfigProvider's mode to "crdt"
 *   edge_url     (string)   — ws://medbrains-edge.local:7811 etc.
 *
 * No backend allowlist is needed: the generic update_setting handler
 * accepts arbitrary category+key pairs (the secure device-settings
 * endpoint has its own allowlist; we don't go through it).
 *
 * Saved values propagate to TenantConfigProvider after its
 * tenant-settings query refetches (5min staleTime). Helper text
 * tells the operator a hard reload triggers the change immediately.
 */

import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Code,
  Group,
  Loader,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertCircle,
  IconCheck,
  IconCloudOff,
  IconDeviceFloppy,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { TenantSettingsRow } from "@medbrains/types";

interface OfflineModeForm {
  offlineMode: boolean;
  edgeUrl: string;
}

function parseSettings(rows: TenantSettingsRow[]): OfflineModeForm {
  const off = rows.find((r) => r.key === "offline_mode");
  const url = rows.find((r) => r.key === "edge_url");
  return {
    offlineMode:
      typeof off?.value === "boolean"
        ? off.value
        : off?.value === "true" || off?.value === "1",
    edgeUrl: typeof url?.value === "string" ? url.value : "",
  };
}

function isPlausibleWsUrl(value: string): boolean {
  if (!value) return true; // empty is fine when offline mode is off
  return value.startsWith("ws://") || value.startsWith("wss://");
}

export function OfflineModeSettings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<OfflineModeForm | null>(null);

  const { data: rows, isLoading, isError, error } = useQuery({
    queryKey: ["tenant-settings", "clinical"],
    queryFn: () => api.getTenantSettings("clinical"),
    select: (data: TenantSettingsRow[]) => {
      if (form === null) setForm(parseSettings(data));
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: OfflineModeForm) => {
      const original = parseSettings(rows ?? []);
      const updates: { key: string; value: unknown }[] = [];
      if (values.offlineMode !== original.offlineMode) {
        updates.push({ key: "offline_mode", value: values.offlineMode });
      }
      if (values.edgeUrl !== original.edgeUrl) {
        updates.push({ key: "edge_url", value: values.edgeUrl });
      }
      for (const u of updates) {
        await api.updateTenantSetting({
          category: "clinical",
          key: u.key,
          value: u.value,
        });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["tenant-settings", "clinical"],
      });
      notifications.show({
        title: "Offline mode saved",
        message:
          "Hard-reload (Cmd-R) any open tabs to pick up the new mode immediately.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Save failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading settings…</Text>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Stack align="center" py="xl">
        <Text c="danger">
          Failed to load: {error instanceof Error ? error.message : "unknown"}
        </Text>
      </Stack>
    );
  }

  if (!form) return null;

  const setField = <K extends keyof OfflineModeForm>(
    k: K,
    v: OfflineModeForm[K],
  ) => setForm((p) => (p ? { ...p, [k]: v } : p));

  const offlineWithoutUrl = form.offlineMode && form.edgeUrl.trim() === "";
  const malformedUrl = form.edgeUrl !== "" && !isPlausibleWsUrl(form.edgeUrl);

  return (
    <Stack gap="lg" maw={720}>
      <Group gap="xs">
        <IconCloudOff size={20} />
        <Text fw={600} size="lg">
          Offline-tolerant mode
        </Text>
      </Group>

      <Text c="dimmed" size="sm">
        When enabled, supported clinical pages (vitals, handoff, triage, notes,
        nursing notes) sync via the on-prem <Code>medbrains-edge</Code>{" "}
        appliance over the hospital LAN. Devices keep capturing data while the
        WAN is down; entries merge automatically when connectivity returns.
      </Text>

      <Card withBorder>
        <Stack gap="sm">
          <Switch
            label="Enable offline-tolerant mode"
            description="Flips the data layer for participating pages from cloud REST to LAN CRDT. Other pages (billing, prescriptions, admin) stay on cloud REST regardless."
            checked={form.offlineMode}
            onChange={(e) => setField("offlineMode", e.currentTarget.checked)}
          />
        </Stack>
      </Card>

      <Card withBorder>
        <Stack gap="sm">
          <TextInput
            label="Edge appliance URL"
            description="Browsers connect here for LAN sync. WebSocket scheme (ws:// or wss://). Required when offline mode is enabled."
            placeholder="ws://medbrains-edge.local:7811"
            value={form.edgeUrl}
            onChange={(e) => setField("edgeUrl", e.currentTarget.value.trim())}
          />
          {malformedUrl && (
            <Alert
              color="orange"
              icon={<IconAlertCircle size={16} />}
              title="Unusual URL"
            >
              Edge URLs typically start with <Code>ws://</Code> or{" "}
              <Code>wss://</Code>. Saving anyway — browsers will fail to connect
              if the scheme is wrong.
            </Alert>
          )}
        </Stack>
      </Card>

      {offlineWithoutUrl && (
        <Alert
          color="orange"
          icon={<IconAlertCircle size={16} />}
          title="Edge URL missing"
        >
          Offline mode is on but no edge URL is configured. The app will fall
          back to cloud REST and log a warning in the browser console. Set the
          URL above before relying on offline behavior.
        </Alert>
      )}

      <Group>
        <Button
          leftSection={<IconDeviceFloppy size={16} />}
          loading={mutation.isPending}
          onClick={() => form && mutation.mutate(form)}
        >
          Save
        </Button>
      </Group>
    </Stack>
  );
}

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

import { zodResolver } from "@hookform/resolvers/zod";
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
  type OfflineModeSettingsFormInput,
  offlineModeSettingsFormSchema,
} from "@medbrains/schemas";
import type { TenantSettingsRow } from "@medbrains/types";
import { IconAlertCircle, IconCheck, IconCloudOff, IconDeviceFloppy } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { tenantSettingsService } from "../../../services/tenantSettings.service";

const EMPTY_FORM: OfflineModeSettingsFormInput = {
  offlineMode: false,
  edgeUrl: "",
};

function parseSettings(rows: TenantSettingsRow[]): OfflineModeSettingsFormInput {
  const off = rows.find((r) => r.key === "offline_mode");
  const url = rows.find((r) => r.key === "edge_url");
  return {
    offlineMode:
      typeof off?.value === "boolean" ? off.value : off?.value === "true" || off?.value === "1",
    edgeUrl: typeof url?.value === "string" ? url.value : "",
  };
}

type OfflineModeSettingUpdate = {
  key: string;
  value: unknown;
};

type OfflineModeSettingsPayload = {
  offlineMode: boolean;
  edgeUrl: string;
};

export function OfflineModeSettings() {
  const queryClient = useQueryClient();

  const {
    data: rows,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["tenant-settings", "clinical"],
    queryFn: () => tenantSettingsService.getTenantSettings("clinical"),
  });
  const formValues = useMemo(() => (rows ? parseSettings(rows) : EMPTY_FORM), [rows]);
  const {
    control,
    formState: { errors },
    handleSubmit,
    watch,
  } = useForm<OfflineModeSettingsFormInput>({
    resolver: zodResolver(offlineModeSettingsFormSchema),
    defaultValues: EMPTY_FORM,
    values: formValues,
  });

  const mutation = useMutation({
    mutationFn: async (values: OfflineModeSettingsPayload) => {
      const original = parseSettings(rows ?? []);
      const updates: OfflineModeSettingUpdate[] = [];
      if (values.offlineMode !== original.offlineMode) {
        updates.push({ key: "offline_mode", value: values.offlineMode });
      }
      if (values.edgeUrl !== original.edgeUrl) {
        updates.push({ key: "edge_url", value: values.edgeUrl });
      }
      for (const u of updates) {
        await tenantSettingsService.updateTenantSetting({
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
        message: "Hard-reload (Cmd-R) any open tabs to pick up the new mode immediately.",
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
  const submitOfflineSettings = handleSubmit((values) => {
    mutation.mutate({
      offlineMode: values.offlineMode,
      edgeUrl: values.edgeUrl.trim(),
    });
  });
  const offlineMode = watch("offlineMode");
  const edgeUrl = watch("edgeUrl");

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
        <Text c="danger">Failed to load: {error instanceof Error ? error.message : "unknown"}</Text>
      </Stack>
    );
  }

  if (!rows) return null;

  const offlineWithoutUrl = offlineMode && edgeUrl.trim() === "";

  return (
    <Stack gap="lg" maw={720}>
      <Group gap="xs">
        <IconCloudOff size={20} />
        <Text fw={600} size="lg">
          Offline-tolerant mode
        </Text>
      </Group>

      <Text c="dimmed" size="sm">
        When enabled, supported clinical pages (vitals, handoff, triage, notes, nursing notes) sync
        via the on-prem <Code>medbrains-edge</Code> appliance over the hospital LAN. Devices keep
        capturing data while the WAN is down; entries merge automatically when connectivity returns.
      </Text>

      <Card withBorder>
        <Stack gap="sm">
          <Controller
            control={control}
            name="offlineMode"
            render={({ field }) => (
              <Switch
                label="Enable offline-tolerant mode"
                description="Flips the data layer for participating pages from cloud REST to LAN CRDT. Other pages (billing, prescriptions, admin) stay on cloud REST regardless."
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
        </Stack>
      </Card>

      <Card withBorder>
        <Stack gap="sm">
          <Controller
            control={control}
            name="edgeUrl"
            render={({ field }) => (
              <TextInput
                label="Edge appliance URL"
                description="Browsers connect here for LAN sync. WebSocket scheme (ws:// or wss://). Required when offline mode is enabled."
                placeholder="ws://medbrains-edge.local:7811"
                value={field.value}
                onChange={(event) => field.onChange(event.currentTarget.value)}
                error={errors.edgeUrl?.message}
              />
            )}
          />
        </Stack>
      </Card>

      {offlineWithoutUrl && (
        <Alert color="orange" icon={<IconAlertCircle size={16} />} title="Edge URL missing">
          Offline mode is on but no edge URL is configured. The app will fall back to cloud REST and
          log a warning in the browser console. Set the URL above before relying on offline
          behavior.
        </Alert>
      )}

      <Group>
        <Button
          leftSection={<IconDeviceFloppy size={16} />}
          loading={mutation.isPending}
          onClick={() => void submitOfflineSettings()}
        >
          Save
        </Button>
      </Group>
    </Stack>
  );
}

import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  NumberInput,
  PasswordInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  SecureDeviceSettingsKey,
  SecureTenantSettingRow,
  UpdateSecureDeviceSettingRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconDeviceFloppy, IconLock, IconPlugConnected } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

type ConnectorField =
  | {
      key: string;
      label: string;
      description: string;
      type: "text" | "password";
    }
  | {
      key: string;
      label: string;
      description: string;
      type: "number";
    }
  | {
      key: string;
      label: string;
      description: string;
      type: "switch";
    }
  | {
      key: string;
      label: string;
      description: string;
      type: "select";
      options: { value: string; label: string }[];
    };

interface ConnectorDefinition {
  key: SecureDeviceSettingsKey;
  title: string;
  description: string;
  fallback: string;
  fields: ConnectorField[];
}

const CONNECTOR_DEFINITIONS: ConnectorDefinition[] = [
  {
    key: "pacs_dicom",
    title: "PACS / DICOM",
    description: "Use this for CT, MRI, X-ray, ultrasound, and modality worklist connections.",
    fallback: "Fallback: manual report workflow plus DICOM file upload/import queue.",
    fields: [
      {
        key: "enabled",
        label: "Enabled",
        description: "Allow this connector to be used by radiology workflows.",
        type: "switch",
      },
      {
        key: "host",
        label: "PACS Host",
        description: "Remote PACS or gateway hostname/IP.",
        type: "text",
      },
      { key: "port", label: "Port", description: "DICOM listener port.", type: "number" },
      {
        key: "local_ae_title",
        label: "Local AE Title",
        description: "AE title presented by MedBrains/gateway.",
        type: "text",
      },
      {
        key: "remote_ae_title",
        label: "Remote AE Title",
        description: "PACS or modality AE title.",
        type: "text",
      },
      {
        key: "username",
        label: "Username",
        description: "Optional operator or gateway username.",
        type: "text",
      },
      {
        key: "password",
        label: "Password / Secret",
        description: "Stored securely and always masked after save.",
        type: "password",
      },
      {
        key: "worklist_enabled",
        label: "Modality Worklist",
        description: "Expose scheduled studies to modalities via worklist.",
        type: "switch",
      },
    ],
  },
  {
    key: "lab_interface",
    title: "Lab Interface",
    description: "Common configuration for analyzer gateways and HL7/ASTM result feeds.",
    fallback: "Fallback: CSV/manual result entry with verification queue.",
    fields: [
      {
        key: "enabled",
        label: "Enabled",
        description: "Allow analyzer connectivity for lab workflows.",
        type: "switch",
      },
      {
        key: "protocol",
        label: "Protocol",
        description: "Primary lab communication method.",
        type: "select",
        options: [
          { value: "hl7", label: "HL7 v2" },
          { value: "astm", label: "ASTM" },
          { value: "file_drop", label: "File Drop" },
        ],
      },
      {
        key: "host",
        label: "Gateway Host",
        description: "Lab gateway or listener hostname/IP.",
        type: "text",
      },
      {
        key: "port",
        label: "Port",
        description: "Gateway/listener port when used.",
        type: "number",
      },
      {
        key: "analyzer_code",
        label: "Analyzer Code",
        description: "Code used to route incoming orders/results.",
        type: "text",
      },
      {
        key: "username",
        label: "Username",
        description: "Optional integration account username.",
        type: "text",
      },
      {
        key: "password",
        label: "Password / Secret",
        description: "Stored securely and always masked after save.",
        type: "password",
      },
    ],
  },
  {
    key: "biometric",
    title: "Biometric / Access Device",
    description: "Shared config for fingerprint, iris, and local vendor capture services.",
    fallback: "Fallback: OTP, PIN, or manual staff override with audit.",
    fields: [
      {
        key: "enabled",
        label: "Enabled",
        description: "Allow biometric capture or lookup in supported workflows.",
        type: "switch",
      },
      { key: "vendor", label: "Vendor", description: "Reader or SDK vendor name.", type: "text" },
      {
        key: "service_url",
        label: "Service URL",
        description: "Local RD service or vendor agent endpoint.",
        type: "text",
      },
      {
        key: "device_id",
        label: "Device ID",
        description: "Unique local device or station identifier.",
        type: "text",
      },
      {
        key: "api_key",
        label: "API Key / Secret",
        description: "Stored securely and always masked after save.",
        type: "password",
      },
    ],
  },
  {
    key: "printing",
    title: "Print Agent / Label Devices",
    description: "Use this for browser print agents, wristband printers, and label routing.",
    fallback: "Fallback: PDF download, browser print, or central print station.",
    fields: [
      {
        key: "enabled",
        label: "Enabled",
        description: "Allow managed printing for supported templates.",
        type: "switch",
      },
      {
        key: "agent_url",
        label: "Print Agent URL",
        description: "Local print agent or spooler endpoint.",
        type: "text",
      },
      {
        key: "default_printer",
        label: "Default Printer",
        description: "A4 or main operational printer profile.",
        type: "text",
      },
      {
        key: "label_printer",
        label: "Label / Wristband Printer",
        description: "Dedicated label printer profile.",
        type: "text",
      },
      {
        key: "api_key",
        label: "API Key / Secret",
        description: "Stored securely and always masked after save.",
        type: "password",
      },
    ],
  },
  {
    key: "queue_display",
    title: "Queue / Display Client",
    description:
      "Common config for queue boards, signage monitors, and location-bound display clients.",
    fallback: "Fallback: browser tab or nurse-station monitor using the same feed.",
    fields: [
      {
        key: "enabled",
        label: "Enabled",
        description: "Allow managed display binding for queue/TV clients.",
        type: "switch",
      },
      {
        key: "display_client_url",
        label: "Display Client URL",
        description: "Client/player endpoint or local receiver URL.",
        type: "text",
      },
      {
        key: "location_code",
        label: "Location Code",
        description: "Department, desk, or ward binding code.",
        type: "text",
      },
      {
        key: "websocket_channel",
        label: "WebSocket Channel",
        description: "Live event channel or topic for this display.",
        type: "text",
      },
      {
        key: "api_key",
        label: "API Key / Secret",
        description: "Stored securely and always masked after save.",
        type: "password",
      },
    ],
  },
];

const DEFAULT_CONFIGS: Record<SecureDeviceSettingsKey, Record<string, unknown>> = {
  pacs_dicom: {
    enabled: false,
    host: "",
    port: 104,
    local_ae_title: "",
    remote_ae_title: "",
    username: "",
    password: "",
    worklist_enabled: false,
  },
  lab_interface: {
    enabled: false,
    protocol: "hl7",
    host: "",
    port: 2575,
    analyzer_code: "",
    username: "",
    password: "",
  },
  biometric: {
    enabled: false,
    vendor: "",
    service_url: "",
    device_id: "",
    api_key: "",
  },
  printing: {
    enabled: false,
    agent_url: "",
    default_printer: "",
    label_printer: "",
    api_key: "",
  },
  queue_display: {
    enabled: false,
    display_client_url: "",
    location_code: "",
    websocket_channel: "",
    api_key: "",
  },
};

export function DeviceIntegrationsSettings() {
  const queryClient = useQueryClient();
  const canUpdate = useHasPermission(P.INTEGRATION.UPDATE);
  const [drafts, setDrafts] = useState<
    Partial<Record<SecureDeviceSettingsKey, Record<string, unknown>>>
  >({});

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["secure-device-settings"],
    queryFn: () => api.getSecureDeviceSettings(),
    staleTime: 300_000,
  });

  const rowsByKey = useMemo(() => new Map(rows.map((row) => [row.key, row])), [rows]);

  const mutation = useMutation({
    mutationFn: (payload: UpdateSecureDeviceSettingRequest) =>
      api.updateSecureDeviceSetting(payload),
    onSuccess: (row) => {
      queryClient.setQueryData<SecureTenantSettingRow[]>(
        ["secure-device-settings"],
        (existing = []) => {
          const hasExisting = existing.some((item) => item.key === row.key);
          if (hasExisting) {
            return existing.map((item) => (item.key === row.key ? row : item));
          }
          return [...existing, row];
        },
      );
      setDrafts((existing) => {
        const next = { ...existing };
        delete next[row.key];
        return next;
      });
      notifications.show({
        title: "Connector saved",
        message: `${row.key.replace(/_/g, " ")} settings were updated.`,
        color: "success",
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: "Save failed",
        message: error.message,
        color: "danger",
      });
    },
  });

  const getConfig = (key: SecureDeviceSettingsKey) => ({
    ...DEFAULT_CONFIGS[key],
    ...(rowsByKey.get(key)?.value ?? {}),
    ...(drafts[key] ?? {}),
  });

  const updateField = (
    key: SecureDeviceSettingsKey,
    field: string,
    value: string | number | boolean,
  ) => {
    setDrafts((existing) => ({
      ...existing,
      [key]: {
        ...getConfig(key),
        [field]: value,
      },
    }));
  };

  const saveConnector = (key: SecureDeviceSettingsKey) => {
    mutation.mutate({
      key,
      value: getConfig(key),
    });
  };

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading secure device settings…</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Alert icon={<IconPlugConnected size={18} />} color="blue" variant="light">
        <Text size="sm">
          Common device configuration is handled here with allowlisted connector keys, masked secret
          reads, and permission-scoped updates. Real vendor adapters can plug into these shared
          settings instead of storing their own scattered config.
        </Text>
      </Alert>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        {CONNECTOR_DEFINITIONS.map((definition) => {
          const row = rowsByKey.get(definition.key);
          const config = getConfig(definition.key);

          return (
            <Card key={definition.key} withBorder radius="md" padding="lg">
              <Stack gap="md">
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Title order={5}>{definition.title}</Title>
                    <Text size="sm" c="dimmed" mt={4}>
                      {definition.description}
                    </Text>
                  </div>
                  <Stack gap={4} align="flex-end">
                    <Badge variant="light" color={row?.is_configured ? "green" : "gray"}>
                      {row?.is_configured ? "Configured" : "Not configured"}
                    </Badge>
                    {row?.has_secrets && (
                      <Badge variant="outline" color="blue" leftSection={<IconLock size={12} />}>
                        {row.masked_secret_fields.length} masked
                      </Badge>
                    )}
                  </Stack>
                </Group>

                <Text size="xs" c="dimmed">
                  {definition.fallback}
                </Text>

                <Stack gap="sm">
                  {definition.fields.map((field) => {
                    const value = config[field.key];

                    if (field.type === "switch") {
                      return (
                        <Group
                          key={field.key}
                          justify="space-between"
                          align="flex-start"
                          wrap="nowrap"
                        >
                          <div>
                            <Text size="sm" fw={500}>
                              {field.label}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {field.description}
                            </Text>
                          </div>
                          <Switch
                            checked={value === true}
                            onChange={(event) =>
                              updateField(definition.key, field.key, event.currentTarget.checked)
                            }
                            disabled={!canUpdate || mutation.isPending}
                          />
                        </Group>
                      );
                    }

                    if (field.type === "number") {
                      return (
                        <NumberInput
                          key={field.key}
                          label={field.label}
                          description={field.description}
                          value={typeof value === "number" ? value : undefined}
                          onChange={(next) =>
                            updateField(
                              definition.key,
                              field.key,
                              typeof next === "number" ? next : 0,
                            )
                          }
                          disabled={!canUpdate || mutation.isPending}
                          min={1}
                          max={65535}
                        />
                      );
                    }

                    if (field.type === "select") {
                      return (
                        <Select
                          key={field.key}
                          label={field.label}
                          description={field.description}
                          value={typeof value === "string" ? value : null}
                          data={field.options}
                          onChange={(next) => updateField(definition.key, field.key, next ?? "")}
                          disabled={!canUpdate || mutation.isPending}
                        />
                      );
                    }

                    if (field.type === "password") {
                      return (
                        <PasswordInput
                          key={field.key}
                          label={field.label}
                          description={field.description}
                          value={typeof value === "string" ? value : ""}
                          onChange={(event) =>
                            updateField(definition.key, field.key, event.currentTarget.value)
                          }
                          disabled={!canUpdate || mutation.isPending}
                        />
                      );
                    }

                    return (
                      <TextInput
                        key={field.key}
                        label={field.label}
                        description={field.description}
                        value={typeof value === "string" ? value : ""}
                        onChange={(event) =>
                          updateField(definition.key, field.key, event.currentTarget.value)
                        }
                        disabled={!canUpdate || mutation.isPending}
                      />
                    );
                  })}
                </Stack>

                <Group justify="flex-end">
                  <Button
                    leftSection={<IconDeviceFloppy size={14} />}
                    onClick={() => saveConnector(definition.key)}
                    loading={mutation.isPending}
                    disabled={!canUpdate}
                  >
                    Save {definition.title}
                  </Button>
                </Group>
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}

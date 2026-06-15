import {
  Alert,
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
import { useHasPermission } from "@medbrains/stores";
import type {
  SecureDeviceSettingsKey,
  SecureTenantSettingRow,
  UpdateSecureDeviceSettingRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconDeviceFloppy, IconLock, IconPlugConnected } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { OperationalSignal } from "@/components/OperationalSignal";
import { Button } from "@/components/ui";
import { settingsSetupService } from "@/services/settingsSetup.service";
import { DEVICE_CONNECTOR_DEFINITIONS, deviceConnectorTitleKey } from "./device-integrations-i18n";

type DeviceSettingsFormValues = Record<string, Record<string, boolean | number | string>>;

const DEFAULT_CONFIGS: Record<
  SecureDeviceSettingsKey,
  Record<string, boolean | number | string>
> = {
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

function isDeviceSettingFormValue(value: unknown): value is boolean | number | string {
  return typeof value === "boolean" || typeof value === "number" || typeof value === "string";
}

function rowToConnectorFormValues(
  key: SecureDeviceSettingsKey,
  row: SecureTenantSettingRow | undefined,
): Record<string, boolean | number | string> {
  const values = { ...DEFAULT_CONFIGS[key] };

  for (const [fieldKey, fieldValue] of Object.entries(row?.value ?? {})) {
    if (isDeviceSettingFormValue(fieldValue)) {
      values[fieldKey] = fieldValue;
    }
  }

  return values;
}

export function DeviceIntegrationsSettings() {
  const { t } = useTranslation("admin");
  const queryClient = useQueryClient();
  const canUpdate = useHasPermission(P.INTEGRATION.UPDATE);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["secure-device-settings"],
    queryFn: () => settingsSetupService.getSecureDeviceSettings(),
    staleTime: 300_000,
  });

  const rowsByKey = useMemo(() => new Map(rows.map((row) => [row.key, row])), [rows]);
  const formValues = useMemo<DeviceSettingsFormValues>(() => {
    const values: DeviceSettingsFormValues = {};

    for (const definition of DEVICE_CONNECTOR_DEFINITIONS) {
      values[definition.key] = rowToConnectorFormValues(
        definition.key,
        rowsByKey.get(definition.key),
      );
    }

    return values;
  }, [rowsByKey]);

  const { control, getValues } = useForm<DeviceSettingsFormValues>({
    defaultValues: DEFAULT_CONFIGS,
    values: formValues,
  });

  const mutation = useMutation({
    mutationFn: (payload: UpdateSecureDeviceSettingRequest) =>
      settingsSetupService.updateSecureDeviceSetting(payload),
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
      notifications.show({
        title: t("deviceIntegrations.notifications.saved.title"),
        message: t("deviceIntegrations.notifications.saved.message", {
          connector: t(deviceConnectorTitleKey(row.key)),
        }),
        color: "success",
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: t("deviceIntegrations.notifications.saveFailed.title"),
        message: t("deviceIntegrations.notifications.saveFailed.message", {
          error: error.message,
        }),
        color: "danger",
      });
    },
  });

  const saveConnector = (key: SecureDeviceSettingsKey) => {
    mutation.mutate({
      key,
      value: getValues(key),
    });
  };

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">{t("deviceIntegrations.loading")}</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Alert icon={<IconPlugConnected size={18} />} color="blue" variant="light">
        <Text size="sm">{t("deviceIntegrations.alert")}</Text>
      </Alert>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        {DEVICE_CONNECTOR_DEFINITIONS.map((definition) => {
          const row = rowsByKey.get(definition.key);

          return (
            <Card key={definition.key} withBorder radius="md" padding="lg">
              <Stack gap="md">
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Title order={5}>{t(definition.titleKey)}</Title>
                    <Text size="sm" c="dimmed" mt={4}>
                      {t(definition.descriptionKey)}
                    </Text>
                  </div>
                  <Stack gap={4} align="flex-end">
                    <OperationalSignal
                      label={t(
                        row?.is_configured
                          ? "deviceIntegrations.status.configured"
                          : "deviceIntegrations.status.notConfigured",
                      )}
                      shape="token"
                      size="xs"
                      tone={row?.is_configured ? "complete" : "neutral"}
                    />
                    {row?.has_secrets && (
                      <OperationalSignal
                        icon={IconLock}
                        label={t("deviceIntegrations.status.masked")}
                        shape="diamond"
                        size="xs"
                        tone="active"
                        value={row.masked_secret_fields.length}
                      />
                    )}
                  </Stack>
                </Group>

                <Text size="xs" c="dimmed">
                  {t(definition.fallbackKey)}
                </Text>

                <Stack gap="sm">
                  {definition.fields.map((connectorField) => (
                    <Controller
                      key={connectorField.key}
                      control={control}
                      name={`${definition.key}.${connectorField.key}`}
                      render={({ field }) => {
                        if (connectorField.type === "switch") {
                          return (
                            <Group justify="space-between" align="flex-start" wrap="nowrap">
                              <div>
                                <Text size="sm" fw={500}>
                                  {t(connectorField.labelKey)}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {t(connectorField.descriptionKey)}
                                </Text>
                              </div>
                              <Switch
                                checked={field.value === true}
                                onChange={(event) => field.onChange(event.currentTarget.checked)}
                                disabled={!canUpdate || mutation.isPending}
                              />
                            </Group>
                          );
                        }

                        if (connectorField.type === "number") {
                          return (
                            <NumberInput
                              label={t(connectorField.labelKey)}
                              description={t(connectorField.descriptionKey)}
                              value={typeof field.value === "number" ? field.value : undefined}
                              onChange={(next) =>
                                field.onChange(typeof next === "number" ? next : 0)
                              }
                              disabled={!canUpdate || mutation.isPending}
                              min={1}
                              max={65535}
                            />
                          );
                        }

                        if (connectorField.type === "select") {
                          return (
                            <Select
                              label={t(connectorField.labelKey)}
                              description={t(connectorField.descriptionKey)}
                              value={typeof field.value === "string" ? field.value : null}
                              data={
                                "options" in connectorField
                                  ? connectorField.options.map((option) => ({
                                      value: option.value,
                                      label: t(option.labelKey),
                                    }))
                                  : []
                              }
                              onChange={(next) => field.onChange(next ?? "")}
                              disabled={!canUpdate || mutation.isPending}
                            />
                          );
                        }

                        if (connectorField.type === "password") {
                          return (
                            <PasswordInput
                              label={t(connectorField.labelKey)}
                              description={t(connectorField.descriptionKey)}
                              value={typeof field.value === "string" ? field.value : ""}
                              onChange={(event) => field.onChange(event.currentTarget.value)}
                              disabled={!canUpdate || mutation.isPending}
                            />
                          );
                        }

                        return (
                          <TextInput
                            label={t(connectorField.labelKey)}
                            description={t(connectorField.descriptionKey)}
                            value={typeof field.value === "string" ? field.value : ""}
                            onChange={(event) => field.onChange(event.currentTarget.value)}
                            disabled={!canUpdate || mutation.isPending}
                          />
                        );
                      }}
                    />
                  ))}
                </Stack>

                <Group justify="flex-end">
                  <Button
                    tone="primary"
                    leftSection={<IconDeviceFloppy size={14} />}
                    onClick={() => saveConnector(definition.key)}
                    loading={mutation.isPending}
                    disabled={!canUpdate}
                  >
                    {t("deviceIntegrations.saveButton", { connector: t(definition.titleKey) })}
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

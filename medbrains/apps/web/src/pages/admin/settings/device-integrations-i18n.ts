import type { SecureDeviceSettingsKey } from "@medbrains/types";

export type DeviceConnectorFieldType = "number" | "password" | "select" | "switch" | "text";

export interface DeviceConnectorOptionDefinition {
  labelKey: string;
  value: string;
}

export interface DeviceConnectorFieldDefinition {
  descriptionKey: string;
  key: string;
  labelKey: string;
  options?: readonly DeviceConnectorOptionDefinition[];
  type: DeviceConnectorFieldType;
}

export interface DeviceConnectorDefinition {
  descriptionKey: string;
  fallbackKey: string;
  fields: readonly DeviceConnectorFieldDefinition[];
  key: SecureDeviceSettingsKey;
  titleKey: string;
}

export const DEVICE_INTEGRATION_TEXT_KEYS = [
  "deviceIntegrations.alert",
  "deviceIntegrations.loading",
  "deviceIntegrations.notifications.saved.title",
  "deviceIntegrations.notifications.saved.message",
  "deviceIntegrations.notifications.saveFailed.title",
  "deviceIntegrations.notifications.saveFailed.message",
  "deviceIntegrations.saveButton",
  "deviceIntegrations.status.configured",
  "deviceIntegrations.status.notConfigured",
  "deviceIntegrations.status.masked",
] as const;

export const DEVICE_CONNECTOR_DEFINITIONS = [
  {
    key: "pacs_dicom",
    titleKey: "deviceIntegrations.connectors.pacsDicom.title",
    descriptionKey: "deviceIntegrations.connectors.pacsDicom.description",
    fallbackKey: "deviceIntegrations.connectors.pacsDicom.fallback",
    fields: [
      {
        key: "enabled",
        labelKey: "deviceIntegrations.fields.enabled.label",
        descriptionKey: "deviceIntegrations.connectors.pacsDicom.fields.enabled.description",
        type: "switch",
      },
      {
        key: "host",
        labelKey: "deviceIntegrations.connectors.pacsDicom.fields.host.label",
        descriptionKey: "deviceIntegrations.connectors.pacsDicom.fields.host.description",
        type: "text",
      },
      {
        key: "port",
        labelKey: "deviceIntegrations.fields.port.label",
        descriptionKey: "deviceIntegrations.connectors.pacsDicom.fields.port.description",
        type: "number",
      },
      {
        key: "local_ae_title",
        labelKey: "deviceIntegrations.connectors.pacsDicom.fields.localAeTitle.label",
        descriptionKey: "deviceIntegrations.connectors.pacsDicom.fields.localAeTitle.description",
        type: "text",
      },
      {
        key: "remote_ae_title",
        labelKey: "deviceIntegrations.connectors.pacsDicom.fields.remoteAeTitle.label",
        descriptionKey: "deviceIntegrations.connectors.pacsDicom.fields.remoteAeTitle.description",
        type: "text",
      },
      {
        key: "username",
        labelKey: "deviceIntegrations.fields.username.label",
        descriptionKey: "deviceIntegrations.connectors.pacsDicom.fields.username.description",
        type: "text",
      },
      {
        key: "password",
        labelKey: "deviceIntegrations.fields.passwordSecret.label",
        descriptionKey: "deviceIntegrations.fields.secret.description",
        type: "password",
      },
      {
        key: "worklist_enabled",
        labelKey: "deviceIntegrations.connectors.pacsDicom.fields.worklistEnabled.label",
        descriptionKey:
          "deviceIntegrations.connectors.pacsDicom.fields.worklistEnabled.description",
        type: "switch",
      },
    ],
  },
  {
    key: "lab_interface",
    titleKey: "deviceIntegrations.connectors.labInterface.title",
    descriptionKey: "deviceIntegrations.connectors.labInterface.description",
    fallbackKey: "deviceIntegrations.connectors.labInterface.fallback",
    fields: [
      {
        key: "enabled",
        labelKey: "deviceIntegrations.fields.enabled.label",
        descriptionKey: "deviceIntegrations.connectors.labInterface.fields.enabled.description",
        type: "switch",
      },
      {
        key: "protocol",
        labelKey: "deviceIntegrations.connectors.labInterface.fields.protocol.label",
        descriptionKey: "deviceIntegrations.connectors.labInterface.fields.protocol.description",
        type: "select",
        options: [
          {
            value: "hl7",
            labelKey: "deviceIntegrations.connectors.labInterface.protocols.hl7",
          },
          {
            value: "astm",
            labelKey: "deviceIntegrations.connectors.labInterface.protocols.astm",
          },
          {
            value: "file_drop",
            labelKey: "deviceIntegrations.connectors.labInterface.protocols.fileDrop",
          },
        ],
      },
      {
        key: "host",
        labelKey: "deviceIntegrations.connectors.labInterface.fields.host.label",
        descriptionKey: "deviceIntegrations.connectors.labInterface.fields.host.description",
        type: "text",
      },
      {
        key: "port",
        labelKey: "deviceIntegrations.fields.port.label",
        descriptionKey: "deviceIntegrations.connectors.labInterface.fields.port.description",
        type: "number",
      },
      {
        key: "analyzer_code",
        labelKey: "deviceIntegrations.connectors.labInterface.fields.analyzerCode.label",
        descriptionKey:
          "deviceIntegrations.connectors.labInterface.fields.analyzerCode.description",
        type: "text",
      },
      {
        key: "username",
        labelKey: "deviceIntegrations.fields.username.label",
        descriptionKey: "deviceIntegrations.connectors.labInterface.fields.username.description",
        type: "text",
      },
      {
        key: "password",
        labelKey: "deviceIntegrations.fields.passwordSecret.label",
        descriptionKey: "deviceIntegrations.fields.secret.description",
        type: "password",
      },
    ],
  },
  {
    key: "biometric",
    titleKey: "deviceIntegrations.connectors.biometric.title",
    descriptionKey: "deviceIntegrations.connectors.biometric.description",
    fallbackKey: "deviceIntegrations.connectors.biometric.fallback",
    fields: [
      {
        key: "enabled",
        labelKey: "deviceIntegrations.fields.enabled.label",
        descriptionKey: "deviceIntegrations.connectors.biometric.fields.enabled.description",
        type: "switch",
      },
      {
        key: "vendor",
        labelKey: "deviceIntegrations.connectors.biometric.fields.vendor.label",
        descriptionKey: "deviceIntegrations.connectors.biometric.fields.vendor.description",
        type: "text",
      },
      {
        key: "service_url",
        labelKey: "deviceIntegrations.connectors.biometric.fields.serviceUrl.label",
        descriptionKey: "deviceIntegrations.connectors.biometric.fields.serviceUrl.description",
        type: "text",
      },
      {
        key: "device_id",
        labelKey: "deviceIntegrations.connectors.biometric.fields.deviceId.label",
        descriptionKey: "deviceIntegrations.connectors.biometric.fields.deviceId.description",
        type: "text",
      },
      {
        key: "api_key",
        labelKey: "deviceIntegrations.fields.apiKeySecret.label",
        descriptionKey: "deviceIntegrations.fields.secret.description",
        type: "password",
      },
    ],
  },
  {
    key: "printing",
    titleKey: "deviceIntegrations.connectors.printing.title",
    descriptionKey: "deviceIntegrations.connectors.printing.description",
    fallbackKey: "deviceIntegrations.connectors.printing.fallback",
    fields: [
      {
        key: "enabled",
        labelKey: "deviceIntegrations.fields.enabled.label",
        descriptionKey: "deviceIntegrations.connectors.printing.fields.enabled.description",
        type: "switch",
      },
      {
        key: "agent_url",
        labelKey: "deviceIntegrations.connectors.printing.fields.agentUrl.label",
        descriptionKey: "deviceIntegrations.connectors.printing.fields.agentUrl.description",
        type: "text",
      },
      {
        key: "default_printer",
        labelKey: "deviceIntegrations.connectors.printing.fields.defaultPrinter.label",
        descriptionKey: "deviceIntegrations.connectors.printing.fields.defaultPrinter.description",
        type: "text",
      },
      {
        key: "label_printer",
        labelKey: "deviceIntegrations.connectors.printing.fields.labelPrinter.label",
        descriptionKey: "deviceIntegrations.connectors.printing.fields.labelPrinter.description",
        type: "text",
      },
      {
        key: "api_key",
        labelKey: "deviceIntegrations.fields.apiKeySecret.label",
        descriptionKey: "deviceIntegrations.fields.secret.description",
        type: "password",
      },
    ],
  },
  {
    key: "queue_display",
    titleKey: "deviceIntegrations.connectors.queueDisplay.title",
    descriptionKey: "deviceIntegrations.connectors.queueDisplay.description",
    fallbackKey: "deviceIntegrations.connectors.queueDisplay.fallback",
    fields: [
      {
        key: "enabled",
        labelKey: "deviceIntegrations.fields.enabled.label",
        descriptionKey: "deviceIntegrations.connectors.queueDisplay.fields.enabled.description",
        type: "switch",
      },
      {
        key: "display_client_url",
        labelKey: "deviceIntegrations.connectors.queueDisplay.fields.displayClientUrl.label",
        descriptionKey:
          "deviceIntegrations.connectors.queueDisplay.fields.displayClientUrl.description",
        type: "text",
      },
      {
        key: "location_code",
        labelKey: "deviceIntegrations.connectors.queueDisplay.fields.locationCode.label",
        descriptionKey:
          "deviceIntegrations.connectors.queueDisplay.fields.locationCode.description",
        type: "text",
      },
      {
        key: "websocket_channel",
        labelKey: "deviceIntegrations.connectors.queueDisplay.fields.websocketChannel.label",
        descriptionKey:
          "deviceIntegrations.connectors.queueDisplay.fields.websocketChannel.description",
        type: "text",
      },
      {
        key: "api_key",
        labelKey: "deviceIntegrations.fields.apiKeySecret.label",
        descriptionKey: "deviceIntegrations.fields.secret.description",
        type: "password",
      },
    ],
  },
] as const satisfies readonly DeviceConnectorDefinition[];

export const DEVICE_CONNECTOR_DEFINITIONS_BY_KEY = new Map(
  DEVICE_CONNECTOR_DEFINITIONS.map((definition) => [definition.key, definition]),
);

export function deviceConnectorTitleKey(key: SecureDeviceSettingsKey): string {
  return DEVICE_CONNECTOR_DEFINITIONS_BY_KEY.get(key)?.titleKey ?? key;
}

export function getDeviceIntegrationI18nKeys(): string[] {
  const keys = new Set<string>(DEVICE_INTEGRATION_TEXT_KEYS);

  for (const definition of DEVICE_CONNECTOR_DEFINITIONS) {
    keys.add(definition.titleKey);
    keys.add(definition.descriptionKey);
    keys.add(definition.fallbackKey);

    for (const field of definition.fields) {
      keys.add(field.labelKey);
      keys.add(field.descriptionKey);

      if ("options" in field) {
        for (const option of field.options) {
          keys.add(option.labelKey);
        }
      }
    }
  }

  return [...keys].sort();
}

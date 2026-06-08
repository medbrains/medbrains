// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEVICE_CONNECTOR_DEFINITIONS,
  deviceConnectorTitleKey,
  getDeviceIntegrationI18nKeys,
} from "./device-integrations-i18n";

const LOCALES = ["en", "hi", "ta", "ar"] as const;

function loadAdminLocale(locale: (typeof LOCALES)[number]): Record<string, string> {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), "public/locales", locale, "admin.json"), "utf8"),
  ) as Record<string, string>;
}

describe("device integrations i18n", () => {
  it("keeps every connector and field label backed by admin locale keys", () => {
    const keys = getDeviceIntegrationI18nKeys();

    for (const locale of LOCALES) {
      const messages = loadAdminLocale(locale);
      const missing = keys.filter((key) => !messages[key]);

      expect(missing, `${locale} missing device integration i18n keys`).toEqual([]);
    }
  });

  it("keeps connector title lookup aligned with secure device setting keys", () => {
    expect(DEVICE_CONNECTOR_DEFINITIONS.map((definition) => definition.key)).toEqual([
      "pacs_dicom",
      "lab_interface",
      "biometric",
      "printing",
      "queue_display",
    ]);

    for (const definition of DEVICE_CONNECTOR_DEFINITIONS) {
      expect(deviceConnectorTitleKey(definition.key)).toBe(definition.titleKey);
      expect(definition.fields.length).toBeGreaterThan(0);
    }
  });
});

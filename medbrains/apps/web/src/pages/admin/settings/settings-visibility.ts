import { useModuleStore, usePermissionStore } from "@medbrains/stores";
import { BRICK_MANIFESTS } from "@medbrains/types";
import { useMemo } from "react";
import { SETTINGS_TABS } from "@/config/settings-tabs";

type SettingsTab = (typeof SETTINGS_TABS)[number];

/** The app brick that plugs each Settings section in (its manifest's `settings`). */
const SETTINGS_BRICK = new Map(
  Object.values(BRICK_MANIFESTS).flatMap((brick) => brick.settings.map((key) => [key, brick.id])),
);

/** The permissions that each open a Settings section: holding any one is enough. */
export function settingsTabPermissions(tab: SettingsTab): string[] {
  return [tab.requiredPermission, ...(tab.requiredPermissions ?? [])].filter(
    (permission): permission is string => typeof permission === "string",
  );
}

/**
 * The Settings sections a person sees: those they hold a permission for, minus those a
 * switched-off app plugs in. Hidden, never greyed; the server still decides every save.
 */
export function useVisibleSettingsTabs(): SettingsTab[] {
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const disabledModules = useModuleStore((s) => s.disabledModules);
  return useMemo(
    () =>
      SETTINGS_TABS.filter(
        (tab) =>
          settingsTabPermissions(tab).some(hasPermission) &&
          !disabledModules.has(SETTINGS_BRICK.get(tab.value) ?? ""),
      ),
    [hasPermission, disabledModules],
  );
}

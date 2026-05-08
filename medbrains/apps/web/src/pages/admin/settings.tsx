import { Tabs } from "@mantine/core";
import { usePermissionStore } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { createElement, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../components";
import { SETTINGS_TAB_ICON_MAP, SETTINGS_TABS } from "../../config/settings-tabs";
import { useHashTabs } from "../../hooks/useHashTabs";
import { useRequirePermission } from "../../hooks/useRequirePermission";

export function SettingsPage() {
  const { t } = useTranslation("admin");
  const hasPermission = usePermissionStore((s) => s.hasPermission);

  const visibleTabs = useMemo(
    () =>
      SETTINGS_TABS.filter(
        (tab) => !tab.requiredPermission || hasPermission(tab.requiredPermission),
      ),
    [hasPermission],
  );

  useRequirePermission(visibleTabs[0]?.requiredPermission ?? P.ADMIN.SETTINGS.GENERAL.MANAGE);

  const validValues = useMemo(() => visibleTabs.map((tab) => tab.value), [visibleTabs]);
  const [tab, setTab] = useHashTabs(visibleTabs[0]?.value ?? "general", validValues);

  return (
    <div>
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <Tabs value={tab} onChange={setTab} mt="md">
        <Tabs.List>
          {visibleTabs.map((cfg) => {
            const Icon = SETTINGS_TAB_ICON_MAP[cfg.icon];
            return (
              <Tabs.Tab
                key={cfg.value}
                value={cfg.value}
                leftSection={Icon ? createElement(Icon, { size: 16 }) : undefined}
              >
                {t(cfg.i18nKey)}
              </Tabs.Tab>
            );
          })}
        </Tabs.List>

        {visibleTabs.map((cfg) => (
          <Tabs.Panel key={cfg.value} value={cfg.value} pt="md">
            <cfg.component />
          </Tabs.Panel>
        ))}
      </Tabs>
    </div>
  );
}

import { Stack, Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconAdjustments, IconMap2 } from "@tabler/icons-react";
import { useSearchParams } from "react-router";
import { PageHeader } from "@/components/PageHeader";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { LiveTab } from "./live-tab";
import { SetupTab } from "./setup-tab";

/**
 * MedBrains Flow (#4901): where the crowd is in the building, how long people
 * wait, and what to do about it — estimated from queues, check-ins, visitor
 * passes and rosters. A licensed add-on; no patient is named anywhere on it.
 */
export function FlowPage() {
  useRequirePermission([P.FLOW.VIEW, P.FLOW.MANAGE]);
  const canView = useHasPermission(P.FLOW.VIEW);
  const canManage = useHasPermission(P.FLOW.MANAGE);
  const tabs = [
    { value: "live", label: "Live floor", icon: IconMap2, allowed: canView, panel: <LiveTab /> },
    {
      value: "setup",
      label: "Setup",
      icon: IconAdjustments,
      allowed: canManage,
      panel: <SetupTab />,
    },
  ].filter((t) => t.allowed);
  const [params, setParams] = useSearchParams();
  const active = tabs.some((t) => t.value === params.get("tab"))
    ? (params.get("tab") as string)
    : tabs[0]?.value;
  return (
    <Stack gap="md">
      <PageHeader
        title="MedBrains Flow"
        description="The crowd and the waits on each floor, estimated live from queues, check-ins, visitor passes and rosters."
      />
      <Tabs
        value={active}
        onChange={(v) => v && setParams({ tab: v }, { replace: true })}
        keepMounted={false}
      >
        <Tabs.List>
          {tabs.map((t) => (
            <Tabs.Tab key={t.value} value={t.value} leftSection={<t.icon size={16} aria-hidden />}>
              {t.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {tabs.map((t) => (
          <Tabs.Panel key={t.value} value={t.value} pt="md">
            {t.panel}
          </Tabs.Panel>
        ))}
      </Tabs>
    </Stack>
  );
}

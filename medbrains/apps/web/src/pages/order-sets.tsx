import { Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconChartBar, IconHistory, IconListDetails, IconPencil } from "@tabler/icons-react";
import { useState } from "react";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { ActivationsTab } from "./order-sets/activations-tab";
import { AnalyticsTab } from "./order-sets/analytics-tab";
import { BuilderTab } from "./order-sets/builder-tab";
import { TemplatesTab } from "./order-sets/templates-tab";

export function OrderSetsPage() {
  useRequirePermission(P.ORDER_SETS.TEMPLATES_LIST);

  const canCreate = useHasPermission(P.ORDER_SETS.TEMPLATES_CREATE);
  const canUpdate = useHasPermission(P.ORDER_SETS.TEMPLATES_UPDATE);
  const canApprove = useHasPermission(P.ORDER_SETS.TEMPLATES_APPROVE);
  const canViewActivations = useHasPermission(P.ORDER_SETS.ACTIVATION_VIEW);
  const canViewAnalytics = useHasPermission(P.ORDER_SETS.ANALYTICS_VIEW);

  const [tab, setTab] = useState<string | null>("templates");

  return (
    <div>
      <PageHeader title="Order Sets" subtitle="Reusable bundles of orders for standardized care" />
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="templates" leftSection={<IconListDetails size={16} />}>
            Templates
          </Tabs.Tab>
          <Tabs.Tab value="builder" leftSection={<IconPencil size={16} />}>
            Builder
          </Tabs.Tab>
          {canViewActivations && (
            <Tabs.Tab value="activations" leftSection={<IconHistory size={16} />}>
              Activations
            </Tabs.Tab>
          )}
          {canViewAnalytics && (
            <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
              Analytics
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="templates" pt="md">
          <TemplatesTab canCreate={canCreate} canUpdate={canUpdate} canApprove={canApprove} />
        </Tabs.Panel>
        <Tabs.Panel value="builder" pt="md">
          <BuilderTab canUpdate={canUpdate} />
        </Tabs.Panel>
        {canViewActivations && (
          <Tabs.Panel value="activations" pt="md">
            <ActivationsTab />
          </Tabs.Panel>
        )}
        {canViewAnalytics && (
          <Tabs.Panel value="analytics" pt="md">
            <AnalyticsTab />
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 1: Templates
// ══════════════════════════════════════════════════════════

import { Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { PageHeader } from "@/components";
import { useHashTabs } from "@/hooks/useHashTabs";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { MarketingCampaignsTab } from "./marketing/campaigns-tab";

/**
 * The marketing shell.
 *
 * The module's backend has been complete for some time — twenty routes, nine
 * tables, permissions across eight sub-modules — with no screen, no route and
 * no client method anywhere. Everything it can do has been unreachable.
 *
 * One route with hash tabs rather than one route per screen: five roles hold
 * five largely disjoint permission sets here, and a tab list built from what
 * the viewer actually holds keeps the navigation to a single entry instead of
 * five that mostly 403.
 */
const TAB_VALUES = ["campaigns"] as const;

export function MarketingPage() {
  useRequirePermission(P.MARKETING.CAMPAIGNS_VIEW);

  const canViewCampaigns = useHasPermission(P.MARKETING.CAMPAIGNS_VIEW);
  const canManageCampaigns = useHasPermission(P.MARKETING.CAMPAIGNS_MANAGE);

  const [tab, setTab] = useHashTabs("campaigns", TAB_VALUES);

  return (
    <div>
      <PageHeader
        title="Marketing"
        subtitle="Campaigns, enquiries and outreach — the acquisition side of the practice"
      />
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          {canViewCampaigns && <Tabs.Tab value="campaigns">Campaigns</Tabs.Tab>}
        </Tabs.List>

        <Tabs.Panel value="campaigns" pt="md">
          <MarketingCampaignsTab canManage={canManageCampaigns} />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

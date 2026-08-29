import { Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { PageHeader } from "@/components";
import { useHashTabs } from "@/hooks/useHashTabs";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { MarketingCampaignsTab } from "./marketing/campaigns-tab";
import { MarketingEnquiriesTab } from "./marketing/enquiries-tab";
import { MarketingFunnelTab } from "./marketing/funnel-tab";
import { MarketingOutreachTab } from "./marketing/outreach-tab";

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
const TAB_VALUES = ["enquiries", "campaigns", "outreach", "funnel"] as const;

export function MarketingPage() {
  // The desk role holds contacts but not campaigns, so the page guard is the
  // one every marketing role has.
  useRequirePermission(P.MARKETING.CONTACTS_LIST);

  const canListContacts = useHasPermission(P.MARKETING.CONTACTS_LIST);
  const canViewContact = useHasPermission(P.MARKETING.CONTACTS_VIEW);
  const canCreateContact = useHasPermission(P.MARKETING.CONTACTS_CREATE);
  const canLogInteraction = useHasPermission(P.MARKETING.INTERACTIONS_LOG);
  const canMoveStage = useHasPermission(P.MARKETING.PIPELINE_MOVE);
  const canViewStages = useHasPermission(P.MARKETING.PIPELINE_VIEW);
  const canViewCampaigns = useHasPermission(P.MARKETING.CAMPAIGNS_VIEW);
  const canManageCampaigns = useHasPermission(P.MARKETING.CAMPAIGNS_MANAGE);
  const canViewReports = useHasPermission(P.MARKETING.REPORTS_VIEW);
  const canSendOutreach = useHasPermission(P.MARKETING.OUTREACH_SEND);
  const canApproveOutreach = useHasPermission(P.MARKETING.OUTREACH_APPROVE);
  const canViewCohorts = useHasPermission(P.MARKETING.COHORTS_VIEW);

  const [tab, setTab] = useHashTabs(canListContacts ? "enquiries" : "campaigns", TAB_VALUES);

  return (
    <div>
      <PageHeader
        title="Marketing"
        subtitle="Campaigns, enquiries and outreach — the acquisition side of the practice"
      />
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          {canListContacts && <Tabs.Tab value="enquiries">Enquiries</Tabs.Tab>}
          {canViewCampaigns && <Tabs.Tab value="campaigns">Campaigns</Tabs.Tab>}
          {canViewCohorts && <Tabs.Tab value="outreach">Outreach</Tabs.Tab>}
          {canViewReports && <Tabs.Tab value="funnel">Funnel</Tabs.Tab>}
        </Tabs.List>

        <Tabs.Panel value="enquiries" pt="md">
          <MarketingEnquiriesTab
            canView={canViewContact}
            canCreate={canCreateContact}
            canLog={canLogInteraction}
            canMoveStage={canMoveStage}
            canViewStages={canViewStages}
          />
        </Tabs.Panel>
        <Tabs.Panel value="campaigns" pt="md">
          <MarketingCampaignsTab canManage={canManageCampaigns} />
        </Tabs.Panel>
        <Tabs.Panel value="outreach" pt="md">
          <MarketingOutreachTab canSend={canSendOutreach} canApprove={canApproveOutreach} />
        </Tabs.Panel>
        <Tabs.Panel value="funnel" pt="md">
          <MarketingFunnelTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

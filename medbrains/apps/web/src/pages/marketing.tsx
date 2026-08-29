import { Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { PageHeader } from "@/components";
import { useHashTabs } from "@/hooks/useHashTabs";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { MarketingCallbacksTab } from "./marketing/callbacks-tab";
import { MarketingCampaignsTab } from "./marketing/campaigns-tab";
import { MarketingCohortsTab } from "./marketing/cohorts-tab";
import { MarketingEnquiriesTab } from "./marketing/enquiries-tab";
import { MarketingFunnelTab } from "./marketing/funnel-tab";
import { MarketingOutreachTab } from "./marketing/outreach-tab";
import { MarketingScreenPopTab } from "./marketing/screen-pop-tab";

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
const TAB_VALUES = [
  "enquiries",
  "screen-pop",
  "campaigns",
  "cohorts",
  "outreach",
  "funnel",
] as const;

export function MarketingPage() {
  // Any marketing permission opens the page; the tabs then show only what the
  // viewer holds.
  //
  // Guarding on `contacts.list` alone locked out the one role the clinical
  // recall list exists for: `doctor` holds `cohorts.clinical_define` and no
  // other marketing permission, so it was redirected off this page and could
  // never reach the button. A page guard narrower than its narrowest tab is a
  // feature nobody can open.
  useRequirePermission([
    P.MARKETING.CONTACTS_LIST,
    P.MARKETING.CONTACTS_VIEW,
    P.MARKETING.CAMPAIGNS_VIEW,
    P.MARKETING.COHORTS_VIEW,
    P.MARKETING.COHORTS_CLINICAL_DEFINE,
    P.MARKETING.OUTREACH_SEND,
    P.MARKETING.OUTREACH_APPROVE,
    P.MARKETING.REPORTS_VIEW,
  ]);

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
  const canManageCohorts = useHasPermission(P.MARKETING.COHORTS_MANAGE);
  // Held by doctors, not by marketing: a recall list reaches across the
  // clinical wall the module is explicit about keeping.
  const canDefineClinical = useHasPermission(P.MARKETING.COHORTS_CLINICAL_DEFINE);

  const defaultTab = canListContacts
    ? "enquiries"
    : canViewCohorts || canDefineClinical
      ? "cohorts"
      : canViewCampaigns
        ? "campaigns"
        : "funnel";
  const [tab, setTab] = useHashTabs(defaultTab, TAB_VALUES);

  return (
    <div>
      <PageHeader
        title="Marketing"
        subtitle="Campaigns, enquiries and outreach — the acquisition side of the practice"
      />
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          {canListContacts && <Tabs.Tab value="enquiries">Enquiries</Tabs.Tab>}
          {canViewStages && <Tabs.Tab value="callbacks">Callbacks</Tabs.Tab>}
          {canViewContact && <Tabs.Tab value="screen-pop">Who\u2019s calling</Tabs.Tab>}
          {canViewCampaigns && <Tabs.Tab value="campaigns">Campaigns</Tabs.Tab>}
          {(canViewCohorts || canDefineClinical) && <Tabs.Tab value="cohorts">Cohorts</Tabs.Tab>}
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
        <Tabs.Panel value="callbacks" pt="md">
          <MarketingCallbacksTab />
        </Tabs.Panel>
        <Tabs.Panel value="screen-pop" pt="md">
          <MarketingScreenPopTab />
        </Tabs.Panel>
        <Tabs.Panel value="campaigns" pt="md">
          <MarketingCampaignsTab canManage={canManageCampaigns} />
        </Tabs.Panel>
        <Tabs.Panel value="cohorts" pt="md">
          <MarketingCohortsTab canManage={canManageCohorts} canDefineClinical={canDefineClinical} />
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

import "@mantine/charts/styles.css";
import { Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconBiohazard,
  IconBug,
  IconChartBar,
  IconHandStop,
  IconNeedleThread,
  IconPill,
  IconShieldCheck,
  IconTemperature,
  IconUsers,
  IconVirusSearch,
} from "@tabler/icons-react";
import { useSearchParams } from "react-router";
import { IpdContextStrip, ipdContextFromSearchParams, PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { InvasiveDevicesPanel } from "@/pages/infection-control/InvasiveDevicesPanel";
import { AnalyticsTab } from "./infection-control/analytics-tab";
import { BiowasteTab } from "./infection-control/biowaste-tab";
import { HygieneTab } from "./infection-control/hygiene-tab";
import { MeetingsTab } from "./infection-control/meetings-tab";
import { OutbreakTab } from "./infection-control/outbreak-tab";
import { SharpsSafetyTab } from "./infection-control/sharps-safety-tab";
import { StewardshipTab } from "./infection-control/stewardship-tab";
import { SurveillanceTab } from "./infection-control/surveillance-tab";

// ── Color Maps ──────────────────────────────────────────

// Dropdown options for categorical fields

const INFECTION_CONTROL_PAGE_PERMISSIONS = [
  P.INFECTION_CONTROL.SURVEILLANCE_LIST,
  P.INFECTION_CONTROL.STEWARDSHIP_LIST,
  P.INFECTION_CONTROL.BIOWASTE_LIST,
  P.INFECTION_CONTROL.HYGIENE_LIST,
  P.INFECTION_CONTROL.OUTBREAK_LIST,
] as const;

// ── HAI Surveillance Tab ────────────────────────────────

export function InfectionControlPage() {
  useRequirePermission(INFECTION_CONTROL_PAGE_PERMISSIONS);
  const [searchParams, setSearchParams] = useSearchParams();
  const ipdContext = ipdContextFromSearchParams(searchParams);
  const canViewSurveillance = useHasPermission(P.INFECTION_CONTROL.SURVEILLANCE_LIST);
  const canViewStewardship = useHasPermission(P.INFECTION_CONTROL.STEWARDSHIP_LIST);
  const canViewBiowaste = useHasPermission(P.INFECTION_CONTROL.BIOWASTE_LIST);
  const canViewHygiene = useHasPermission(P.INFECTION_CONTROL.HYGIENE_LIST);
  const canViewOutbreaks = useHasPermission(P.INFECTION_CONTROL.OUTBREAK_LIST);
  const canViewAnalytics = canViewSurveillance && canViewStewardship && canViewHygiene;
  const visibleTabs = [
    ...(canViewSurveillance ? ["surveillance", "devices"] : []),
    ...(canViewStewardship ? ["stewardship"] : []),
    ...(canViewBiowaste ? ["biowaste", "sharps"] : []),
    ...(canViewHygiene ? ["hygiene"] : []),
    ...(canViewOutbreaks ? ["outbreaks"] : []),
    ...(canViewAnalytics ? ["analytics"] : []),
    ...(canViewSurveillance ? ["meetings"] : []),
  ];
  const requestedTab = searchParams.get("tab");
  const selectedTab =
    requestedTab && visibleTabs.includes(requestedTab) ? requestedTab : (visibleTabs[0] ?? null);
  const handleTabChange = (value: string | null) => {
    if (!value) return;
    const params = new URLSearchParams(searchParams);
    params.set("tab", value);
    setSearchParams(params, { replace: true });
  };

  return (
    <div>
      <PageHeader
        title="Infection Control"
        subtitle="HAI surveillance, antibiotic stewardship, bio-waste, hand hygiene, outbreak management, and sharps safety"
        icon={<IconShieldCheck size={20} stroke={1.5} />}
        color="danger"
      />
      <IpdContextStrip context={ipdContext} />

      <Tabs value={selectedTab} onChange={handleTabChange} keepMounted={false} mt="md">
        <Tabs.List>
          {canViewSurveillance && (
            <Tabs.Tab value="surveillance" leftSection={<IconBug size={16} />}>
              HAI Surveillance
            </Tabs.Tab>
          )}
          {canViewStewardship && (
            <Tabs.Tab value="stewardship" leftSection={<IconPill size={16} />}>
              Stewardship & Antibiogram
            </Tabs.Tab>
          )}
          {canViewBiowaste && (
            <Tabs.Tab value="biowaste" leftSection={<IconBiohazard size={16} />}>
              Bio-Waste
            </Tabs.Tab>
          )}
          {canViewHygiene && (
            <Tabs.Tab value="hygiene" leftSection={<IconHandStop size={16} />}>
              Hygiene & Bundles
            </Tabs.Tab>
          )}
          {canViewSurveillance && (
            <Tabs.Tab value="devices" leftSection={<IconTemperature size={16} />}>
              Invasive Devices
            </Tabs.Tab>
          )}
          {canViewOutbreaks && (
            <Tabs.Tab value="outbreaks" leftSection={<IconVirusSearch size={16} />}>
              Outbreaks
            </Tabs.Tab>
          )}
          {canViewBiowaste && (
            <Tabs.Tab value="sharps" leftSection={<IconNeedleThread size={16} />}>
              Sharps Safety
            </Tabs.Tab>
          )}
          {canViewAnalytics && (
            <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
              Analytics
            </Tabs.Tab>
          )}
          {canViewSurveillance && (
            <Tabs.Tab value="meetings" leftSection={<IconUsers size={16} />}>
              Meetings
            </Tabs.Tab>
          )}
        </Tabs.List>

        {canViewSurveillance && (
          <Tabs.Panel value="surveillance" pt="md">
            <SurveillanceTab />
          </Tabs.Panel>
        )}
        {canViewStewardship && (
          <Tabs.Panel value="stewardship" pt="md">
            <StewardshipTab />
          </Tabs.Panel>
        )}
        {canViewBiowaste && (
          <Tabs.Panel value="biowaste" pt="md">
            <BiowasteTab />
          </Tabs.Panel>
        )}
        {canViewSurveillance && (
          <Tabs.Panel value="devices" pt="md">
            <InvasiveDevicesPanel />
          </Tabs.Panel>
        )}
        {canViewHygiene && (
          <Tabs.Panel value="hygiene" pt="md">
            <HygieneTab />
          </Tabs.Panel>
        )}
        {canViewOutbreaks && (
          <Tabs.Panel value="outbreaks" pt="md">
            <OutbreakTab />
          </Tabs.Panel>
        )}
        {canViewBiowaste && (
          <Tabs.Panel value="sharps" pt="md">
            <SharpsSafetyTab />
          </Tabs.Panel>
        )}
        {canViewAnalytics && (
          <Tabs.Panel value="analytics" pt="md">
            <AnalyticsTab />
          </Tabs.Panel>
        )}
        {canViewSurveillance && (
          <Tabs.Panel value="meetings" pt="md">
            <MeetingsTab />
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
}

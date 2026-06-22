import { Box, Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconArchive,
  IconBabyCarriage,
  IconChartBar,
  IconClipboardList,
  IconFileCertificate,
  IconFileExport,
  IconScan,
  IconShieldCheck,
  IconShieldLock,
  IconSkull,
} from "@tabler/icons-react";
import {
  ClinicalEventProvider,
  PageHeader,
  type RailGroup,
  type RailItem,
  WorkspaceRail,
} from "@/components";
import { BirthsTab } from "@/components/Mrd/BirthsTab";
import { CaseSheetsTab } from "@/components/Mrd/CaseSheetsTab";
import { DeathsTab } from "@/components/Mrd/DeathsTab";
import { DigitizeTab } from "@/components/Mrd/DigitizeTab";
import { RecordsTab } from "@/components/Mrd/RecordsTab";
import { RetentionTab } from "@/components/Mrd/RetentionTab";
import { RoiTab } from "@/components/Mrd/RoiTab";
import { SignatureVerifyPanel } from "@/components/Mrd/SignatureVerifyPanel";
import { StatsTab } from "@/components/Mrd/StatsTab";
import { StorageLocationsTab } from "@/components/Mrd/StorageLocationsTab";
import { useHashTabs } from "@/hooks/useHashTabs";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import styles from "./mrd.module.scss";

// Every rail section value, in priority order for default selection.
const MRD_TAB_VALUES = [
  "records",
  "case-sheets",
  "verify",
  "digitize",
  "births",
  "deaths",
  "roi",
  "storage",
  "retention",
  "stats",
] as const;

const MRD_PAGE_PERMISSIONS = [
  P.MRD.RECORDS_LIST,
  P.MRD.RECORDS_MANAGE,
  P.MRD.CASE_SHEETS_VIEW,
  P.MRD.BIRTHS_LIST,
  P.MRD.DEATHS_LIST,
  P.MRD.FORMS_VIEW,
] as const;

// ══════════════════════════════════════════════════════════
//  Page
// ══════════════════════════════════════════════════════════

export function MrdPage() {
  return (
    <ClinicalEventProvider moduleCode="mrd" contextCode="mrd-page">
      <MrdPageInner />
    </ClinicalEventProvider>
  );
}

function MrdPageInner() {
  useRequirePermission(MRD_PAGE_PERMISSIONS);
  const canViewRecords = useHasPermission(P.MRD.RECORDS_LIST);
  const canManageRecords = useHasPermission(P.MRD.RECORDS_MANAGE);
  const canViewCaseSheets = useHasPermission(P.MRD.CASE_SHEETS_VIEW);
  const canViewBirths = useHasPermission(P.MRD.BIRTHS_LIST);
  const canViewDeaths = useHasPermission(P.MRD.DEATHS_LIST);
  const canVerifySignatures = useHasPermission(P.DOCTOR.SIGNATURE.VERIFY);

  // Rail groups mirror how an MRD department runs the chart lifecycle. Items are
  // omitted when the user lacks the permission; an emptied group disappears.
  const groups: RailGroup[] = [
    {
      label: "Case records",
      items: [
        canViewRecords && {
          value: "records",
          label: "Records",
          icon: <IconFileCertificate size={14} />,
        },
        canViewCaseSheets && {
          value: "case-sheets",
          label: "Case Sheets",
          icon: <IconClipboardList size={14} />,
        },
        canVerifySignatures && {
          value: "verify",
          label: "Verify",
          icon: <IconShieldLock size={14} />,
        },
      ].filter(Boolean) as RailItem[],
    },
    {
      label: "Digital MRD",
      items: [
        canViewRecords && { value: "digitize", label: "Digitise", icon: <IconScan size={14} /> },
      ].filter(Boolean) as RailItem[],
    },
    {
      label: "Statutory registers",
      items: [
        canViewBirths && {
          value: "births",
          label: "Birth Register",
          icon: <IconBabyCarriage size={14} />,
        },
        canViewDeaths && {
          value: "deaths",
          label: "Death Register",
          icon: <IconSkull size={14} />,
        },
      ].filter(Boolean) as RailItem[],
    },
    {
      label: "Release of information",
      items: [
        canViewRecords && {
          value: "roi",
          label: "Release of Info",
          icon: <IconFileExport size={14} />,
        },
      ].filter(Boolean) as RailItem[],
    },
    {
      label: "Records management",
      items: [
        canViewRecords && {
          value: "storage",
          label: "Storage",
          icon: <IconArchive size={14} />,
        },
        canManageRecords && {
          value: "retention",
          label: "Retention Policies",
          icon: <IconShieldCheck size={14} />,
        },
        canViewRecords && {
          value: "stats",
          label: "Statistics",
          icon: <IconChartBar size={14} />,
        },
      ].filter(Boolean) as RailItem[],
    },
  ];

  const accessibleTabs = new Set(groups.flatMap((g) => g.items.map((i) => i.value)));
  const defaultTab = MRD_TAB_VALUES.find((v) => accessibleTabs.has(v)) ?? "records";
  const [tab, setTab] = useHashTabs(defaultTab, MRD_TAB_VALUES);
  const tabValue = accessibleTabs.has(tab) ? tab : defaultTab;

  return (
    <Box className={styles.page}>
      <PageHeader
        title="Medical Records Department"
        subtitle="Record indexing, digitisation, registries, release of information & statistics"
      />
      <Box className={styles.workspace}>
        <WorkspaceRail groups={groups} active={tabValue} onChange={setTab}>
          {canViewRecords && (
            <Tabs.Panel value="records">
              <RecordsTab />
            </Tabs.Panel>
          )}
          {canViewCaseSheets && (
            <Tabs.Panel value="case-sheets">
              <CaseSheetsTab />
            </Tabs.Panel>
          )}
          {canVerifySignatures && (
            <Tabs.Panel value="verify">
              <SignatureVerifyPanel />
            </Tabs.Panel>
          )}
          {canViewRecords && (
            <Tabs.Panel value="digitize">
              <DigitizeTab />
            </Tabs.Panel>
          )}
          {canViewBirths && (
            <Tabs.Panel value="births">
              <BirthsTab />
            </Tabs.Panel>
          )}
          {canViewDeaths && (
            <Tabs.Panel value="deaths">
              <DeathsTab />
            </Tabs.Panel>
          )}
          {canViewRecords && (
            <Tabs.Panel value="roi">
              <RoiTab />
            </Tabs.Panel>
          )}
          {canViewRecords && (
            <Tabs.Panel value="storage">
              <StorageLocationsTab />
            </Tabs.Panel>
          )}
          {canManageRecords && (
            <Tabs.Panel value="retention">
              <RetentionTab />
            </Tabs.Panel>
          )}
          {canViewRecords && (
            <Tabs.Panel value="stats">
              <StatsTab />
            </Tabs.Panel>
          )}
        </WorkspaceRail>
      </Box>
    </Box>
  );
}

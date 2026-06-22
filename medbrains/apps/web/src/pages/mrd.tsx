import { Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconArchive,
  IconBabyCarriage,
  IconChartBar,
  IconClipboardCheck,
  IconClipboardList,
  IconFileCertificate,
  IconFileExport,
  IconScan,
  IconShieldCheck,
  IconShieldLock,
  IconSkull,
} from "@tabler/icons-react";
import { ClinicalEventProvider, PageHeader } from "@/components";
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

const MRD_TAB_VALUES = [
  "records",
  "case-sheets",
  "forms",
  "storage",
  "births",
  "deaths",
  "stats",
  "retention",
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
  const canViewForms = useHasPermission(P.MRD.FORMS_VIEW);
  const canVerifySignatures = useHasPermission(P.DOCTOR.SIGNATURE.VERIFY);
  const defaultTab = canViewRecords
    ? "records"
    : canViewCaseSheets
      ? "case-sheets"
      : canViewForms
        ? "forms"
        : canViewBirths
          ? "births"
          : canViewDeaths
            ? "deaths"
            : "retention";
  const accessibleTabs = new Set<string>([
    ...(canViewRecords ? ["records", "storage", "stats"] : []),
    ...(canViewCaseSheets ? ["case-sheets"] : []),
    ...(canViewForms ? ["forms"] : []),
    ...(canViewBirths ? ["births"] : []),
    ...(canViewDeaths ? ["deaths"] : []),
    ...(canManageRecords ? ["retention"] : []),
  ]);
  const [tab, setTab] = useHashTabs(defaultTab, MRD_TAB_VALUES);
  const tabValue = accessibleTabs.has(tab) ? tab : defaultTab;

  return (
    <div>
      <PageHeader
        title="Medical Records Department"
        subtitle="Record indexing, birth/death registries, statistics"
      />
      <Tabs value={tabValue} onChange={setTab}>
        <Tabs.List>
          {canViewRecords && (
            <Tabs.Tab value="records" leftSection={<IconFileCertificate size={16} />}>
              Records
            </Tabs.Tab>
          )}
          {canViewCaseSheets && (
            <Tabs.Tab value="case-sheets" leftSection={<IconClipboardList size={16} />}>
              Case Sheets
            </Tabs.Tab>
          )}
          {canViewForms && (
            <Tabs.Tab value="forms" leftSection={<IconClipboardCheck size={16} />}>
              Form Records
            </Tabs.Tab>
          )}
          {canViewRecords && (
            <Tabs.Tab value="roi" leftSection={<IconFileExport size={16} />}>
              Release of Info
            </Tabs.Tab>
          )}
          {canViewRecords && (
            <Tabs.Tab value="digitize" leftSection={<IconScan size={16} />}>
              Digitise
            </Tabs.Tab>
          )}
          {canViewRecords && (
            <Tabs.Tab value="storage" leftSection={<IconArchive size={16} />}>
              Storage
            </Tabs.Tab>
          )}
          {canViewBirths && (
            <Tabs.Tab value="births" leftSection={<IconBabyCarriage size={16} />}>
              Birth Register
            </Tabs.Tab>
          )}
          {canViewDeaths && (
            <Tabs.Tab value="deaths" leftSection={<IconSkull size={16} />}>
              Death Register
            </Tabs.Tab>
          )}
          {canViewRecords && (
            <Tabs.Tab value="stats" leftSection={<IconChartBar size={16} />}>
              Statistics
            </Tabs.Tab>
          )}
          {canManageRecords && (
            <Tabs.Tab value="retention" leftSection={<IconShieldCheck size={16} />}>
              Retention Policies
            </Tabs.Tab>
          )}
          {canVerifySignatures && (
            <Tabs.Tab value="verify" leftSection={<IconShieldLock size={16} />}>
              Verify
            </Tabs.Tab>
          )}
        </Tabs.List>

        {canViewRecords && (
          <Tabs.Panel value="records" pt="md">
            <RecordsTab />
          </Tabs.Panel>
        )}
        {canViewCaseSheets && (
          <Tabs.Panel value="case-sheets" pt="md">
            <CaseSheetsTab />
          </Tabs.Panel>
        )}
        {canViewRecords && (
          <Tabs.Panel value="roi" pt="md">
            <RoiTab />
          </Tabs.Panel>
        )}
        {canViewRecords && (
          <Tabs.Panel value="digitize" pt="md">
            <DigitizeTab />
          </Tabs.Panel>
        )}
        {canViewRecords && (
          <Tabs.Panel value="storage" pt="md">
            <StorageLocationsTab />
          </Tabs.Panel>
        )}
        {canViewBirths && (
          <Tabs.Panel value="births" pt="md">
            <BirthsTab />
          </Tabs.Panel>
        )}
        {canViewDeaths && (
          <Tabs.Panel value="deaths" pt="md">
            <DeathsTab />
          </Tabs.Panel>
        )}
        {canViewRecords && (
          <Tabs.Panel value="stats" pt="md">
            <StatsTab />
          </Tabs.Panel>
        )}
        {canManageRecords && (
          <Tabs.Panel value="retention" pt="md">
            <RetentionTab />
          </Tabs.Panel>
        )}
        {canVerifySignatures && (
          <Tabs.Panel value="verify" pt="md">
            <SignatureVerifyPanel />
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
}

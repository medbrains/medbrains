// Privacy & CERT-In compliance: the DPDP Act 2023 / Rules 2025 and CERT-In
// 2022 duties in one place — gaps, officers, policy pack, grievances and
// drills — linking the consent ledger, breach clock and processor register
// that already live elsewhere.

import { Anchor, Group, Stack, Tabs, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconAlarm,
  IconFileText,
  IconLayoutDashboard,
  IconMessageReport,
  IconUserShield,
} from "@tabler/icons-react";
import { Link, useSearchParams } from "react-router";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { PrivacyRequestsTab } from "@/pages/audit/PrivacyRequestsTab";
import { CounselNotice } from "./CounselNotice";
import { DrillsTab } from "./DrillsTab";
import { OfficersTab } from "./OfficersTab";
import { OverviewTab } from "./OverviewTab";
import { PoliciesTab } from "./PoliciesTab";

const TABS = ["overview", "officers", "policies", "grievances", "drills"];

export function PrivacyCompliancePage() {
  useRequirePermission(P.REGULATORY.DPDP.VIEW);
  const canGrievances = useHasPermission(P.PATIENTS.PRIVACY_REQUESTS.LIST);
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab") ?? "overview";
  const tab =
    TABS.includes(requested) && (requested !== "grievances" || canGrievances)
      ? requested
      : "overview";
  const openTab = (t: string | null) => setParams({ tab: t ?? "overview" }, { replace: true });
  return (
    <Stack>
      <PageHeader
        title="Privacy & CERT-In compliance"
        subtitle="DPDP Act 2023, DPDP Rules 2025 and CERT-In directions of 28 April 2022"
      />
      <CounselNotice />
      <Group gap="md">
        <Text size="sm">Also kept elsewhere:</Text>
        <Anchor component={Link} to="/security?tab=incidents" size="sm">
          Breach register and clocks
        </Anchor>
        <Anchor component={Link} to="/audit?tab=processors" size="sm">
          Data processor register
        </Anchor>
        <Text size="sm" c="dimmed">
          Consent is recorded on each patient's record (Privacy consent).
        </Text>
      </Group>
      <Tabs value={tab} onChange={openTab} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconLayoutDashboard size={16} />}>
            Overview
          </Tabs.Tab>
          <Tabs.Tab value="officers" leftSection={<IconUserShield size={16} />}>
            Officers
          </Tabs.Tab>
          <Tabs.Tab value="policies" leftSection={<IconFileText size={16} />}>
            Policy pack
          </Tabs.Tab>
          {canGrievances && (
            <Tabs.Tab value="grievances" leftSection={<IconMessageReport size={16} />}>
              Grievances and requests
            </Tabs.Tab>
          )}
          <Tabs.Tab value="drills" leftSection={<IconAlarm size={16} />}>
            Breach drills
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="overview" pt="md">
          <OverviewTab onOpenTab={openTab} />
        </Tabs.Panel>
        <Tabs.Panel value="officers" pt="md">
          <OfficersTab />
        </Tabs.Panel>
        <Tabs.Panel value="policies" pt="md">
          <PoliciesTab />
        </Tabs.Panel>
        {canGrievances && (
          <Tabs.Panel value="grievances" pt="md">
            <Stack>
              <Text size="sm" c="dimmed">
                Every request and grievance must be answered within 90 days of receipt (DPDP Rules
                2025, r.14(3)). Patients see the published grievance contact on the portal and the
                printed notice (r.9).
              </Text>
              <PrivacyRequestsTab />
            </Stack>
          </Tabs.Panel>
        )}
        <Tabs.Panel value="drills" pt="md">
          <DrillsTab />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

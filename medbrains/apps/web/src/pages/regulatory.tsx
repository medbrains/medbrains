import "@mantine/charts/styles.css";
import { Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconCalendarEvent,
  IconChecklist,
  IconDashboard,
  IconFileAlert,
  IconFlask,
  IconLicense,
  IconScale,
  IconUpload,
  IconUsers,
} from "@tabler/icons-react";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { AdrTab } from "./regulatory/adr-tab";
import { CalendarTab } from "./regulatory/calendar-tab";
import { ChecklistsTab } from "./regulatory/checklists-tab";
import { DashboardTab } from "./regulatory/dashboard-tab";
import { LicenseDashboardTab } from "./regulatory/license-dashboard-tab";
import { MockSurveysTab } from "./regulatory/mock-surveys-tab";
import { NablDocumentsTab } from "./regulatory/nabl-documents-tab";
import { PcpndtTab } from "./regulatory/pcpndt-tab";
import { StaffCredentialsTab } from "./regulatory/staff-credentials-tab";
import { SubmissionsTab } from "./regulatory/submissions-tab";

/**
 * The compliance workspace. A tab shows only to someone the server lets read
 * it, so no tab opens onto a refused fetch (each gate is its list route's).
 */
export function RegulatoryPage() {
  useRequirePermission(P.REGULATORY.DASHBOARD_VIEW);
  const canChecklists = useHasPermission(P.REGULATORY.CHECKLISTS_LIST);
  const canAdr = useHasPermission(P.REGULATORY.ADR_LIST);
  const canMv = useHasPermission(P.REGULATORY.MATERIOVIGILANCE_LIST);
  const canPcpndt = useHasPermission(P.REGULATORY.PCPNDT_LIST);
  // The submissions list is served to calendar managers (list_submissions).
  const canSubmissions = useHasPermission(P.REGULATORY.CALENDAR_MANAGE);

  return (
    <Tabs defaultValue="dashboard">
      <Tabs.List>
        <Tabs.Tab value="dashboard" leftSection={<IconDashboard size={16} />}>
          Dashboard
        </Tabs.Tab>
        {canChecklists && (
          <Tabs.Tab value="checklists" leftSection={<IconChecklist size={16} />}>
            Checklists
          </Tabs.Tab>
        )}
        {(canAdr || canMv) && (
          <Tabs.Tab value="adr" leftSection={<IconFileAlert size={16} />}>
            ADR & Device Reports
          </Tabs.Tab>
        )}
        {canPcpndt && (
          <Tabs.Tab value="pcpndt" leftSection={<IconScale size={16} />}>
            PCPNDT Forms
          </Tabs.Tab>
        )}
        <Tabs.Tab value="calendar" leftSection={<IconCalendarEvent size={16} />}>
          Compliance Calendar
        </Tabs.Tab>
        {canSubmissions && (
          <Tabs.Tab value="submissions" leftSection={<IconUpload size={16} />}>
            Submissions
          </Tabs.Tab>
        )}
        <Tabs.Tab value="mock-surveys" leftSection={<IconChecklist size={16} />}>
          Mock Surveys
        </Tabs.Tab>
        <Tabs.Tab value="staff-credentials" leftSection={<IconUsers size={16} />}>
          Staff Credentials
        </Tabs.Tab>
        <Tabs.Tab value="licenses" leftSection={<IconLicense size={16} />}>
          License Dashboard
        </Tabs.Tab>
        <Tabs.Tab value="nabl" leftSection={<IconFlask size={16} />}>
          NABL Documents
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="dashboard" pt="md">
        <DashboardTab />
      </Tabs.Panel>
      {canChecklists && (
        <Tabs.Panel value="checklists" pt="md">
          <ChecklistsTab />
        </Tabs.Panel>
      )}
      {(canAdr || canMv) && (
        <Tabs.Panel value="adr" pt="md">
          <AdrTab />
        </Tabs.Panel>
      )}
      {canPcpndt && (
        <Tabs.Panel value="pcpndt" pt="md">
          <PcpndtTab />
        </Tabs.Panel>
      )}
      <Tabs.Panel value="calendar" pt="md">
        <CalendarTab />
      </Tabs.Panel>
      {canSubmissions && (
        <Tabs.Panel value="submissions" pt="md">
          <SubmissionsTab />
        </Tabs.Panel>
      )}
      <Tabs.Panel value="mock-surveys" pt="md">
        <MockSurveysTab />
      </Tabs.Panel>
      <Tabs.Panel value="staff-credentials" pt="md">
        <StaffCredentialsTab />
      </Tabs.Panel>
      <Tabs.Panel value="licenses" pt="md">
        <LicenseDashboardTab />
      </Tabs.Panel>
      <Tabs.Panel value="nabl" pt="md">
        <NablDocumentsTab />
      </Tabs.Panel>
    </Tabs>
  );
}

// ══════════════════════════════════════════════════════════
//  Dashboard Tab
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Checklists Tab
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  ADR & Device Reports Tab
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Submissions Tab
// ══════════════════════════════════════════════════════════

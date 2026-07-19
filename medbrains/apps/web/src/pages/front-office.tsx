import { EnquiryDeskTab } from "./front-office/enquiry-desk-tab";
import { PatientFlowHub } from "./front-office/patient-flow-hub";
import { QueueConfigTab } from "./front-office/queue-config-tab";
import { QueueDashboardTab } from "./front-office/queue-dashboard-tab";
import { QueueMetricsTab } from "./front-office/queue-metrics-tab";
import {
  BILLING_BOARD,
  EMERGENCY_BOARD,
  LAB_BOARD,
  OPD_BOARD,
  PHARMACY_BOARD,
  RADIOLOGY_BOARD,
} from "./front-office/shared";
import { TokenBoardsTab } from "./front-office/token-boards-tab";
import { VisitorAnalyticsTab } from "./front-office/visitor-analytics-tab";
import { VisitorManagementTab } from "./front-office/visitor-management-tab";
import "@mantine/charts/styles.css";
import { Box, Tabs } from "@mantine/core";
import { useHasAnyPermission, useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconChartBar,
  IconDeviceTv,
  IconDoorEnter,
  IconGauge,
  IconPhone,
  IconSettings,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { PageHeader } from "@/components";
import { useHashTabs } from "@/hooks/useHashTabs";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import {
  tokenBoardDisplayModeFromSearchParams,
  tokenBoardFilterFromSearchParams,
} from "./front-office-token-boards";

// ── Constants ──────────────────────────────────────────

const FRONT_OFFICE_TAB_VALUES = [
  "patient-flow",
  "queue",
  "token-boards",
  "visitors",
  "config",
  "enquiry",
  "analytics",
  "metrics",
] as const;

type FrontOfficeTabValue = (typeof FRONT_OFFICE_TAB_VALUES)[number];

const FRONT_OFFICE_PAGE_PERMISSIONS: readonly string[] = [
  P.FRONT_OFFICE.VISITORS_LIST,
  P.FRONT_OFFICE.VISITORS_CREATE,
  P.FRONT_OFFICE.VISITORS_MANAGE,
  P.FRONT_OFFICE.PASSES_LIST,
  P.FRONT_OFFICE.PASSES_MANAGE,
  P.FRONT_OFFICE.QUEUE_LIST,
  P.FRONT_OFFICE.QUEUE_MANAGE,
  P.FRONT_OFFICE.ENQUIRY_LIST,
  P.FRONT_OFFICE.ENQUIRY_CREATE,
  P.FRONT_OFFICE.ENQUIRY_MANAGE,
  P.PATIENTS.CREATE,
  P.OPD.VISIT_CREATE,
  P.EMERGENCY.VISITS_CREATE,
  P.BILLING.INVOICES_CREATE,
];

interface FrontOfficeTabConfig {
  value: FrontOfficeTabValue;
  label: string;
  icon: ReactNode;
}

// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════

export function FrontOfficePage() {
  useRequirePermission(FRONT_OFFICE_PAGE_PERMISSIONS);

  const navigate = useNavigate();
  const location = useLocation();
  const [requestedTab, setRequestedTab] = useHashTabs("patient-flow", FRONT_OFFICE_TAB_VALUES);
  const canViewVisitors = useHasPermission(P.FRONT_OFFICE.VISITORS_LIST);
  const canManageVisitors = useHasPermission(P.FRONT_OFFICE.VISITORS_MANAGE);
  const canCreateVisitors = useHasPermission(P.FRONT_OFFICE.VISITORS_CREATE);
  const canViewPasses = useHasPermission(P.FRONT_OFFICE.PASSES_LIST);
  const canManagePasses = useHasPermission(P.FRONT_OFFICE.PASSES_MANAGE);
  const canViewQueue = useHasPermission(P.FRONT_OFFICE.QUEUE_LIST);
  const canManageQueue = useHasPermission(P.FRONT_OFFICE.QUEUE_MANAGE);
  const canViewEnquiry = useHasPermission(P.FRONT_OFFICE.ENQUIRY_LIST);
  const canCreateEnquiry = useHasPermission(P.FRONT_OFFICE.ENQUIRY_CREATE);
  const canManageEnquiry = useHasPermission(P.FRONT_OFFICE.ENQUIRY_MANAGE);
  const canRegisterPatient = useHasPermission(P.PATIENTS.CREATE);
  const canCreateOpdVisit = useHasPermission(P.OPD.VISIT_CREATE);
  const canViewOpdQueue = useHasAnyPermission(OPD_BOARD.requiredAnyPermissions);
  const canViewLab = useHasAnyPermission(LAB_BOARD.requiredAnyPermissions);
  const canViewRadiology = useHasAnyPermission(RADIOLOGY_BOARD.requiredAnyPermissions);
  const canCreateEmergencyVisit = useHasPermission(P.EMERGENCY.VISITS_CREATE);
  const canViewEmergency = useHasAnyPermission(EMERGENCY_BOARD.requiredAnyPermissions);
  const canViewCamp = useHasPermission(P.CAMP.LIST);
  const canCreateCampRegistration = useHasPermission(P.CAMP.REGISTRATIONS_CREATE);
  const canViewBilling = useHasAnyPermission(BILLING_BOARD.requiredAnyPermissions);
  const canCreateBilling = useHasPermission(P.BILLING.INVOICES_CREATE);
  const canViewPharmacy = useHasAnyPermission(PHARMACY_BOARD.requiredAnyPermissions);
  const canViewIndent = useHasPermission(P.INDENT.LIST);
  const canViewProcurementStores = useHasPermission(P.PROCUREMENT.STORES_LIST);
  const canViewAssets = useHasPermission(P.ASSETS.LIST);
  const canViewIpd = useHasPermission(P.IPD.ADMISSIONS_LIST);
  const canCreateIpdAdmission = useHasPermission(P.IPD.ADMISSIONS_CREATE);
  const canViewAnyTokenBoard =
    canViewOpdQueue ||
    canViewLab ||
    canViewRadiology ||
    canViewEmergency ||
    canViewPharmacy ||
    canViewBilling;
  const canOpenPatientFlow =
    canRegisterPatient ||
    canCreateOpdVisit ||
    canViewOpdQueue ||
    canViewAnyTokenBoard ||
    canCreateEmergencyVisit ||
    canViewEmergency ||
    canViewCamp ||
    canCreateCampRegistration ||
    canViewBilling ||
    canCreateBilling ||
    canViewPharmacy ||
    canViewIndent ||
    canViewProcurementStores ||
    canViewAssets ||
    canViewIpd ||
    canCreateIpdAdmission;
  const canOpenVisitors = canViewVisitors && canViewPasses;
  const canOpenQueueConfig = canViewQueue && canViewVisitors;
  const visibleTabs: FrontOfficeTabConfig[] = [];
  if (canOpenPatientFlow) {
    visibleTabs.push({
      value: "patient-flow",
      label: "Patient Flow",
      icon: <IconUserPlus size={16} />,
    });
  }
  if (canViewQueue) {
    visibleTabs.push({
      value: "queue",
      label: "Queue Dashboard",
      icon: <IconUsers size={16} />,
    });
  }
  if (canViewAnyTokenBoard) {
    visibleTabs.push({
      value: "token-boards",
      label: "Token Boards",
      icon: <IconDeviceTv size={16} />,
    });
  }
  if (canOpenVisitors) {
    visibleTabs.push({
      value: "visitors",
      label: "Visitor Management",
      icon: <IconDoorEnter size={16} />,
    });
  }
  if (canOpenQueueConfig) {
    visibleTabs.push({
      value: "config",
      label: "Queue Configuration",
      icon: <IconSettings size={16} />,
    });
  }
  if (canViewEnquiry) {
    visibleTabs.push({
      value: "enquiry",
      label: "Enquiry Desk",
      icon: <IconPhone size={16} />,
    });
  }
  if (canViewVisitors) {
    visibleTabs.push({
      value: "analytics",
      label: "Visitor Analytics",
      icon: <IconChartBar size={16} />,
    });
  }
  if (canViewQueue) {
    visibleTabs.push({
      value: "metrics",
      label: "Queue Metrics",
      icon: <IconGauge size={16} />,
    });
  }
  const activeTab = visibleTabs.some((tab) => tab.value === requestedTab)
    ? requestedTab
    : (visibleTabs[0]?.value ?? null);
  const tokenBoardSearchParams = new URLSearchParams(location.search);
  const tokenBoardDisplayMode = tokenBoardDisplayModeFromSearchParams(tokenBoardSearchParams);
  const tokenBoardRouteFilter = tokenBoardFilterFromSearchParams(tokenBoardSearchParams);
  const isTokenBoardKioskMode =
    tokenBoardDisplayMode === "kiosk" && tokenBoardRouteFilter !== "all";

  if (isTokenBoardKioskMode) {
    return (
      <Box mih="100vh" p={{ base: "md", lg: "xl" }} style={{ background: "var(--mb-bg-default)" }}>
        <TokenBoardsTab
          canViewOpdQueue={canViewOpdQueue}
          canViewLab={canViewLab}
          canViewRadiology={canViewRadiology}
          canViewEmergency={canViewEmergency}
          canViewPharmacy={canViewPharmacy}
          canViewBilling={canViewBilling}
        />
      </Box>
    );
  }

  return (
    <div>
      <PageHeader
        title="Front Office"
        subtitle="Reception command center linked to registration, OPD, ER, billing, stores and visitor workflows"
      />
      <Tabs value={activeTab} onChange={setRequestedTab}>
        <Tabs.List>
          {visibleTabs.map((tab) => (
            <Tabs.Tab key={tab.value} value={tab.value} leftSection={tab.icon}>
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        {canOpenPatientFlow && (
          <Tabs.Panel value="patient-flow" pt="md">
            <PatientFlowHub
              navigate={navigate}
              canRegisterPatient={canRegisterPatient}
              canCreateOpdVisit={canCreateOpdVisit}
              canViewOpdQueue={canViewOpdQueue}
              canViewAnyTokenBoard={canViewAnyTokenBoard}
              canCreateEmergencyVisit={canCreateEmergencyVisit}
              canViewEmergency={canViewEmergency}
              canViewCamp={canViewCamp}
              canCreateCampRegistration={canCreateCampRegistration}
              canViewBilling={canViewBilling}
              canCreateBilling={canCreateBilling}
              canViewPharmacy={canViewPharmacy}
              canViewIndent={canViewIndent}
              canViewProcurementStores={canViewProcurementStores}
              canViewAssets={canViewAssets}
              canViewIpd={canViewIpd}
              canCreateIpdAdmission={canCreateIpdAdmission}
            />
          </Tabs.Panel>
        )}
        {canViewQueue && (
          <Tabs.Panel value="queue" pt="md">
            <QueueDashboardTab />
          </Tabs.Panel>
        )}
        {canViewAnyTokenBoard && (
          <Tabs.Panel value="token-boards" pt="md">
            <TokenBoardsTab
              canViewOpdQueue={canViewOpdQueue}
              canViewLab={canViewLab}
              canViewRadiology={canViewRadiology}
              canViewEmergency={canViewEmergency}
              canViewPharmacy={canViewPharmacy}
              canViewBilling={canViewBilling}
            />
          </Tabs.Panel>
        )}
        {canOpenVisitors && (
          <Tabs.Panel value="visitors" pt="md">
            <VisitorManagementTab canCreate={canCreateVisitors} canManagePasses={canManagePasses} />
          </Tabs.Panel>
        )}
        {canOpenQueueConfig && (
          <Tabs.Panel value="config" pt="md">
            <QueueConfigTab canManage={canManageQueue} canManageVisitors={canManageVisitors} />
          </Tabs.Panel>
        )}
        {canViewEnquiry && (
          <Tabs.Panel value="enquiry" pt="md">
            <EnquiryDeskTab canCreate={canCreateEnquiry} canManage={canManageEnquiry} />
          </Tabs.Panel>
        )}
        {canViewVisitors && (
          <Tabs.Panel value="analytics" pt="md">
            <VisitorAnalyticsTab />
          </Tabs.Panel>
        )}
        {canViewQueue && (
          <Tabs.Panel value="metrics" pt="md">
            <QueueMetricsTab />
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 1 — Patient Flow
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Tab 4 — Visitor Management
// ══════════════════════════════════════════════════════════

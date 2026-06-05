import { zodResolver } from "@hookform/resolvers/zod";
import "@mantine/charts/styles.css";
import { BarChart } from "@mantine/charts";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Drawer,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasAnyPermission, useHasPermission } from "@medbrains/stores";
import type {
  BillingQueueDisplay,
  BillingQueueToken,
  ClinicalJourneyActionDefinition,
  ClinicalJourneyActionId,
  ErQueueDisplay,
  ErTriageToken,
  FrontOfficeEnquiryLog,
  LabQueueDisplay,
  LabQueueToken,
  PharmacyQueueDisplay,
  PharmacyQueueToken,
  QueueDisplayConfig,
  QueueMetrics,
  QueuePriority,
  QueuePriorityRule,
  QueueStatsResponse,
  QueueToken,
  RadiologyQueueDisplay,
  RadiologyQueueToken,
  TriageLevelColor,
  VisitingHours,
  VisitorAnalytics,
  VisitorLog,
  VisitorPass,
  VisitorRegistration,
} from "@medbrains/types";
import {
  CORE_PATIENT_JOURNEY_ACTIONS,
  P,
  TOKEN_BOARD_PUBLIC_PRIVACY_NOTICE,
  TOKEN_BOARD_SURFACE_LIST,
  TOKEN_BOARD_SURFACES,
} from "@medbrains/types";
import {
  IconAmbulance,
  IconArrowRight,
  IconBed,
  IconBuildingStore,
  IconChartBar,
  IconCheck,
  IconClock,
  IconDeviceTv,
  IconDoorEnter,
  IconGauge,
  IconMapPin,
  IconPackage,
  IconPhone,
  IconPill,
  IconPlus,
  IconQrcode,
  IconReceipt,
  IconSettings,
  IconStethoscope,
  IconUserPlus,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { DataTable, PageHeader, TableValueBadge } from "@/components";
import type { Column } from "@/components/DataTable";
import {
  DAY_OPTIONS,
  DEFAULT_DISPLAY_CONFIG_FORM_VALUES,
  DEFAULT_ENQUIRY_FORM_VALUES,
  DEFAULT_QUEUE_PRIORITY_FORM_VALUES,
  DEFAULT_VISITING_HOURS_FORM_VALUES,
  DEFAULT_VISITOR_FORM_VALUES,
  DEFAULT_VISITOR_PASS_FORM_VALUES,
  DISPLAY_TYPE_OPTIONS,
  ENQUIRY_TYPE_OPTIONS,
  type FrontOfficeDisplayConfigFormInput,
  type FrontOfficeEnquiryFormInput,
  type FrontOfficeQueuePriorityFormInput,
  type FrontOfficeVisitingHoursFormInput,
  type FrontOfficeVisitorFormInput,
  type FrontOfficeVisitorPassFormInput,
  frontOfficeDisplayConfigFormSchema,
  frontOfficeEnquiryFormSchema,
  frontOfficeQueuePriorityFormSchema,
  frontOfficeVisitingHoursFormSchema,
  frontOfficeVisitorFormSchema,
  frontOfficeVisitorPassFormSchema,
  QUEUE_PRIORITY_OPTIONS,
  toCreateEnquiryRequest,
  toCreateVisitorPassRequest,
  toCreateVisitorRequest,
  toUpsertDisplayConfigRequest,
  toUpsertQueuePriorityRequest,
  toUpsertVisitingHoursRequest,
  VISITOR_CATEGORY_OPTIONS,
  VISITOR_ID_TYPE_OPTIONS,
} from "@/forms/front-office.form";
import { useHashTabs } from "@/hooks/useHashTabs";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { frontOfficeService } from "@/services/frontOffice.service";

// ── Constants ──────────────────────────────────────────

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

const passStatusColors: Record<string, string> = {
  active: "success",
  expired: "slate",
  revoked: "danger",
};

const priorityColors: Record<string, string> = {
  normal: "slate",
  elderly: "orange",
  disabled: "primary",
  pregnant: "danger",
  emergency_referral: "danger",
  vip: "violet",
};

const OPD_BOARD = TOKEN_BOARD_SURFACES.opd;
const LAB_BOARD = TOKEN_BOARD_SURFACES.lab;
const RADIOLOGY_BOARD = TOKEN_BOARD_SURFACES.radiology;
const EMERGENCY_BOARD = TOKEN_BOARD_SURFACES.emergency;
const PHARMACY_BOARD = TOKEN_BOARD_SURFACES.pharmacy;
const BILLING_BOARD = TOKEN_BOARD_SURFACES.billing;

// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════

export function FrontOfficePage() {
  useRequirePermission(P.FRONT_OFFICE.QUEUE_LIST);

  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useHashTabs("patient-flow", FRONT_OFFICE_TAB_VALUES);
  const canManageVisitors = useHasPermission(P.FRONT_OFFICE.VISITORS_MANAGE);
  const canCreateVisitors = useHasPermission(P.FRONT_OFFICE.VISITORS_CREATE);
  const canManagePasses = useHasPermission(P.FRONT_OFFICE.PASSES_MANAGE);
  const canManageQueue = useHasPermission(P.FRONT_OFFICE.QUEUE_MANAGE);
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

  return (
    <div>
      <PageHeader
        title="Front Office"
        subtitle="Reception command center linked to registration, OPD, ER, billing, stores and visitor workflows"
      />
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="patient-flow" leftSection={<IconUserPlus size={16} />}>
            Patient Flow
          </Tabs.Tab>
          <Tabs.Tab value="queue" leftSection={<IconUsers size={16} />}>
            Queue Dashboard
          </Tabs.Tab>
          <Tabs.Tab value="token-boards" leftSection={<IconDeviceTv size={16} />}>
            Token Boards
          </Tabs.Tab>
          <Tabs.Tab value="visitors" leftSection={<IconDoorEnter size={16} />}>
            Visitor Management
          </Tabs.Tab>
          <Tabs.Tab value="config" leftSection={<IconSettings size={16} />}>
            Queue Configuration
          </Tabs.Tab>
          <Tabs.Tab value="enquiry" leftSection={<IconPhone size={16} />}>
            Enquiry Desk
          </Tabs.Tab>
          <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
            Visitor Analytics
          </Tabs.Tab>
          <Tabs.Tab value="metrics" leftSection={<IconGauge size={16} />}>
            Queue Metrics
          </Tabs.Tab>
        </Tabs.List>

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
        <Tabs.Panel value="queue" pt="md">
          <QueueDashboardTab />
        </Tabs.Panel>
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
        <Tabs.Panel value="visitors" pt="md">
          <VisitorManagementTab canCreate={canCreateVisitors} canManagePasses={canManagePasses} />
        </Tabs.Panel>
        <Tabs.Panel value="config" pt="md">
          <QueueConfigTab canManage={canManageQueue} canManageVisitors={canManageVisitors} />
        </Tabs.Panel>
        <Tabs.Panel value="enquiry" pt="md">
          <EnquiryDeskTab canCreate={canCreateEnquiry} canManage={canManageEnquiry} />
        </Tabs.Panel>
        <Tabs.Panel value="analytics" pt="md">
          <VisitorAnalyticsTab />
        </Tabs.Panel>
        <Tabs.Panel value="metrics" pt="md">
          <QueueMetricsTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 1 — Patient Flow
// ══════════════════════════════════════════════════════════

interface PatientFlowHubProps {
  navigate: ReturnType<typeof useNavigate>;
  canRegisterPatient: boolean;
  canCreateOpdVisit: boolean;
  canViewOpdQueue: boolean;
  canViewAnyTokenBoard: boolean;
  canCreateEmergencyVisit: boolean;
  canViewEmergency: boolean;
  canViewCamp: boolean;
  canCreateCampRegistration: boolean;
  canViewBilling: boolean;
  canCreateBilling: boolean;
  canViewPharmacy: boolean;
  canViewIndent: boolean;
  canViewProcurementStores: boolean;
  canViewAssets: boolean;
  canViewIpd: boolean;
  canCreateIpdAdmission: boolean;
}

interface PatientFlowAction {
  title: string;
  module: string;
  description: string;
  path: string;
  enabled: boolean;
  icon: ReactNode;
  journeyActionId?: ClinicalJourneyActionId;
  activationEvents?: readonly string[];
  emittedEvent?: string;
  requiredPermissions?: readonly string[];
  standardRefs?: readonly string[];
}

function eventLabel(eventName: string) {
  return eventName.replace(/\./g, " ");
}

function patientFlowJourneyAction(
  actionId: ClinicalJourneyActionId | undefined,
): ClinicalJourneyActionDefinition | null {
  if (!actionId) return null;
  return CORE_PATIENT_JOURNEY_ACTIONS.find((action) => action.id === actionId) ?? null;
}

function patientFlowActionMetadata(action: PatientFlowAction) {
  const journeyAction = patientFlowJourneyAction(action.journeyActionId);

  return {
    activationEvents: action.activationEvents ?? journeyAction?.activatesAfter ?? [],
    description: journeyAction?.description ?? action.description,
    emittedEvent: action.emittedEvent ?? journeyAction?.emitsEvent ?? null,
    requiredPermissions: action.requiredPermissions ?? journeyAction?.requiredPermissions ?? [],
    standardRefs: action.standardRefs ?? journeyAction?.standardRefs ?? [],
  };
}

function PatientFlowHub({
  navigate,
  canRegisterPatient,
  canCreateOpdVisit,
  canViewOpdQueue,
  canViewAnyTokenBoard,
  canCreateEmergencyVisit,
  canViewEmergency,
  canViewCamp,
  canCreateCampRegistration,
  canViewBilling,
  canCreateBilling,
  canViewPharmacy,
  canViewIndent,
  canViewProcurementStores,
  canViewAssets,
  canViewIpd,
  canCreateIpdAdmission,
}: PatientFlowHubProps) {
  const actions: PatientFlowAction[] = [
    {
      title: "Register Patient",
      module: "Registration",
      description: "Create the patient record before OPD, ER, IPD or camp service.",
      path: "/patients/register",
      enabled: canRegisterPatient,
      icon: <IconUserPlus size={20} />,
      activationEvents: ["front.office.intake"],
      emittedEvent: "patient.created",
      requiredPermissions: [P.PATIENTS.CREATE],
      standardRefs: ["NABH AAC", "IPSG patient identification"],
    },
    {
      title: "Start OPD Visit",
      module: "OPD",
      description: "Create the visit, assign doctor and send the patient to the OPD queue.",
      path: "/opd/new",
      enabled: canCreateOpdVisit,
      icon: <IconStethoscope size={20} />,
      journeyActionId: "opd.open_visit",
    },
    {
      title: "OPD Queue",
      module: "OPD",
      description: "Track waiting patients, tokens and department queue load.",
      path: "/opd",
      enabled: canViewOpdQueue,
      icon: <IconUsers size={20} />,
    },
    {
      title: "Token Boards",
      module: "Displays",
      description: `Monitor public token feeds for ${TOKEN_BOARD_SURFACE_LIST.map(
        (surface) => surface.title,
      ).join(", ")}.`,
      path: "/front-office#token-boards",
      enabled: canViewAnyTokenBoard,
      icon: <IconDeviceTv size={20} />,
      requiredPermissions: TOKEN_BOARD_SURFACE_LIST.flatMap((surface) => [
        ...surface.requiredAnyPermissions,
      ]),
      standardRefs: TOKEN_BOARD_SURFACE_LIST.flatMap((surface) => [...surface.standardRefs]),
    },
    {
      title: "Emergency Desk",
      module: "ER",
      description: "Open ER visits, triage, MLC and critical flow from reception.",
      path: "/emergency",
      enabled: canCreateEmergencyVisit || canViewEmergency,
      icon: <IconAmbulance size={20} />,
      journeyActionId: "emergency.open_visit",
    },
    {
      title: "Camp Desk",
      module: "Camp",
      description: "Handle outreach registrations, screenings, samples and camp billing.",
      path: "/camp",
      enabled: canViewCamp || canCreateCampRegistration,
      icon: <IconMapPin size={20} />,
      journeyActionId: "camp.open_context",
    },
    {
      title: "Billing Counter",
      module: "Billing",
      description: "Create invoices, collect payments, advances and counter receipts.",
      path: "/billing",
      enabled: canViewBilling || canCreateBilling,
      icon: <IconReceipt size={20} />,
      journeyActionId: "billing.open_ledger",
    },
    {
      title: "Pharmacy Queue",
      module: "Pharmacy",
      description: "Send prescription and dispensing questions to the pharmacy counter.",
      path: "/pharmacy",
      enabled: canViewPharmacy,
      icon: <IconPill size={20} />,
      journeyActionId: "pharmacy.open_patient_queue",
    },
    {
      title: "IPD Admission",
      module: "IPD",
      description: "Route admitted patients to bed, ward and inpatient workflows.",
      path: "/ipd",
      enabled: canViewIpd || canCreateIpdAdmission,
      icon: <IconBed size={20} />,
      journeyActionId: "ipd.admit",
    },
    {
      title: "Store Indents",
      module: "Stores",
      description: "Check requisitions, stock movement, borrow and return workflows.",
      path: "/indent",
      enabled: canViewIndent,
      icon: <IconPackage size={20} />,
    },
    {
      title: "Procurement",
      module: "Stores",
      description: "Open vendors, POs, GRN and multi-store procurement operations.",
      path: "/procurement",
      enabled: canViewProcurementStores,
      icon: <IconBuildingStore size={20} />,
    },
    {
      title: "Assets",
      module: "Assets",
      description: "Reserve, issue, return and locate patient-facing equipment.",
      path: "/assets",
      enabled: canViewAssets,
      icon: <IconPackage size={20} />,
    },
  ];

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Text fw={600}>Reception workflow entry points</Text>
          <Text size="sm" c="dimmed">
            Front Office coordinates patient movement; the source records stay in their owning
            modules.
          </Text>
        </div>
        <Badge size="sm" variant="light" color="primary" leftSection={<IconDoorEnter size={12} />}>
          Intake
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {actions.map((action) => {
          const metadata = patientFlowActionMetadata(action);
          const permissionLabel =
            metadata.requiredPermissions.length > 1
              ? `${metadata.requiredPermissions[0]} +${metadata.requiredPermissions.length - 1}`
              : metadata.requiredPermissions[0];

          return (
            <Card key={action.title} withBorder padding="md">
              <Stack gap="sm" h="100%">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap">
                    <Badge
                      size="lg"
                      variant="light"
                      color={action.enabled ? "primary" : "slate"}
                      leftSection={action.icon}
                    >
                      {action.module}
                    </Badge>
                  </Group>
                  {!action.enabled && (
                    <Badge size="xs" variant="light" color="slate">
                      No access
                    </Badge>
                  )}
                </Group>
                <div>
                  <Text fw={600}>{action.title}</Text>
                  <Text size="sm" c="dimmed">
                    {metadata.description}
                  </Text>
                </div>
                {(metadata.activationEvents.length > 0 || metadata.emittedEvent) && (
                  <Group gap={4}>
                    {metadata.activationEvents.slice(0, 2).map((eventName) => (
                      <Badge key={eventName} size="xs" variant="light" color="blue">
                        after {eventLabel(eventName)}
                      </Badge>
                    ))}
                    {metadata.activationEvents.length > 2 && (
                      <Badge size="xs" variant="light" color="blue">
                        +{metadata.activationEvents.length - 2}
                      </Badge>
                    )}
                    {metadata.emittedEvent && (
                      <Badge size="xs" variant="light" color="green">
                        emits {eventLabel(metadata.emittedEvent)}
                      </Badge>
                    )}
                  </Group>
                )}
                {permissionLabel && (
                  <Tooltip label={metadata.requiredPermissions.join(" / ")}>
                    <Text size="xs" c="dimmed">
                      Permission: {permissionLabel}
                    </Text>
                  </Tooltip>
                )}
                {metadata.standardRefs.length > 0 && (
                  <Text size="xs" c="dimmed">
                    Standards: {metadata.standardRefs.slice(0, 2).join(" · ")}
                  </Text>
                )}
                <Button
                  mt="auto"
                  variant={action.enabled ? "light" : "subtle"}
                  rightSection={<IconArrowRight size={16} />}
                  disabled={!action.enabled}
                  onClick={() => navigate(action.path)}
                >
                  Open
                </Button>
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 2 — Queue Dashboard
// ══════════════════════════════════════════════════════════

function QueueDashboardTab() {
  const { data: stats, isLoading } = useQuery<QueueStatsResponse[]>({
    queryKey: ["front-office", "queue-stats"],
    queryFn: () => frontOfficeService.getQueueStats(),
  });

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Real-time queue statistics across departments (today)
      </Text>
      {isLoading && <Text size="sm">Loading...</Text>}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
        {stats?.map((s) => (
          <Card key={s.department_id ?? "all"} withBorder padding="md">
            <Text fw={600} size="sm">
              {s.department_id ?? "All Departments"}
            </Text>
            <Group mt="xs" gap="lg">
              <div>
                <Text size="xl" fw={700} c="primary">
                  {s.waiting_count}
                </Text>
                <Text size="xs" c="dimmed">
                  Waiting
                </Text>
              </div>
              <div>
                <Text size="xl" fw={700} c="orange">
                  {s.avg_wait_minutes != null ? `${Math.round(s.avg_wait_minutes)} min` : "—"}
                </Text>
                <Text size="xs" c="dimmed">
                  Avg Wait
                </Text>
              </div>
            </Group>
          </Card>
        ))}
        {stats?.length === 0 && (
          <Text size="sm" c="dimmed">
            No queue data for today
          </Text>
        )}
      </SimpleGrid>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 3 — Token Boards
// ══════════════════════════════════════════════════════════

const TOKEN_BOARD_REFRESH_MS = 10_000;
const ER_TOKEN_BOARD_REFRESH_MS = 5_000;
const TOKEN_BOARD_LIMIT = 8;

const TRIAGE_LANES: ReadonlyArray<{
  color: string;
  key: TriageLevelColor;
  label: string;
}> = [
  { color: "red", key: "red", label: "Red" },
  { color: "orange", key: "orange", label: "Orange" },
  { color: "yellow", key: "yellow", label: "Yellow" },
  { color: "green", key: "green", label: "Green" },
  { color: "blue", key: "blue", label: "Blue" },
];

interface TokenBoardsTabProps {
  canViewOpdQueue: boolean;
  canViewLab: boolean;
  canViewRadiology: boolean;
  canViewEmergency: boolean;
  canViewPharmacy: boolean;
  canViewBilling: boolean;
}

function TokenBoardsTab({
  canViewOpdQueue,
  canViewLab,
  canViewRadiology,
  canViewEmergency,
  canViewPharmacy,
  canViewBilling,
}: TokenBoardsTabProps) {
  const opdQuery = useQuery<QueueToken[]>({
    queryKey: ["front-office", "token-board", "opd"],
    queryFn: () => frontOfficeService.listQueueTokens(),
    enabled: canViewOpdQueue,
    refetchInterval: ER_TOKEN_BOARD_REFRESH_MS,
  });
  const pharmacyQuery = useQuery<PharmacyQueueDisplay>({
    queryKey: ["front-office", "token-board", "pharmacy"],
    queryFn: () => frontOfficeService.getPharmacyQueueDisplay(),
    enabled: canViewPharmacy,
    refetchInterval: TOKEN_BOARD_REFRESH_MS,
  });
  const billingQuery = useQuery<BillingQueueDisplay>({
    queryKey: ["front-office", "token-board", "billing"],
    queryFn: () => frontOfficeService.getBillingQueueDisplay(),
    enabled: canViewBilling,
    refetchInterval: TOKEN_BOARD_REFRESH_MS,
  });
  const erQuery = useQuery<ErQueueDisplay>({
    queryKey: ["front-office", "token-board", "er"],
    queryFn: () => frontOfficeService.getErQueueDisplay(),
    enabled: canViewEmergency,
    refetchInterval: ER_TOKEN_BOARD_REFRESH_MS,
  });
  const labQuery = useQuery<LabQueueDisplay>({
    queryKey: ["front-office", "token-board", "lab"],
    queryFn: () => frontOfficeService.getLabQueueDisplay(),
    enabled: canViewLab,
    refetchInterval: TOKEN_BOARD_REFRESH_MS,
  });
  const radiologyQuery = useQuery<RadiologyQueueDisplay>({
    queryKey: ["front-office", "token-board", "radiology", "xray"],
    queryFn: () => frontOfficeService.getRadiologyQueueDisplay("xray"),
    enabled: canViewRadiology,
    refetchInterval: TOKEN_BOARD_REFRESH_MS,
  });

  const opdTokens = opdQuery.data ?? [];
  const lab = labQuery.data;
  const radiology = radiologyQuery.data;
  const pharmacy = pharmacyQuery.data;
  const billing = billingQuery.data;
  const er = erQuery.data;
  const opdNowServing = opdTokens.filter(
    (token) => token.status === "called" || token.status === "in_progress",
  );
  const opdWaiting = opdTokens.filter((token) => token.status === "waiting");
  const currentPharmacy = pharmacy?.current_token ? [pharmacy.current_token] : [];
  const billingNowServing =
    billing?.ipd_discharge[0] ??
    billing?.insurance_desk[0] ??
    billing?.opd_billing[0] ??
    billing?.advance_deposit[0] ??
    null;
  const overdueErTokens = TRIAGE_LANES.reduce(
    (count, lane) => count + (er?.[lane.key] ?? []).filter((token) => token.is_overdue).length,
    0,
  );
  const canViewAnyBoard =
    canViewOpdQueue ||
    canViewLab ||
    canViewRadiology ||
    canViewEmergency ||
    canViewPharmacy ||
    canViewBilling;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Text fw={700}>Live token boards</Text>
          <Text size="sm" c="dimmed">
            Workstation view of public queue feeds. {TOKEN_BOARD_PUBLIC_PRIVACY_NOTICE} Reception,
            lab, radiology, ER, pharmacy and billing operations stay linked to the same token state.
          </Text>
        </Stack>
        <Badge variant="light" color="teal">
          Auto-refresh
        </Badge>
      </Group>

      {!canViewAnyBoard ? (
        <Card withBorder padding="md">
          <Text fw={600}>Token boards restricted</Text>
          <Text size="sm" c="dimmed">
            Queue-board visibility follows OPD, lab, radiology, emergency, pharmacy and billing
            permissions.
          </Text>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
          {canViewOpdQueue && (
            <TokenBoardCard
              title={OPD_BOARD.title}
              subtitle={OPD_BOARD.subtitle}
              isLoading={opdQuery.isLoading}
              isError={opdQuery.isError}
              lastUpdatedAt={opdQuery.dataUpdatedAt}
              summary={[
                { label: "Now", value: opdNowServing[0]?.token_number ?? "—" },
                { label: "Waiting", value: opdWaiting.length },
                {
                  label: "Priority",
                  value: opdWaiting.filter((t) => t.priority !== "normal").length,
                },
              ]}
            >
              <Stack gap="sm">
                <TokenLane
                  title="Now serving"
                  emptyLabel="No OPD token is currently called"
                  tokens={opdNowServing.slice(0, TOKEN_BOARD_LIMIT).map(opdDisplayToken)}
                  highlight
                />
                <TokenLane
                  title="Next tokens"
                  emptyLabel="No OPD tokens waiting"
                  tokens={opdWaiting.slice(0, TOKEN_BOARD_LIMIT).map(opdDisplayToken)}
                />
              </Stack>
            </TokenBoardCard>
          )}

          {canViewLab && (
            <TokenBoardCard
              title={LAB_BOARD.title}
              subtitle={LAB_BOARD.subtitle}
              isLoading={labQuery.isLoading}
              isError={labQuery.isError}
              lastUpdatedAt={labQuery.dataUpdatedAt}
              summary={[
                { label: "Now", value: lab?.current_tokens[0]?.token_number ?? "—" },
                { label: "Waiting", value: lab?.stats.waiting_count ?? "—" },
                { label: "Counters", value: lab?.stats.counters_active ?? "—" },
              ]}
            >
              <Stack gap="sm">
                <TokenLane
                  title="Collecting now"
                  emptyLabel="No lab token is currently called"
                  tokens={(lab?.current_tokens ?? [])
                    .slice(0, TOKEN_BOARD_LIMIT)
                    .map(labDisplayToken)}
                  highlight
                />
                <TokenLane
                  title="Waiting samples"
                  emptyLabel="No lab sample tokens waiting"
                  tokens={(lab?.waiting ?? []).slice(0, TOKEN_BOARD_LIMIT).map(labDisplayToken)}
                />
                <TokenLane
                  title="Collection in progress"
                  emptyLabel="No collections in progress"
                  tokens={(lab?.collection_in_progress ?? [])
                    .slice(0, TOKEN_BOARD_LIMIT)
                    .map(labDisplayToken)}
                />
              </Stack>
            </TokenBoardCard>
          )}

          {canViewRadiology && (
            <TokenBoardCard
              title={RADIOLOGY_BOARD.title}
              subtitle={RADIOLOGY_BOARD.subtitle}
              isLoading={radiologyQuery.isLoading}
              isError={radiologyQuery.isError}
              lastUpdatedAt={radiologyQuery.dataUpdatedAt}
              summary={[
                { label: "Now", value: radiology?.current_token?.token_number ?? "—" },
                { label: "Waiting", value: radiology?.stats.waiting_count ?? "—" },
                { label: "Room", value: radiology?.room_number ?? "—" },
              ]}
            >
              <Stack gap="sm">
                <TokenLane
                  title="Called now"
                  emptyLabel="No radiology token is currently called"
                  tokens={
                    radiology?.current_token ? [radiologyDisplayToken(radiology.current_token)] : []
                  }
                  highlight
                />
                <TokenLane
                  title="Waiting scans"
                  emptyLabel="No radiology tokens waiting"
                  tokens={(radiology?.waiting ?? [])
                    .slice(0, TOKEN_BOARD_LIMIT)
                    .map(radiologyDisplayToken)}
                />
              </Stack>
            </TokenBoardCard>
          )}

          {canViewEmergency && (
            <TokenBoardCard
              title={EMERGENCY_BOARD.title}
              subtitle={EMERGENCY_BOARD.subtitle}
              isLoading={erQuery.isLoading}
              isError={erQuery.isError}
              lastUpdatedAt={erQuery.dataUpdatedAt}
              summary={[
                { label: "Waiting", value: er?.total_waiting ?? "—" },
                { label: "Overdue", value: overdueErTokens },
                { label: "Bays", value: er?.resuscitation_bays_available ?? "—" },
              ]}
            >
              <Stack gap="xs">
                {TRIAGE_LANES.map((lane) => (
                  <ErTriageLane
                    key={lane.key}
                    color={lane.color}
                    label={lane.label}
                    tokens={(er?.[lane.key] ?? []).slice(0, TOKEN_BOARD_LIMIT)}
                  />
                ))}
              </Stack>
            </TokenBoardCard>
          )}

          {canViewPharmacy && (
            <TokenBoardCard
              title={PHARMACY_BOARD.title}
              subtitle={PHARMACY_BOARD.subtitle}
              isLoading={pharmacyQuery.isLoading}
              isError={pharmacyQuery.isError}
              lastUpdatedAt={pharmacyQuery.dataUpdatedAt}
              summary={[
                { label: "Now", value: pharmacy?.current_token?.token_number ?? "—" },
                { label: "Ready", value: pharmacy?.stats.ready_count ?? "—" },
                { label: "Waiting", value: pharmacy?.stats.waiting_count ?? "—" },
              ]}
            >
              <Stack gap="sm">
                <TokenLane
                  title="Now serving"
                  emptyLabel="No current token"
                  tokens={currentPharmacy.map(pharmacyDisplayToken)}
                  highlight
                />
                <TokenLane
                  title="Ready pickup"
                  emptyLabel="No ready tokens"
                  tokens={(pharmacy?.ready_for_pickup ?? [])
                    .slice(0, TOKEN_BOARD_LIMIT)
                    .map(pharmacyDisplayToken)}
                />
                <TokenLane
                  title="Preparing"
                  emptyLabel="No preparing tokens"
                  tokens={(pharmacy?.preparing ?? [])
                    .slice(0, TOKEN_BOARD_LIMIT)
                    .map(pharmacyDisplayToken)}
                />
              </Stack>
            </TokenBoardCard>
          )}

          {canViewBilling && (
            <TokenBoardCard
              title={BILLING_BOARD.title}
              subtitle={BILLING_BOARD.subtitle}
              isLoading={billingQuery.isLoading}
              isError={billingQuery.isError}
              lastUpdatedAt={billingQuery.dataUpdatedAt}
              summary={[
                { label: "Now", value: billingNowServing?.token_number ?? "—" },
                { label: "IPD", value: billing?.ipd_discharge.length ?? "—" },
                { label: "Insurance", value: billing?.insurance_desk.length ?? "—" },
              ]}
            >
              <Stack gap="sm">
                <TokenLane
                  title="IPD discharge"
                  emptyLabel="No IPD discharge bills"
                  tokens={(billing?.ipd_discharge ?? [])
                    .slice(0, TOKEN_BOARD_LIMIT)
                    .map(billingDisplayToken)}
                />
                <TokenLane
                  title="OPD billing"
                  emptyLabel="No OPD bills waiting"
                  tokens={(billing?.opd_billing ?? [])
                    .slice(0, TOKEN_BOARD_LIMIT)
                    .map(billingDisplayToken)}
                />
                <TokenLane
                  title="Insurance desk"
                  emptyLabel="No insurance tokens"
                  tokens={(billing?.insurance_desk ?? [])
                    .slice(0, TOKEN_BOARD_LIMIT)
                    .map(billingDisplayToken)}
                />
              </Stack>
            </TokenBoardCard>
          )}
        </SimpleGrid>
      )}
    </Stack>
  );
}

function TokenBoardCard({
  children,
  isError,
  isLoading,
  lastUpdatedAt,
  subtitle,
  summary,
  title,
}: {
  children: ReactNode;
  isError: boolean;
  isLoading: boolean;
  lastUpdatedAt: number;
  subtitle: string;
  summary: Array<{ label: string; value: number | string }>;
  title: string;
}) {
  return (
    <Card withBorder padding="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={0}>
            <Text fw={700}>{title}</Text>
            <Text size="xs" c="dimmed">
              {subtitle}
            </Text>
          </Stack>
          <Badge color={isError ? "danger" : "teal"} variant="light">
            {isError ? "Feed error" : `Sync ${lastUpdatedLabel(lastUpdatedAt)}`}
          </Badge>
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
          {summary.map((item) => (
            <Box
              key={item.label}
              p="xs"
              style={{
                border: "1px solid var(--mantine-color-gray-3)",
                borderRadius: 8,
              }}
            >
              <Text size="xs" c="dimmed" tt="uppercase">
                {item.label}
              </Text>
              <Text fw={800} size="xl">
                {item.value}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
        {isLoading ? (
          <Text size="sm" c="dimmed">
            Loading token feed...
          </Text>
        ) : isError ? (
          <Text size="sm" c="danger">
            Feed unavailable. Check queue-display permissions and network state.
          </Text>
        ) : (
          children
        )}
      </Stack>
    </Card>
  );
}

interface DisplayToken {
  meta: string;
  status: string;
  tokenNumber: string;
}

function TokenLane({
  emptyLabel,
  highlight = false,
  title,
  tokens,
}: {
  emptyLabel: string;
  highlight?: boolean;
  title: string;
  tokens: DisplayToken[];
}) {
  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text size="xs" fw={700} c="dimmed" tt="uppercase">
          {title}
        </Text>
        <Badge size="xs" variant="light">
          {tokens.length}
        </Badge>
      </Group>
      {tokens.length === 0 ? (
        <Box
          p="sm"
          style={{
            border: "1px solid var(--mantine-color-gray-3)",
            borderRadius: 8,
          }}
        >
          <Text size="sm" c="dimmed">
            {emptyLabel}
          </Text>
        </Box>
      ) : (
        <Stack gap="xs">
          {tokens.map((token) => (
            <Box
              key={`${title}-${token.tokenNumber}`}
              p="sm"
              style={{
                border: "1px solid var(--mantine-color-gray-3)",
                borderRadius: 8,
              }}
            >
              <Group justify="space-between" align="center">
                <Stack gap={0}>
                  <Text fw={800} size={highlight ? "xl" : "lg"}>
                    {token.tokenNumber}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {token.meta}
                  </Text>
                </Stack>
                <Badge color={tokenStatusColor(token.status)} variant="light">
                  {statusLabel(token.status)}
                </Badge>
              </Group>
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function ErTriageLane({
  color,
  label,
  tokens,
}: {
  color: string;
  label: string;
  tokens: ErTriageToken[];
}) {
  return (
    <Box
      p="sm"
      style={{
        border: "1px solid var(--mantine-color-gray-3)",
        borderRadius: 8,
      }}
    >
      <Group justify="space-between" align="flex-start">
        <Stack gap={0}>
          <Text size="xs" fw={700} c={color} tt="uppercase">
            {label}
          </Text>
          <Text size="xs" c="dimmed">
            {tokens.length === 0
              ? "No waiting tokens"
              : `${tokens.length} waiting · ${tokens.filter((token) => token.is_overdue).length} overdue`}
          </Text>
        </Stack>
        <Group gap={4} justify="flex-end">
          {tokens.length === 0 ? (
            <Badge variant="light">Clear</Badge>
          ) : (
            tokens.map((token) => (
              <Badge
                key={`${token.triage_level}-${token.token_number}`}
                color={token.is_overdue ? "danger" : color}
                variant={token.is_overdue ? "filled" : "light"}
              >
                {token.token_number}
              </Badge>
            ))
          )}
        </Group>
      </Group>
    </Box>
  );
}

function priorityLabel(value: QueuePriority) {
  return value.replace(/_/g, " ");
}

function opdDisplayToken(token: QueueToken): DisplayToken {
  return {
    meta: token.priority === "normal" ? "Standard priority" : priorityLabel(token.priority),
    status: token.status,
    tokenNumber: token.token_number,
  };
}

function labDisplayToken(token: LabQueueToken): DisplayToken {
  return {
    meta: [
      `${token.test_count} test${token.test_count === 1 ? "" : "s"}`,
      token.counter !== null ? `Counter ${token.counter}` : null,
      token.is_fasting ? "Fasting" : null,
      token.is_pediatric ? "Pediatric" : null,
    ]
      .filter((part): part is string => Boolean(part))
      .join(" · "),
    status: token.status,
    tokenNumber: token.token_number,
  };
}

function radiologyDisplayToken(token: RadiologyQueueToken): DisplayToken {
  return {
    meta: [token.modality, token.room_number]
      .filter((part): part is string => Boolean(part))
      .join(" · "),
    status: token.status,
    tokenNumber: token.token_number,
  };
}

function pharmacyDisplayToken(token: PharmacyQueueToken): DisplayToken {
  return {
    meta: [
      `${token.prescription_count} item${token.prescription_count === 1 ? "" : "s"}`,
      token.counter !== null ? `Counter ${token.counter}` : null,
      token.estimated_wait_minutes !== null ? `${token.estimated_wait_minutes} min wait` : null,
    ]
      .filter((part): part is string => Boolean(part))
      .join(" · "),
    status: token.status,
    tokenNumber: token.token_number,
  };
}

function billingDisplayToken(token: BillingQueueToken): DisplayToken {
  return {
    meta: [token.queue_type, token.counter !== null ? `Counter ${token.counter}` : null]
      .filter((part): part is string => Boolean(part))
      .join(" · "),
    status: token.status,
    tokenNumber: token.token_number,
  };
}

function tokenStatusColor(status: string) {
  switch (status) {
    case "ready":
    case "dispensed":
    case "paid":
    case "settled":
    case "called":
    case "collected":
    case "completed":
    case "in_progress":
      return "teal";
    case "scheduled":
    case "collection_in_progress":
    case "preparing":
    case "issued":
    case "active":
      return "orange";
    case "partially_paid":
    case "on_hold":
      return "yellow";
    default:
      return "slate";
  }
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function lastUpdatedLabel(value: number) {
  if (value === 0) return "pending";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ══════════════════════════════════════════════════════════
//  Tab 4 — Visitor Management
// ══════════════════════════════════════════════════════════

function VisitorManagementTab({
  canCreate,
  canManagePasses,
}: {
  canCreate: boolean;
  canManagePasses: boolean;
}) {
  const qc = useQueryClient();
  const [visitorDrawer, visitorDrawerHandlers] = useDisclosure(false);
  const [passDrawer, passDrawerHandlers] = useDisclosure(false);
  const [selectedRegistration, setSelectedRegistration] = useState<string | null>(null);

  const visitorForm = useForm<FrontOfficeVisitorFormInput>({
    resolver: zodResolver(frontOfficeVisitorFormSchema),
    defaultValues: DEFAULT_VISITOR_FORM_VALUES,
  });

  const passForm = useForm<FrontOfficeVisitorPassFormInput>({
    resolver: zodResolver(frontOfficeVisitorPassFormSchema),
    defaultValues: DEFAULT_VISITOR_PASS_FORM_VALUES,
  });

  const { data: visitors, isLoading: loadingVisitors } = useQuery<VisitorRegistration[]>({
    queryKey: ["front-office", "visitors"],
    queryFn: () => frontOfficeService.listVisitors(),
  });

  const { data: passes, isLoading: loadingPasses } = useQuery<VisitorPass[]>({
    queryKey: ["front-office", "passes"],
    queryFn: () => frontOfficeService.listVisitorPasses(),
  });

  const { data: logs } = useQuery<VisitorLog[]>({
    queryKey: ["front-office", "visitor-logs"],
    queryFn: () => frontOfficeService.listVisitorLogs({ active_only: "true" }),
  });

  const createVisitor = useMutation({
    mutationFn: (data: FrontOfficeVisitorFormInput) =>
      frontOfficeService.createVisitor(toCreateVisitorRequest(data)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "visitors"] });
      visitorDrawerHandlers.close();
      notifications.show({ message: "Visitor registered", color: "success" });
      visitorForm.reset(DEFAULT_VISITOR_FORM_VALUES);
    },
  });

  const createPass = useMutation({
    mutationFn: (data: FrontOfficeVisitorPassFormInput) =>
      selectedRegistration
        ? frontOfficeService.createVisitorPass(
            toCreateVisitorPassRequest(selectedRegistration, data),
          )
        : Promise.reject(new Error("Select a visitor registration before issuing a pass")),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "passes"] });
      passDrawerHandlers.close();
      passForm.reset(DEFAULT_VISITOR_PASS_FORM_VALUES);
      notifications.show({ message: "Pass issued", color: "success" });
    },
  });

  const revokePass = useMutation({
    mutationFn: (id: string) =>
      frontOfficeService.revokeVisitorPass(id, { reason: "Revoked by staff" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "passes"] });
      notifications.show({ message: "Pass revoked", color: "orange" });
    },
  });

  const checkIn = useMutation({
    mutationFn: (passId: string) => frontOfficeService.checkInVisitor(passId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "visitor-logs"] });
      notifications.show({ message: "Visitor checked in", color: "success" });
    },
  });

  const checkOut = useMutation({
    mutationFn: (passId: string) => frontOfficeService.checkOutVisitor(passId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "visitor-logs"] });
      notifications.show({ message: "Visitor checked out", color: "primary" });
    },
  });

  const visitorColumns = [
    { key: "visitor_name", label: "Name", render: (r: VisitorRegistration) => r.visitor_name },
    { key: "phone", label: "Phone", render: (r: VisitorRegistration) => r.phone ?? "—" },
    {
      key: "category",
      label: "Category",
      render: (r: VisitorRegistration) => <TableValueBadge value={r.category} kind="category" />,
    },
    { key: "id_type", label: "ID Type", render: (r: VisitorRegistration) => r.id_type ?? "—" },
    { key: "purpose", label: "Purpose", render: (r: VisitorRegistration) => r.purpose ?? "—" },
    {
      key: "created_at",
      label: "Registered",
      render: (r: VisitorRegistration) => new Date(r.created_at).toLocaleString(),
    },
    {
      key: "actions",
      label: "",
      render: (r: VisitorRegistration) =>
        canManagePasses ? (
          <Tooltip label="Issue Pass">
            <ActionIcon
              variant="light"
              color="primary"
              onClick={() => {
                setSelectedRegistration(r.id);
                passDrawerHandlers.open();
              }}
              aria-label="QR code"
            >
              <IconQrcode size={16} />
            </ActionIcon>
          </Tooltip>
        ) : null,
    },
  ];

  const passColumns = [
    { key: "pass_number", label: "Pass #", render: (r: VisitorPass) => r.pass_number },
    {
      key: "status",
      label: "Status",
      render: (r: VisitorPass) => (
        <TableValueBadge
          value={r.status}
          kind="status"
          color={passStatusColors[r.status] ?? "slate"}
          variant="filled"
        />
      ),
    },
    {
      key: "valid_from",
      label: "Valid From",
      render: (r: VisitorPass) => new Date(r.valid_from).toLocaleString(),
    },
    {
      key: "valid_until",
      label: "Valid Until",
      render: (r: VisitorPass) => new Date(r.valid_until).toLocaleString(),
    },
    { key: "bed_number", label: "Bed", render: (r: VisitorPass) => r.bed_number ?? "—" },
    {
      key: "actions",
      label: "",
      render: (r: VisitorPass) => (
        <Group gap="xs">
          {r.status === "active" && canManagePasses && (
            <>
              <Tooltip label="Check In">
                <ActionIcon
                  variant="light"
                  color="success"
                  onClick={() => checkIn.mutate(r.id)}
                  aria-label="Confirm"
                >
                  <IconCheck size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Check Out">
                <ActionIcon
                  variant="light"
                  color="primary"
                  onClick={() => checkOut.mutate(r.id)}
                  aria-label="Time"
                >
                  <IconClock size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Revoke">
                <ActionIcon
                  variant="light"
                  color="danger"
                  onClick={() => revokePass.mutate(r.id)}
                  aria-label="Close"
                >
                  <IconX size={16} />
                </ActionIcon>
              </Tooltip>
            </>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack gap="lg">
      {/* Visitors */}
      <div>
        <Group justify="space-between" mb="sm">
          <Text fw={600}>Visitor Registrations</Text>
          {canCreate && (
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={visitorDrawerHandlers.open}
            >
              Register Visitor
            </Button>
          )}
        </Group>
        <DataTable
          columns={visitorColumns}
          data={visitors ?? []}
          loading={loadingVisitors}
          rowKey={(r: VisitorRegistration) => r.id}
        />
      </div>

      {/* Active Passes */}
      <div>
        <Group justify="space-between" mb="sm">
          <Text fw={600}>
            Visitor Passes ({passes?.filter((p) => p.status === "active").length ?? 0} active)
          </Text>
        </Group>
        <DataTable
          columns={passColumns}
          data={passes ?? []}
          loading={loadingPasses}
          rowKey={(r: VisitorPass) => r.id}
        />
      </div>

      {/* Active visitor count */}
      {logs && logs.length > 0 && (
        <Text size="sm" c="dimmed">
          Currently inside: {logs.length} visitor(s)
        </Text>
      )}

      {/* Register Visitor Drawer */}
      <Drawer
        opened={visitorDrawer}
        onClose={visitorDrawerHandlers.close}
        title="Register Visitor"
        position="right"
        size="xl"
      >
        <Stack
          component="form"
          gap="sm"
          onSubmit={visitorForm.handleSubmit((values) => createVisitor.mutate(values))}
        >
          <TextInput
            label="Visitor Name"
            required
            error={visitorForm.formState.errors.visitor_name?.message}
            {...visitorForm.register("visitor_name")}
          />
          <TextInput
            label="Phone"
            error={visitorForm.formState.errors.phone?.message}
            {...visitorForm.register("phone")}
          />
          <Controller
            control={visitorForm.control}
            name="id_type"
            render={({ field, fieldState }) => (
              <Select
                label="ID Type"
                data={VISITOR_ID_TYPE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                clearable
              />
            )}
          />
          <TextInput
            label="ID Number"
            error={visitorForm.formState.errors.id_number?.message}
            {...visitorForm.register("id_number")}
          />
          <TextInput
            label="Relationship"
            error={visitorForm.formState.errors.relationship?.message}
            {...visitorForm.register("relationship")}
          />
          <Controller
            control={visitorForm.control}
            name="category"
            render={({ field, fieldState }) => (
              <Select
                label="Category"
                data={VISITOR_CATEGORY_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Textarea
            label="Purpose"
            error={visitorForm.formState.errors.purpose?.message}
            {...visitorForm.register("purpose")}
          />
          <Button type="submit" loading={createVisitor.isPending}>
            Register
          </Button>
        </Stack>
      </Drawer>

      {/* Issue Pass Drawer */}
      <Drawer
        opened={passDrawer}
        onClose={passDrawerHandlers.close}
        title="Issue Visitor Pass"
        position="right"
        size="sm"
      >
        <Stack
          component="form"
          gap="sm"
          onSubmit={passForm.handleSubmit((values) => createPass.mutate(values))}
        >
          <Text size="sm" c="dimmed">
            Issuing pass for registration: {selectedRegistration?.slice(0, 8)}...
          </Text>
          <Controller
            control={passForm.control}
            name="valid_hours"
            render={({ field, fieldState }) => (
              <NumberInput
                label="Valid Hours"
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                min={1}
                max={24}
              />
            )}
          />
          <Button type="submit" loading={createPass.isPending} disabled={!selectedRegistration}>
            Issue Pass
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 3 — Queue Configuration
// ══════════════════════════════════════════════════════════

function QueueConfigTab({
  canManage,
  canManageVisitors,
}: {
  canManage: boolean;
  canManageVisitors: boolean;
}) {
  const qc = useQueryClient();
  const [ruleDrawer, ruleDrawerHandlers] = useDisclosure(false);
  const [configDrawer, configDrawerHandlers] = useDisclosure(false);
  const [hoursDrawer, hoursDrawerHandlers] = useDisclosure(false);

  const priorityForm = useForm<FrontOfficeQueuePriorityFormInput>({
    resolver: zodResolver(frontOfficeQueuePriorityFormSchema),
    defaultValues: DEFAULT_QUEUE_PRIORITY_FORM_VALUES,
  });

  const displayConfigForm = useForm<FrontOfficeDisplayConfigFormInput>({
    resolver: zodResolver(frontOfficeDisplayConfigFormSchema),
    defaultValues: DEFAULT_DISPLAY_CONFIG_FORM_VALUES,
  });

  const visitingHoursForm = useForm<FrontOfficeVisitingHoursFormInput>({
    resolver: zodResolver(frontOfficeVisitingHoursFormSchema),
    defaultValues: DEFAULT_VISITING_HOURS_FORM_VALUES,
  });

  const { data: rules, isLoading: loadingRules } = useQuery<QueuePriorityRule[]>({
    queryKey: ["front-office", "queue-priority"],
    queryFn: () => frontOfficeService.listQueuePriorityRules(),
  });

  const { data: configs, isLoading: loadingConfigs } = useQuery<QueueDisplayConfig[]>({
    queryKey: ["front-office", "display-config"],
    queryFn: () => frontOfficeService.listQueueDisplayConfig(),
  });

  const { data: hours, isLoading: loadingHours } = useQuery<VisitingHours[]>({
    queryKey: ["front-office", "visiting-hours"],
    queryFn: () => frontOfficeService.listVisitingHours(),
  });

  const createRule = useMutation({
    mutationFn: (data: FrontOfficeQueuePriorityFormInput) =>
      frontOfficeService.upsertQueuePriorityRule(toUpsertQueuePriorityRequest(data)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "queue-priority"] });
      ruleDrawerHandlers.close();
      priorityForm.reset(DEFAULT_QUEUE_PRIORITY_FORM_VALUES);
      notifications.show({ message: "Priority rule added", color: "success" });
    },
  });

  const createConfig = useMutation({
    mutationFn: (data: FrontOfficeDisplayConfigFormInput) =>
      frontOfficeService.upsertQueueDisplayConfig(toUpsertDisplayConfigRequest(data)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "display-config"] });
      configDrawerHandlers.close();
      displayConfigForm.reset(DEFAULT_DISPLAY_CONFIG_FORM_VALUES);
      notifications.show({ message: "Display config saved", color: "success" });
    },
  });

  const createHours = useMutation({
    mutationFn: (data: FrontOfficeVisitingHoursFormInput) =>
      frontOfficeService.upsertVisitingHours(toUpsertVisitingHoursRequest(data)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "visiting-hours"] });
      hoursDrawerHandlers.close();
      visitingHoursForm.reset(DEFAULT_VISITING_HOURS_FORM_VALUES);
      notifications.show({ message: "Visiting hours saved", color: "success" });
    },
  });

  const ruleColumns = [
    {
      key: "priority",
      label: "Priority",
      render: (r: QueuePriorityRule) => (
        <TableValueBadge
          value={r.priority}
          kind="priority"
          color={priorityColors[r.priority] ?? "slate"}
          variant="filled"
        />
      ),
    },
    { key: "weight", label: "Weight", render: (r: QueuePriorityRule) => String(r.weight) },
    {
      key: "is_active",
      label: "Active",
      render: (r: QueuePriorityRule) =>
        r.is_active ? (
          <TableValueBadge value="active" label="Yes" color="success" variant="filled" />
        ) : (
          <TableValueBadge value="inactive" label="No" color="slate" variant="filled" />
        ),
    },
  ];

  const configColumns = [
    { key: "location_name", label: "Location", render: (r: QueueDisplayConfig) => r.location_name },
    { key: "display_type", label: "Type", render: (r: QueueDisplayConfig) => r.display_type },
    {
      key: "doctors_per_screen",
      label: "Doctors/Screen",
      render: (r: QueueDisplayConfig) => String(r.doctors_per_screen),
    },
    {
      key: "show_wait_time",
      label: "Show Wait",
      render: (r: QueueDisplayConfig) => (r.show_wait_time ? "Yes" : "No"),
    },
    {
      key: "show_patient_name",
      label: "Privacy",
      render: (r: QueueDisplayConfig) =>
        r.show_patient_name ? (
          <TableValueBadge
            value="names_enabled"
            label="Names enabled"
            color="orange"
            variant="filled"
          />
        ) : (
          <TableValueBadge value="token_only" label="Token-only" color="success" variant="filled" />
        ),
    },
    {
      key: "announcement_enabled",
      label: "Announce",
      render: (r: QueueDisplayConfig) => (r.announcement_enabled ? "Yes" : "No"),
    },
  ];

  const hoursColumns = [
    {
      key: "day_of_week",
      label: "Day",
      render: (r: VisitingHours) => DAY_NAMES[r.day_of_week] ?? String(r.day_of_week),
    },
    { key: "start_time", label: "Start", render: (r: VisitingHours) => r.start_time },
    { key: "end_time", label: "End", render: (r: VisitingHours) => r.end_time },
    {
      key: "max_visitors_per_patient",
      label: "Max Visitors",
      render: (r: VisitingHours) => String(r.max_visitors_per_patient),
    },
    {
      key: "is_active",
      label: "Active",
      render: (r: VisitingHours) =>
        r.is_active ? <Badge color="success">Yes</Badge> : <Badge color="slate">No</Badge>,
    },
  ];

  return (
    <Stack gap="lg">
      {/* Visiting Hours */}
      <div>
        <Group justify="space-between" mb="sm">
          <Text fw={600}>Visiting Hours</Text>
          {canManageVisitors && (
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={hoursDrawerHandlers.open}
            >
              Add Hours
            </Button>
          )}
        </Group>
        <DataTable
          columns={hoursColumns}
          data={hours ?? []}
          loading={loadingHours}
          rowKey={(r: VisitingHours) => r.id}
        />
      </div>

      {/* Priority Rules */}
      <div>
        <Group justify="space-between" mb="sm">
          <Text fw={600}>Queue Priority Rules</Text>
          {canManage && (
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={ruleDrawerHandlers.open}
            >
              Add Rule
            </Button>
          )}
        </Group>
        <DataTable
          columns={ruleColumns}
          data={rules ?? []}
          loading={loadingRules}
          rowKey={(r: QueuePriorityRule) => r.id}
        />
      </div>

      {/* Display Config */}
      <div>
        <Group justify="space-between" mb="sm">
          <Text fw={600}>Display Configuration</Text>
          {canManage && (
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={configDrawerHandlers.open}
            >
              Add Config
            </Button>
          )}
        </Group>
        <DataTable
          columns={configColumns}
          data={configs ?? []}
          loading={loadingConfigs}
          rowKey={(r: QueueDisplayConfig) => r.id}
        />
      </div>

      {/* Priority Rule Drawer */}
      <Drawer
        opened={ruleDrawer}
        onClose={ruleDrawerHandlers.close}
        title="Add Priority Rule"
        position="right"
        size="sm"
      >
        <Stack
          component="form"
          gap="sm"
          onSubmit={priorityForm.handleSubmit((values) => createRule.mutate(values))}
        >
          <Controller
            control={priorityForm.control}
            name="priority"
            render={({ field, fieldState }) => (
              <Select
                label="Priority"
                data={QUEUE_PRIORITY_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={priorityForm.control}
            name="weight"
            render={({ field, fieldState }) => (
              <NumberInput
                label="Weight (higher = called sooner)"
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                min={1}
                max={100}
              />
            )}
          />
          <Button type="submit" loading={createRule.isPending}>
            Save
          </Button>
        </Stack>
      </Drawer>

      {/* Display Config Drawer */}
      <Drawer
        opened={configDrawer}
        onClose={configDrawerHandlers.close}
        title="Add Display Config"
        position="right"
        size="xl"
      >
        <Stack
          component="form"
          gap="sm"
          onSubmit={displayConfigForm.handleSubmit((values) => createConfig.mutate(values))}
        >
          <TextInput
            label="Location Name"
            required
            error={displayConfigForm.formState.errors.location_name?.message}
            {...displayConfigForm.register("location_name")}
          />
          <Controller
            control={displayConfigForm.control}
            name="display_type"
            render={({ field, fieldState }) => (
              <Select
                label="Display Type"
                data={DISPLAY_TYPE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={displayConfigForm.control}
            name="doctors_per_screen"
            render={({ field, fieldState }) => (
              <NumberInput
                label="Doctors Per Screen"
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                min={1}
                max={20}
              />
            )}
          />
          <Controller
            control={displayConfigForm.control}
            name="show_patient_name"
            render={({ field }) => (
              <Switch
                label="Show patient name on authorized staff displays"
                description="Public token boards remain token-only; enable only for controlled team-room displays."
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Controller
            control={displayConfigForm.control}
            name="show_wait_time"
            render={({ field }) => (
              <Switch
                label="Show Wait Time"
                description="Allowed on public token boards when it does not reveal patient identity or clinical context."
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Controller
            control={displayConfigForm.control}
            name="announcement_enabled"
            render={({ field }) => (
              <Switch
                label="Enable Announcements"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Button type="submit" loading={createConfig.isPending}>
            Save
          </Button>
        </Stack>
      </Drawer>

      {/* Visiting Hours Drawer */}
      <Drawer
        opened={hoursDrawer}
        onClose={hoursDrawerHandlers.close}
        title="Add Visiting Hours"
        position="right"
        size="sm"
      >
        <Stack
          component="form"
          gap="sm"
          onSubmit={visitingHoursForm.handleSubmit((values) => createHours.mutate(values))}
        >
          <Controller
            control={visitingHoursForm.control}
            name="day_of_week"
            render={({ field, fieldState }) => (
              <Select
                label="Day of Week"
                data={DAY_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <TextInput
            label="Start Time"
            placeholder="HH:MM"
            error={visitingHoursForm.formState.errors.start_time?.message}
            {...visitingHoursForm.register("start_time")}
          />
          <TextInput
            label="End Time"
            placeholder="HH:MM"
            error={visitingHoursForm.formState.errors.end_time?.message}
            {...visitingHoursForm.register("end_time")}
          />
          <Controller
            control={visitingHoursForm.control}
            name="max_visitors_per_patient"
            render={({ field, fieldState }) => (
              <NumberInput
                label="Max Visitors Per Patient"
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                min={1}
                max={10}
              />
            )}
          />
          <Button type="submit" loading={createHours.isPending}>
            Save
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 4 — Enquiry Desk
// ══════════════════════════════════════════════════════════

function EnquiryDeskTab({ canCreate, canManage }: { canCreate: boolean; canManage: boolean }) {
  const qc = useQueryClient();
  const [drawer, drawerHandlers] = useDisclosure(false);

  const enquiryForm = useForm<FrontOfficeEnquiryFormInput>({
    resolver: zodResolver(frontOfficeEnquiryFormSchema),
    defaultValues: DEFAULT_ENQUIRY_FORM_VALUES,
  });

  const { data: enquiries, isLoading } = useQuery<FrontOfficeEnquiryLog[]>({
    queryKey: ["front-office", "enquiries"],
    queryFn: () => frontOfficeService.listEnquiries(),
  });

  const createEnquiry = useMutation({
    mutationFn: (data: FrontOfficeEnquiryFormInput) =>
      frontOfficeService.createEnquiry(toCreateEnquiryRequest(data)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "enquiries"] });
      drawerHandlers.close();
      notifications.show({ message: "Enquiry logged", color: "success" });
      enquiryForm.reset(DEFAULT_ENQUIRY_FORM_VALUES);
    },
  });

  const resolveEnquiry = useMutation({
    mutationFn: (id: string) => frontOfficeService.resolveEnquiry(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "enquiries"] });
      notifications.show({ message: "Enquiry resolved", color: "success" });
    },
  });

  const columns = [
    {
      key: "caller_name",
      label: "Caller",
      render: (r: FrontOfficeEnquiryLog) => r.caller_name ?? "—",
    },
    {
      key: "caller_phone",
      label: "Phone",
      render: (r: FrontOfficeEnquiryLog) => r.caller_phone ?? "—",
    },
    {
      key: "enquiry_type",
      label: "Type",
      render: (r: FrontOfficeEnquiryLog) => (
        <TableValueBadge value={r.enquiry_type} kind="source" />
      ),
    },
    {
      key: "response_text",
      label: "Response",
      render: (r: FrontOfficeEnquiryLog) => r.response_text ?? "—",
    },
    {
      key: "resolved",
      label: "Resolved",
      render: (r: FrontOfficeEnquiryLog) =>
        r.resolved ? (
          <TableValueBadge value="completed" label="Yes" color="success" variant="filled" />
        ) : (
          <TableValueBadge value="pending" label="No" color="orange" variant="filled" />
        ),
    },
    {
      key: "created_at",
      label: "Time",
      render: (r: FrontOfficeEnquiryLog) => new Date(r.created_at).toLocaleString(),
    },
    {
      key: "actions",
      label: "",
      render: (r: FrontOfficeEnquiryLog) =>
        !r.resolved && canManage ? (
          <Tooltip label="Mark Resolved">
            <ActionIcon
              variant="light"
              color="success"
              onClick={() => resolveEnquiry.mutate(r.id)}
              aria-label="Confirm"
            >
              <IconCheck size={16} />
            </ActionIcon>
          </Tooltip>
        ) : null,
    },
  ];

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600}>Enquiry Log</Text>
        {canCreate && (
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={drawerHandlers.open}>
            Log Enquiry
          </Button>
        )}
      </Group>
      <DataTable
        columns={columns}
        data={enquiries ?? []}
        loading={isLoading}
        rowKey={(r: FrontOfficeEnquiryLog) => r.id}
      />

      <Drawer
        opened={drawer}
        onClose={drawerHandlers.close}
        title="Log Enquiry"
        position="right"
        size="xl"
      >
        <Stack
          component="form"
          gap="sm"
          onSubmit={enquiryForm.handleSubmit((values) => createEnquiry.mutate(values))}
        >
          <TextInput
            label="Caller Name"
            error={enquiryForm.formState.errors.caller_name?.message}
            {...enquiryForm.register("caller_name")}
          />
          <TextInput
            label="Caller Phone"
            error={enquiryForm.formState.errors.caller_phone?.message}
            {...enquiryForm.register("caller_phone")}
          />
          <Controller
            control={enquiryForm.control}
            name="enquiry_type"
            render={({ field, fieldState }) => (
              <Select
                label="Enquiry Type"
                data={ENQUIRY_TYPE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Textarea
            label="Response"
            error={enquiryForm.formState.errors.response_text?.message}
            rows={3}
            {...enquiryForm.register("response_text")}
          />
          <Button type="submit" loading={createEnquiry.isPending}>
            Log Enquiry
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 5 — Visitor Analytics
// ══════════════════════════════════════════════════════════

function VisitorAnalyticsTab() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: analytics, isLoading } = useQuery<VisitorAnalytics>({
    queryKey: ["front-office", "visitor-analytics", from, to],
    queryFn: () =>
      frontOfficeService.visitorAnalytics({ from: from || undefined, to: to || undefined }),
  });

  const byDeptChart = analytics
    ? Object.entries(analytics.by_department).map(([dept, count]) => ({
        department: dept,
        visitors: count,
      }))
    : [];

  const byHourChart = analytics
    ? Object.entries(analytics.by_hour).map(([hour, count]) => ({
        hour,
        visitors: count,
      }))
    : [];

  return (
    <Stack gap="md">
      <Group>
        <TextInput
          placeholder="From date"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.currentTarget.value)}
          w={160}
        />
        <TextInput
          placeholder="To date"
          type="date"
          value={to}
          onChange={(e) => setTo(e.currentTarget.value)}
          w={160}
        />
      </Group>

      {isLoading && (
        <Text size="sm" c="dimmed">
          Loading analytics...
        </Text>
      )}

      {analytics && (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Card withBorder p="md">
              <Text size="xs" c="dimmed">
                Total Visitors
              </Text>
              <Text size="xl" fw={700} c="primary">
                {analytics.total_visitors}
              </Text>
            </Card>
            <Card withBorder p="md">
              <Text size="xs" c="dimmed">
                Avg Visit Duration
              </Text>
              <Text size="xl" fw={700} c="orange">
                {Math.round(analytics.avg_visit_duration_minutes)} min
              </Text>
            </Card>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Card withBorder p="sm">
              <Text fw={600} size="sm" mb="sm">
                Visitors by Department
              </Text>
              {byDeptChart.length > 0 ? (
                <BarChart
                  h={220}
                  data={byDeptChart}
                  dataKey="department"
                  series={[{ name: "visitors", color: "primary" }]}
                />
              ) : (
                <Text size="sm" c="dimmed">
                  No data
                </Text>
              )}
            </Card>
            <Card withBorder p="sm">
              <Text fw={600} size="sm" mb="sm">
                Visitors by Hour
              </Text>
              {byHourChart.length > 0 ? (
                <BarChart
                  h={220}
                  data={byHourChart}
                  dataKey="hour"
                  series={[{ name: "visitors", color: "teal" }]}
                />
              ) : (
                <Text size="sm" c="dimmed">
                  No data
                </Text>
              )}
            </Card>
          </SimpleGrid>
        </>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 6 — Queue Metrics
// ══════════════════════════════════════════════════════════

function QueueMetricsTab() {
  const { data: metrics = [], isLoading } = useQuery<QueueMetrics[]>({
    queryKey: ["front-office", "queue-metrics"],
    queryFn: () => frontOfficeService.queueMetrics(),
  });

  const cols: Column<QueueMetrics>[] = [
    {
      key: "department",
      label: "Department",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.department}
        </Text>
      ),
    },
    {
      key: "current_waiting",
      label: "Currently Waiting",
      render: (r) => (
        <Badge
          color={r.current_waiting > 10 ? "danger" : r.current_waiting > 5 ? "orange" : "success"}
        >
          {r.current_waiting}
        </Badge>
      ),
    },
    {
      key: "avg_wait_minutes",
      label: "Avg Wait (min)",
      render: (r) => <Text size="sm">{Math.round(r.avg_wait_minutes)}</Text>,
    },
    {
      key: "longest_wait_minutes",
      label: "Longest Wait (min)",
      render: (r) => (
        <Text size="sm" c={r.longest_wait_minutes > 30 ? "danger" : undefined}>
          {Math.round(r.longest_wait_minutes)}
        </Text>
      ),
    },
    {
      key: "throughput_per_hour",
      label: "Throughput/hr",
      render: (r) => <Text size="sm">{r.throughput_per_hour.toFixed(1)}</Text>,
    },
  ];

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Real-time queue performance metrics by department
      </Text>
      <DataTable columns={cols} data={metrics} loading={isLoading} rowKey={(r) => r.department} />
    </Stack>
  );
}

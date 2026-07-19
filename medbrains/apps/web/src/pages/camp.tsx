import { zodResolver } from "@hookform/resolvers/zod";
import {
  Box,
  Card,
  Divider,
  Drawer,
  Grid,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type {
  CampClinicalVisitFormInput,
  CampCreateFormInput,
  CampRegistrationFormInput,
} from "@medbrains/schemas";
import {
  campClinicalVisitFormSchema,
  campCreateFormSchema,
  campRegistrationFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  Camp,
  CampOpenEncounterResponse,
  CampRegistration,
  ClinicalEventName,
  ClinicalJourneyContext,
  CreateCampRegistrationRequest,
  CreateCampRequest,
  DepartmentRow,
  FieldAccessLevel,
} from "@medbrains/types";
import {
  activeCampRegistrationIdForJourney,
  CAMP_REGISTRATION_ID_PROOF_FIELD_ACCESS_KEY,
  CAMP_REGISTRATION_NAME_FIELD_ACCESS_KEY,
  CAMP_REGISTRATION_PHONE_FIELD_ACCESS_KEY,
  P,
  PATIENT_NAME_FIELD_ACCESS_KEYS,
  PATIENT_UHID_FIELD_ACCESS_KEY,
} from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import {
  IconArrowRight,
  IconCalendarCheck,
  IconChartBar,
  IconCheck,
  IconFirstAidKit,
  IconPencil,
  IconPlayerPlay,
  IconPlus,
  IconSearch,
  IconStethoscope,
  IconTransferIn,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  ClinicalEventProvider,
  DataTable,
  DoctorSearchSelect,
  PageHeader,
  useClinicalEmit,
  useProtectedFieldAccess,
} from "@/components";
import type { Column } from "@/components/DataTable";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientFlowNavigator } from "@/components/Patient/PatientFlowNavigator";
import { PatientJourneyActions } from "@/components/Patient/PatientJourneyActions";
import { deriveCampJourneyCompletedEvents } from "@/components/Patient/patient-journey-events";
import { Alert, Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import {
  campIdProofTypeOptions,
  campOptionalInteger,
  campOptionalNumber,
  campOptionalText,
  campTypeOptions,
} from "@/forms/camp.form";
import { useHashTabs } from "@/hooks/useHashTabs";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { EncounterDetail } from "@/pages/opd";
import { campService } from "@/services/camp.service";
import { lookupsService } from "@/services/lookups.service";
import { CampAnalyticsTab } from "./camp/analytics-tab";
import { CampDetail } from "./camp/camp-detail";
import { FollowupsTab } from "./camp/followups-tab";
import { ScreeningsTab } from "./camp/screenings-tab";
import { CampRegistrationSignals, protectedCampParticipantName } from "./camp/shared";
import classes from "./camp.module.scss";
import {
  CAMP_LANDING_TAB_VALUES,
  CAMP_WORK_TAB_VALUES,
  type CampWorkTabValue,
  campJourneyContext,
  campWorkDefaultTab,
} from "./camp-workspace";

// ── Constants ──────────────────────────────────────────

const CAMP_STATUS_COLORS: Record<string, BadgeTone> = {
  planned: "neutral",
  approved: "primary",
  setup: "primary",
  active: "success",
  completed: "success",
  cancelled: "danger",
};

const CAMP_SERVICE_LINE_OPTIONS = [
  { value: "opinion", label: "Opinion / specialist review" },
  { value: "consultation", label: "Consultation" },
  { value: "xray", label: "X-ray / imaging" },
  { value: "lab", label: "Lab test" },
  { value: "procedure", label: "Procedure" },
  { value: "pharmacy", label: "Pharmacy / medicines" },
  { value: "emergency", label: "Emergency" },
  { value: "follow_up", label: "Follow-up" },
  { value: "other", label: "Other" },
];

const patientContextQuery = (patientId: string) =>
  patientId ? `?patient_id=${encodeURIComponent(patientId)}` : "";

const campLandingPath = (patientId: string) => `/camp${patientContextQuery(patientId)}#camps`;

const campWorkPath = (campId: string, patientId: string, tab: CampWorkTabValue = "registrations") =>
  `/camp/${campId}/work${patientContextQuery(patientId)}#${tab}`;

const campClinicalRoutePath = (campId: string, registrationId: string, patientId: string) =>
  `/camp/${campId}/work/registrations/${registrationId}/clinical-route${patientContextQuery(
    patientId,
  )}#screenings`;

function protectedPatientName(
  patientName: string | null | undefined,
  access: FieldAccessLevel,
): string {
  const displayValue = fieldAccessText(access, patientName, "name");
  return displayValue === "—" ? "Patient" : displayValue;
}

function protectedPatientIdentifier(
  identifier: string | null | undefined,
  access: FieldAccessLevel,
): string {
  const displayValue = fieldAccessText(access, identifier, "identifier");
  return displayValue === "—" ? "No UHID" : displayValue;
}

function CampPatientActionBar({
  activeCampId,
  activeCampRegistrationId,
  patientId,
  completedEvents,
}: {
  activeCampId?: string | null;
  activeCampRegistrationId?: string | null;
  patientId: string;
  completedEvents?: readonly ClinicalEventName[];
}) {
  const { t } = useTranslation("camp");
  const journeyContext = useMemo<ClinicalJourneyContext>(
    () =>
      campJourneyContext({
        patientId,
        activeCampId,
        activeCampRegistrationId,
        completedEvents,
      }),
    [activeCampId, activeCampRegistrationId, completedEvents, patientId],
  );

  return (
    <Card withBorder padding="sm">
      <Group justify="space-between" gap="sm" align="center">
        <Stack gap={2}>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">
            {t("handoff.patient.title")}
          </Text>
          <Text size="xs" c="dimmed">
            {t("handoff.patient.message")}
          </Text>
        </Stack>
        <PatientJourneyActions
          context={journeyContext}
          hiddenActionIds={["camp.open_context"]}
          size="xs"
        />
      </Group>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────

export function CampPage() {
  return (
    <ClinicalEventProvider moduleCode="camp" contextCode="camp-list">
      <CampPageInner />
    </ClinicalEventProvider>
  );
}

function CampPageInner() {
  useRequirePermission(P.CAMP.LIST);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const contextPatientId = searchParams.get("patient_id") ?? "";
  const [activeTab, setActiveTab] = useHashTabs("camps", CAMP_LANDING_TAB_VALUES);
  const openCampWorkspace = (campId: string) => {
    navigate(campWorkPath(campId, contextPatientId));
  };

  return (
    <div>
      <PageHeader
        title="Camp Management"
        subtitle="Plan, approve, activate, and close outreach camps. Open an active camp to work inside it."
      />
      {contextPatientId && <CampPatientContextPanel patientId={contextPatientId} />}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="camps" leftSection={<IconFirstAidKit size={16} />}>
            Camps
          </Tabs.Tab>
          <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
            Analytics
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="camps" pt="md">
          <CampsTab onWorkCamp={openCampWorkspace} />
        </Tabs.Panel>
        <Tabs.Panel value="analytics" pt="md">
          <CampAnalyticsTab campId={null} selectedCamp={null} />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

interface CampWorkPageProps {
  initialTab?: string;
}

export function CampWorkPage({ initialTab = "registrations" }: CampWorkPageProps = {}) {
  const { campId } = useParams();

  return (
    <ClinicalEventProvider moduleCode="camp" contextCode={`camp-work-${campId ?? "unselected"}`}>
      <CampWorkPageInner initialTab={initialTab} />
    </ClinicalEventProvider>
  );
}

function CampWorkPageInner({ initialTab = "registrations" }: CampWorkPageProps = {}) {
  useRequirePermission(P.CAMP.LIST);
  const navigate = useNavigate();
  const { campId, registrationId } = useParams();
  const [searchParams] = useSearchParams();
  const contextPatientId = searchParams.get("patient_id") ?? "";
  const canViewRegistrations = useHasPermission(P.CAMP.REGISTRATIONS_LIST);
  const [activeTab, setActiveTab] = useHashTabs(
    campWorkDefaultTab(initialTab, registrationId),
    CAMP_WORK_TAB_VALUES,
  );
  const [focusedRegistrationId, setFocusedRegistrationId] = useState<string | null>(
    registrationId ?? null,
  );

  const { data: camps = [] } = useQuery({
    queryKey: ["camps"],
    queryFn: () => campService.listCamps(),
  });

  const activeCamps = useMemo(
    () =>
      camps
        .filter((camp) => camp.status === "active")
        .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date)),
    [camps],
  );
  const selectedCamp = camps.find((camp) => camp.id === campId) ?? null;
  const { data: patientCampRegistrations = [] } = useQuery<CampRegistration[]>({
    queryKey: ["camp-registrations", campId ?? null, contextPatientId],
    queryFn: () =>
      campService.listCampRegistrations({
        camp_id: campId ?? "",
        patient_id: contextPatientId,
      }),
    enabled: canViewRegistrations && Boolean(campId && contextPatientId),
  });
  const campCompletedEvents = useMemo(
    () => deriveCampJourneyCompletedEvents(patientCampRegistrations),
    [patientCampRegistrations],
  );
  const journeyRegistrationId = useMemo(
    () => activeCampRegistrationIdForJourney(patientCampRegistrations, focusedRegistrationId),
    [focusedRegistrationId, patientCampRegistrations],
  );
  const journeyContext = useMemo<ClinicalJourneyContext | null>(
    () =>
      contextPatientId
        ? campJourneyContext({
            patientId: contextPatientId,
            activeCampId: campId ?? null,
            activeCampRegistrationId: journeyRegistrationId,
            completedEvents: campCompletedEvents,
          })
        : null,
    [campCompletedEvents, campId, contextPatientId, journeyRegistrationId],
  );
  const workTabs = [
    { value: "registrations", label: "Registrations", icon: <IconUsers size={16} /> },
    { value: "screenings", label: "Clinical Screening", icon: <IconStethoscope size={16} /> },
    { value: "followups", label: "Follow-up", icon: <IconCalendarCheck size={16} /> },
    { value: "analytics", label: "Report", icon: <IconChartBar size={16} /> },
  ] satisfies Array<{
    value: CampWorkTabValue;
    label: string;
    icon: ReactNode;
  }>;
  const activeWorkTab = workTabs.some((tab) => tab.value === activeTab)
    ? activeTab
    : "registrations";

  const openRegistrationClinicalFlow = (registrationId: string) => {
    setFocusedRegistrationId(registrationId);
    setActiveTab("screenings");
  };

  return (
    <Stack className={classes.campWorkspace}>
      <PageHeader
        title={selectedCamp ? `Work Camp · ${selectedCamp.name}` : "Work Camp"}
        subtitle={
          selectedCamp
            ? `${selectedCamp.camp_code} · ${selectedCamp.scheduled_date} · ${selectedCamp.venue_name ?? "Venue not set"}`
            : "Choose an active camp to start registration and screening"
        }
        actions={
          <Button tone="secondary" onClick={() => navigate(campLandingPath(contextPatientId))}>
            Back to Camp Management
          </Button>
        }
      />
      <Card withBorder className={classes.commandBar}>
        <Stack gap="xs">
          {contextPatientId && (
            <>
              <PatientContextBanner patientId={contextPatientId} hideLoadingState />
              <PatientFlowNavigator
                patientId={contextPatientId}
                active="camp"
                activeCampId={campId ?? null}
                activeCampRegistrationId={journeyRegistrationId}
                completedEvents={campCompletedEvents}
                compact
              />
            </>
          )}
          <Group justify="space-between" align="flex-start" gap="sm">
            <Stack gap={4}>
              <Group gap="xs">
                <Badge tone={selectedCamp ? "success" : "neutral"} variant="filled">
                  {selectedCamp ? "Active camp context" : "No active camp"}
                </Badge>
                {selectedCamp && (
                  <>
                    <Text size="sm" fw={700}>
                      {selectedCamp.camp_code} · {selectedCamp.name}
                    </Text>
                    <Badge
                      tone={CAMP_STATUS_COLORS[selectedCamp.status] ?? "neutral"}
                      variant="light"
                    >
                      {selectedCamp.status}
                    </Badge>
                  </>
                )}
              </Group>
              <Text size="xs" c="dimmed">
                {selectedCamp
                  ? `${selectedCamp.scheduled_date} · ${selectedCamp.venue_name ?? "Venue not set"}`
                  : "Choose an active camp to start registration and screening"}
              </Text>
            </Stack>
            {journeyContext && (
              <PatientJourneyActions
                context={journeyContext}
                hiddenActionIds={["camp.open_context"]}
                size="xs"
              />
            )}
          </Group>
        </Stack>
      </Card>

      <Tabs value={activeWorkTab} onChange={setActiveTab} keepMounted={false}>
        <Grid align="flex-start" className={classes.workspaceGrid}>
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Stack className={classes.workspaceMain}>
              <Tabs.List>
                {workTabs.map((tab) => (
                  <Tabs.Tab key={tab.value} value={tab.value} leftSection={tab.icon}>
                    {tab.label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>

              <Tabs.Panel id="camp-registrations" value="registrations" pt="md">
                <RegistrationsTab
                  campId={campId ?? null}
                  selectedCamp={selectedCamp}
                  contextPatientId={contextPatientId}
                  onScreenRegistration={openRegistrationClinicalFlow}
                />
              </Tabs.Panel>
              <Tabs.Panel id="camp-screenings" value="screenings" pt="md">
                <ScreeningsTab
                  key={`${campId ?? "none"}-${focusedRegistrationId ?? "none"}`}
                  campId={campId ?? null}
                  selectedCamp={selectedCamp}
                  focusedRegistrationId={focusedRegistrationId}
                  onClearFocusedRegistration={() => setFocusedRegistrationId(null)}
                />
              </Tabs.Panel>
              <Tabs.Panel id="camp-followups" value="followups" pt="md">
                <FollowupsTab campId={campId ?? null} selectedCamp={selectedCamp} />
              </Tabs.Panel>
              <Tabs.Panel id="camp-report" value="analytics" pt="md">
                <CampAnalyticsTab campId={campId ?? null} selectedCamp={selectedCamp} />
              </Tabs.Panel>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Box className={classes.contextRail}>
              <Stack gap="sm">
                <Stack gap={2}>
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                    Camp workspace
                  </Text>
                  <Text size="sm" fw={700}>
                    {selectedCamp ? selectedCamp.camp_code : "Select camp"}
                  </Text>
                </Stack>
                <Select
                  placeholder="Select active camp"
                  data={activeCamps.map((camp) => ({
                    value: camp.id,
                    label: `${camp.camp_code} - ${camp.name}`,
                  }))}
                  value={campId ?? null}
                  onChange={(nextCampId) => {
                    setFocusedRegistrationId(null);
                    if (nextCampId) {
                      navigate(campWorkPath(nextCampId, contextPatientId));
                    }
                  }}
                  searchable
                  disabled={activeCamps.length === 0}
                />
                <Divider />
                <Stack gap="xs">
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                    Navigate
                  </Text>
                  {workTabs.map((tab) => (
                    <Button
                      key={tab.value}
                      tone={activeWorkTab === tab.value ? "primary" : "secondary"}
                      size="xs"
                      leftSection={tab.icon}
                      onClick={() => setActiveTab(tab.value)}
                      fullWidth
                    >
                      {tab.label}
                    </Button>
                  ))}
                </Stack>
                <Divider />
                <Stack gap="xs">
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                    Actions
                  </Text>
                  <Button
                    tone="secondary"
                    size="xs"
                    leftSection={<IconUsers size={14} />}
                    disabled={!selectedCamp}
                    onClick={() => setActiveTab("registrations")}
                    fullWidth
                  >
                    Register
                  </Button>
                  <Button
                    tone="secondary"
                    size="xs"
                    leftSection={<IconStethoscope size={14} />}
                    disabled={!selectedCamp}
                    onClick={() => setActiveTab("screenings")}
                    fullWidth
                  >
                    Screen
                  </Button>
                  <Button
                    tone="secondary"
                    size="xs"
                    leftSection={<IconCalendarCheck size={14} />}
                    disabled={!selectedCamp}
                    onClick={() => setActiveTab("followups")}
                    fullWidth
                  >
                    Follow-up
                  </Button>
                  <Button
                    tone="secondary"
                    size="xs"
                    leftSection={<IconArrowRight size={14} />}
                    onClick={() => navigate(campLandingPath(contextPatientId))}
                    fullWidth
                  >
                    Camp Management
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </Grid.Col>
        </Grid>
      </Tabs>
    </Stack>
  );
}

export function CampCreatePage() {
  return <CampPage />;
}

export function CampPlanEditPage() {
  return <CampWorkPage initialTab="analytics" />;
}

export function CampClinicalRoutePage() {
  return <CampWorkPage initialTab="screenings" />;
}

export function CampScreeningCreatePage() {
  return <CampWorkPage initialTab="screenings" />;
}

export function CampLabSampleCreatePage() {
  return <CampWorkPage initialTab="screenings" />;
}

export function CampTeamMemberAddPage() {
  return <CampWorkPage initialTab="analytics" />;
}

export function CampAssetReturnPage() {
  return <CampWorkPage initialTab="analytics" />;
}

export function CampBillingCreatePage() {
  return <CampWorkPage initialTab="registrations" />;
}

export function CampFollowupCreatePage() {
  return <CampWorkPage initialTab="followups" />;
}

interface PatientCampRegistrationRow extends CampRegistration {
  camp_name: string;
  camp_code: string;
  camp_status: string;
}

function CampPatientContextPanel({ patientId }: { patientId: string }) {
  const { t } = useTranslation("camp");
  const navigate = useNavigate();
  const canViewRegistrations = useHasPermission(P.CAMP.REGISTRATIONS_LIST);
  const { data: camps = [] } = useQuery({
    queryKey: ["camps"],
    queryFn: () => campService.listCamps(),
    enabled: canViewRegistrations,
  });
  const campLookup = useMemo(() => new Map(camps.map((camp) => [camp.id, camp])), [camps]);
  const { data: patientRegistrations = [], isLoading } = useQuery<CampRegistration[]>({
    queryKey: ["camp-registrations", "patient", patientId],
    queryFn: () => campService.listCampRegistrations({ patient_id: patientId }),
    enabled: canViewRegistrations && patientId.length > 0,
  });
  const registrations = useMemo<PatientCampRegistrationRow[]>(
    () =>
      patientRegistrations.map((registration) => {
        const camp = campLookup.get(registration.camp_id);
        return {
          ...registration,
          camp_name: camp?.name ?? registration.camp_id,
          camp_code: camp?.camp_code ?? registration.camp_id.slice(0, 8),
          camp_status: camp?.status ?? "unknown",
        };
      }),
    [campLookup, patientRegistrations],
  );
  const patientCampCompletedEvents = useMemo(
    () => deriveCampJourneyCompletedEvents(registrations),
    [registrations],
  );

  const activeCamps = camps.filter((camp) => camp.status === "active");
  const activePatientRegistration =
    registrations.find((registration) => registration.camp_status === "active") ?? null;
  const targetCampId = activePatientRegistration?.camp_id ?? activeCamps[0]?.id ?? null;
  const columns: Column<PatientCampRegistrationRow>[] = [
    {
      key: "camp_code",
      label: t("patientHistory.columns.camp"),
      render: (row) => (
        <Stack gap={0}>
          <Text size="sm" fw={600}>
            {row.camp_code}
          </Text>
          <Text size="xs" c="dimmed">
            {row.camp_name}
          </Text>
        </Stack>
      ),
    },
    {
      key: "registration_number",
      label: t("patientHistory.columns.registration"),
      render: (row) => row.registration_number,
    },
    {
      key: "status",
      label: t("patientHistory.columns.status"),
      render: (row) => <CampRegistrationSignals registration={row} />,
    },
    {
      key: "chief_complaint",
      label: t("patientHistory.columns.complaint"),
      render: (row) => row.chief_complaint ?? "—",
    },
    {
      key: "actions",
      label: t("patientHistory.columns.actions"),
      render: (row) => (
        <Group gap="xs">
          <Button
            tone="secondary"
            size="xs"
            onClick={() => navigate(campClinicalRoutePath(row.camp_id, row.id, patientId))}
          >
            {t("patientHistory.actions.openFlow")}
          </Button>
          <Button
            tone="ghost"
            size="xs"
            onClick={() => navigate(campWorkPath(row.camp_id, patientId))}
          >
            {t("patientHistory.actions.workCamp")}
          </Button>
        </Group>
      ),
    },
  ];

  return (
    <Stack mb="md">
      <PatientContextBanner patientId={patientId} hideLoadingState />
      <PatientFlowNavigator
        patientId={patientId}
        active="camp"
        activeCampId={targetCampId}
        activeCampRegistrationId={activePatientRegistration?.id ?? null}
        completedEvents={patientCampCompletedEvents}
        compact
      />
      <CampPatientActionBar
        patientId={patientId}
        activeCampId={targetCampId}
        activeCampRegistrationId={activePatientRegistration?.id ?? null}
        completedEvents={patientCampCompletedEvents}
      />
      {canViewRegistrations ? (
        <Card withBorder>
          <Stack>
            <Group justify="space-between" align="center">
              <Stack gap={0}>
                <Text fw={700}>{t("patientHistory.title")}</Text>
                <Text size="xs" c="dimmed">
                  {t("patientHistory.description")}
                </Text>
              </Stack>
              {activeCamps.length > 0 && (
                <Select
                  placeholder={t("patientHistory.registerInActiveCamp")}
                  data={activeCamps.map((camp) => ({
                    value: camp.id,
                    label: `${camp.camp_code} - ${camp.name}`,
                  }))}
                  onChange={(campId) => {
                    if (campId) {
                      navigate(campWorkPath(campId, patientId));
                    }
                  }}
                  w={320}
                  searchable
                />
              )}
            </Group>
            <DataTable
              columns={columns}
              data={registrations}
              loading={isLoading}
              rowKey={(row) => row.id}
            />
          </Stack>
        </Card>
      ) : (
        <Alert tone="warning">{t("patientHistory.restricted")}</Alert>
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Camps Tab
// ══════════════════════════════════════════════════════════

function CampsTab({ onWorkCamp }: { onWorkCamp: (campId: string) => void }) {
  const emit = useClinicalEmit();
  const canCreate = useHasPermission(P.CAMP.CREATE);
  const canUpdate = useHasPermission(P.CAMP.UPDATE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);
  const [detailOpen, detailHandlers] = useDisclosure(false);
  const [selectedCamp, setSelectedCamp] = useState<Camp | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const campDefaults: CampCreateFormInput = {
    name: "",
    camp_type: "general_health",
    organizing_department_id: null,
    supporting_department_ids: [],
    coordinator_id: null,
    planned_doctor_ids: [],
    planned_staff_ids: [],
    external_people: [],
    service_lines: [],
    service_offerings: [],
    doctor_engagements: [],
    planned_medicines: [],
    planned_medicine_ids: [],
    planned_medicine_refs: [],
    camp_charge_mode: "free",
    department_charge_mode: "free",
    doctor_charge_mode: "free",
    medicine_charge_mode: "free",
    free_medicine_approval_required: true,
    service_policy_notes: "",
    budget_doctor_amount: "",
    budget_medicine_amount: "",
    budget_diagnostics_amount: "",
    budget_consumables_amount: "",
    budget_transport_amount: "",
    budget_food_amount: "",
    budget_other_amount: "",
    sponsor_covered_amount: "",
    patient_expected_collection: "",
    budget_notes: "",
    scheduled_date: "",
    start_time: "",
    end_time: "",
    venue_name: "",
    venue_address: "",
    venue_city: "",
    venue_state: "",
    venue_pincode: "",
    expected_participants: "",
    budget_allocated: "",
    is_free: true,
    logistics_notes: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<CampCreateFormInput>({
    resolver: zodResolver(campCreateFormSchema),
    defaultValues: campDefaults,
  });

  const { data: camps = [], isLoading } = useQuery({
    queryKey: ["camps", statusFilter],
    queryFn: () => campService.listCamps(statusFilter ? { status: statusFilter } : undefined),
  });
  const { data: departments = [] } = useQuery<DepartmentRow[]>({
    queryKey: ["departments"],
    queryFn: () => lookupsService.listDepartments(),
    staleTime: 600_000,
  });
  const departmentOptions = useMemo(
    () =>
      departments
        .filter((department) =>
          ["clinical", "para_clinical", "diagnostic"].includes(department.department_type),
        )
        .map((department) => ({ value: department.id, label: department.name })),
    [departments],
  );

  const createMut = useMutation({
    mutationFn: (data: CreateCampRequest) => campService.createCamp(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camps"] });
      createHandlers.close();
      reset(campDefaults);
      notifications.show({
        title: "Camp Created",
        message: "Camp planned successfully",
        color: "success",
      });
    },
  });

  const handleCreateCamp = (values: CampCreateFormInput) => {
    createMut.mutate({
      name: values.name.trim(),
      camp_type: values.camp_type,
      organizing_department_id: values.organizing_department_id ?? undefined,
      coordinator_id: values.coordinator_id ?? undefined,
      scheduled_date: values.scheduled_date.trim(),
      start_time: campOptionalText(values.start_time),
      end_time: campOptionalText(values.end_time),
      venue_name: campOptionalText(values.venue_name),
      venue_address: campOptionalText(values.venue_address),
      venue_city: campOptionalText(values.venue_city),
      venue_state: campOptionalText(values.venue_state),
      venue_pincode: campOptionalText(values.venue_pincode),
      expected_participants: campOptionalInteger(values.expected_participants),
      budget_allocated: campOptionalNumber(values.budget_allocated),
      is_free: values.is_free,
      logistics_notes: campOptionalText(values.logistics_notes),
    });
  };

  const approveMut = useMutation({
    mutationFn: (id: string) => campService.approveCamp(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camps"] });
      notifications.show({ title: "Approved", message: "Camp approved", color: "success" });
    },
  });

  const activateMut = useMutation({
    mutationFn: (id: string) => campService.activateCamp(id),
    onSuccess: (camp) => {
      emit("camp.started", {
        camp_code: camp.camp_code,
        camp_id: camp.id,
        camp_type: camp.camp_type,
        scheduled_date: camp.scheduled_date,
        source_record_id: camp.id,
        status: camp.status,
      });
      void qc.invalidateQueries({ queryKey: ["camps"] });
      notifications.show({ title: "Activated", message: "Camp is now active", color: "success" });
    },
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => campService.completeCamp(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camps"] });
      notifications.show({
        title: "Completed",
        message: "Camp marked as completed",
        color: "teal",
      });
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => campService.cancelCamp(id, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camps"] });
      notifications.show({ title: "Cancelled", message: "Camp cancelled", color: "danger" });
    },
  });

  const columns: Column<Camp>[] = [
    {
      key: "camp_code",
      label: "Code",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.camp_code}
        </Text>
      ),
    },
    { key: "name", label: "Name", render: (r) => r.name },
    {
      key: "camp_type",
      label: "Type",
      render: (r) => (
        <Badge tone="neutral" variant="light" size="sm">
          {campTypeOptions.find((t) => t.value === r.camp_type)?.label ?? r.camp_type}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge tone={CAMP_STATUS_COLORS[r.status] ?? "neutral"} variant="filled" size="sm">
          {r.status}
        </Badge>
      ),
    },
    { key: "scheduled_date", label: "Date", render: (r) => r.scheduled_date },
    { key: "venue_city", label: "City", render: (r) => r.venue_city ?? "—" },
    {
      key: "expected_participants",
      label: "Expected",
      render: (r) => r.expected_participants?.toString() ?? "—",
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Group gap={4}>
          <Tooltip label="View Details">
            <IconButton
              size="sm"
              onClick={() => {
                setSelectedCamp(r);
                detailHandlers.open();
              }}
              aria-label="View Details"
            >
              <IconPencil size={14} />
            </IconButton>
          </Tooltip>
          {r.status === "active" && (
            <Tooltip label="Work in this camp" closeDelay={0} withinPortal={false}>
              <IconButton
                tone="success"
                size="sm"
                onClick={(event) => {
                  event.currentTarget.blur();
                  onWorkCamp(r.id);
                }}
                aria-label="Work in this camp"
              >
                <IconUsers size={14} />
              </IconButton>
            </Tooltip>
          )}
          {canUpdate && r.status === "planned" && (
            <Tooltip label="Approve">
              <IconButton
                tone="primary"
                size="sm"
                onClick={() => approveMut.mutate(r.id)}
                aria-label="Approve"
              >
                <IconCheck size={14} />
              </IconButton>
            </Tooltip>
          )}
          {canUpdate && (r.status === "approved" || r.status === "setup") && (
            <Tooltip label="Activate">
              <IconButton
                tone="success"
                size="sm"
                onClick={() => activateMut.mutate(r.id)}
                aria-label="Activate"
              >
                <IconPlayerPlay size={14} />
              </IconButton>
            </Tooltip>
          )}
          {canUpdate && r.status === "active" && (
            <Tooltip label="Complete">
              <IconButton
                tone="success"
                size="sm"
                onClick={() => completeMut.mutate(r.id)}
                aria-label="Complete"
              >
                <IconCheck size={14} />
              </IconButton>
            </Tooltip>
          )}
          {canUpdate && !["completed", "cancelled"].includes(r.status) && (
            <Tooltip label="Cancel">
              <IconButton
                tone="danger"
                size="sm"
                onClick={() => cancelMut.mutate(r.id)}
                aria-label="Cancel"
              >
                <IconX size={14} />
              </IconButton>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select
          placeholder="Filter by status"
          clearable
          data={Object.keys(CAMP_STATUS_COLORS).map((s) => ({
            value: s,
            label: s.charAt(0).toUpperCase() + s.slice(1),
          }))}
          value={statusFilter}
          onChange={setStatusFilter}
          w={200}
        />
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={createHandlers.open}>
            Plan Camp
          </Button>
        )}
      </Group>

      <DataTable columns={columns} data={camps} loading={isLoading} rowKey={(r) => r.id} />

      {/* Create Drawer */}
      <Drawer
        opened={createOpen}
        onClose={() => {
          createHandlers.close();
          reset(campDefaults);
        }}
        title="Plan New Camp"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleSubmit(handleCreateCamp)}>
          <TextInput
            label="Camp Name"
            required
            error={errors.name?.message}
            {...register("name")}
          />
          <Controller
            control={control}
            name="camp_type"
            render={({ field }) => (
              <Select
                label="Camp Type"
                required
                data={campTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "general_health")}
                error={errors.camp_type?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="organizing_department_id"
            render={({ field }) => (
              <Select
                label="Organizing department"
                description="This becomes the OPD department when a camp participant is opened clinically."
                placeholder="Select service department"
                data={departmentOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? null)}
                error={errors.organizing_department_id?.message}
                searchable
                required
              />
            )}
          />
          <Controller
            control={control}
            name="coordinator_id"
            render={({ field }) => (
              <EmployeeSearchSelect
                label="Camp coordinator / attending doctor"
                value={field.value ?? ""}
                onChange={(value) => field.onChange(value || null)}
              />
            )}
          />
          <Controller
            control={control}
            name="scheduled_date"
            render={({ field }) => (
              <DateInput
                label="Scheduled Date"
                required
                value={field.value ? new Date(field.value) : null}
                onChange={(date) =>
                  field.onChange(date ? new Date(date).toISOString().slice(0, 10) : "")
                }
                error={errors.scheduled_date?.message}
              />
            )}
          />
          <TextInput
            label="Start Time"
            placeholder="09:00"
            error={errors.start_time?.message}
            {...register("start_time")}
          />
          <TextInput
            label="End Time"
            placeholder="17:00"
            error={errors.end_time?.message}
            {...register("end_time")}
          />
          <TextInput
            label="Venue Name"
            error={errors.venue_name?.message}
            {...register("venue_name")}
          />
          <TextInput
            label="Venue Address"
            error={errors.venue_address?.message}
            {...register("venue_address")}
          />
          <Group grow>
            <TextInput
              label="City"
              error={errors.venue_city?.message}
              {...register("venue_city")}
            />
            <TextInput
              label="State"
              error={errors.venue_state?.message}
              {...register("venue_state")}
            />
            <TextInput
              label="Pincode"
              error={errors.venue_pincode?.message}
              {...register("venue_pincode")}
            />
          </Group>
          <Controller
            control={control}
            name="expected_participants"
            render={({ field }) => (
              <NumberInput
                label="Expected Participants"
                min={0}
                value={field.value}
                onChange={field.onChange}
                error={errors.expected_participants?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="budget_allocated"
            render={({ field }) => (
              <NumberInput
                label="Budget Allocated"
                min={0}
                decimalScale={2}
                value={field.value}
                onChange={field.onChange}
                error={errors.budget_allocated?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="is_free"
            render={({ field }) => (
              <Switch
                label="Free Camp"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Textarea
            label="Logistics Notes"
            error={errors.logistics_notes?.message}
            {...register("logistics_notes")}
          />
          <Button tone="primary" type="submit" loading={createMut.isPending}>
            Create Camp
          </Button>
        </Stack>
      </Drawer>

      {/* Detail Drawer */}
      <Drawer
        opened={detailOpen}
        onClose={detailHandlers.close}
        title={selectedCamp?.name ?? "Camp Detail"}
        position="right"
        size="lg"
      >
        {selectedCamp && <CampDetail camp={selectedCamp} />}
      </Drawer>
    </>
  );
}

// ── Camp Detail (team management + stats) ────────────

function RegistrationsTab({
  campId,
  selectedCamp,
  contextPatientId,
  onScreenRegistration,
}: {
  campId: string | null;
  selectedCamp: Camp | null;
  contextPatientId: string;
  onScreenRegistration: (registrationId: string) => void;
}) {
  const { t } = useTranslation("camp");
  const canCreate = useHasPermission(P.CAMP.REGISTRATIONS_CREATE);
  const canOpenClinicalVisit = useHasPermission(P.OPD.VISIT_CREATE);
  const campNameAccess = useProtectedFieldAccess(CAMP_REGISTRATION_NAME_FIELD_ACCESS_KEY);
  const campPhoneAccess = useProtectedFieldAccess(CAMP_REGISTRATION_PHONE_FIELD_ACCESS_KEY);
  const campIdProofAccess = useProtectedFieldAccess(CAMP_REGISTRATION_ID_PROOF_FIELD_ACCESS_KEY);
  const patientNameAccess = useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS);
  const patientUhidAccess = useProtectedFieldAccess(PATIENT_UHID_FIELD_ACCESS_KEY);
  const canEditCampName = campNameAccess === "edit";
  const canEditCampPhone = campPhoneAccess === "edit";
  const canEditCampIdProof = campIdProofAccess === "edit";
  const qc = useQueryClient();
  const emit = useClinicalEmit();
  const [createOpen, createHandlers] = useDisclosure(false);
  const [routeOpen, routeHandlers] = useDisclosure(false);
  const [clinicalOpen, clinicalHandlers] = useDisclosure(false);
  const [clinicalContext, setClinicalContext] = useState<CampOpenEncounterResponse | null>(null);
  const [selectedRegistrationForClinical, setSelectedRegistrationForClinical] =
    useState<CampRegistration | null>(null);
  const [statusTab, setStatusTab] = useState<string | null>("all");
  const [patientSearch, setPatientSearch] = useState("");
  const registrationDefaults: CampRegistrationFormInput = {
    person_name: "",
    age: "",
    gender: "",
    phone: "",
    address: "",
    id_proof_type: "",
    id_proof_number: "",
    clinical_department_id: null,
    attending_doctor_id: null,
    service_line: "",
    chief_complaint: "",
    is_walk_in: true,
  };
  const clinicalVisitDefaults: CampClinicalVisitFormInput = {
    department_id: null,
    doctor_id: null,
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<CampRegistrationFormInput>({
    resolver: zodResolver(campRegistrationFormSchema),
    defaultValues: registrationDefaults,
  });
  const {
    control: clinicalControl,
    reset: resetClinicalVisit,
    handleSubmit: handleClinicalVisitSubmit,
    formState: { errors: clinicalErrors },
  } = useForm<CampClinicalVisitFormInput>({
    resolver: zodResolver(campClinicalVisitFormSchema),
    defaultValues: clinicalVisitDefaults,
  });

  const { data: departments = [] } = useQuery<DepartmentRow[]>({
    queryKey: ["departments"],
    queryFn: () => lookupsService.listDepartments(),
    staleTime: 600_000,
  });
  const departmentOptions = useMemo(
    () =>
      departments
        .filter((department) =>
          ["clinical", "para_clinical", "diagnostic"].includes(department.department_type),
        )
        .map((department) => ({ value: department.id, label: department.name })),
    [departments],
  );

  const { data: regs = [], isLoading } = useQuery({
    queryKey: ["camp-registrations", campId, contextPatientId],
    queryFn: () =>
      campService.listCampRegistrations({
        camp_id: campId ?? "",
        patient_id: contextPatientId || undefined,
      }),
    enabled: !!campId,
  });
  const filteredRegs = useMemo(() => {
    const byStatus = statusTab === "all" ? regs : regs.filter((row) => row.status === statusTab);
    const needle = patientSearch.trim().toLowerCase();
    if (!needle) return byStatus;

    return byStatus.filter((row) => {
      const haystack = [
        row.registration_number,
        row.person_name,
        row.phone,
        row.id_proof_number,
        row.patient_id,
        row.chief_complaint,
      ].filter((value): value is string => Boolean(value));

      return haystack.some((value) => value.toLowerCase().includes(needle));
    });
  }, [patientSearch, regs, statusTab]);

  const createMut = useMutation({
    mutationFn: (data: CreateCampRegistrationRequest) => campService.createCampRegistration(data),
    onSuccess: (registration) => {
      if (registration.patient_id) {
        emit("camp.registration.created", {
          camp_id: registration.camp_id,
          patient_id: registration.patient_id,
          registration_number: registration.registration_number,
          registration_id: registration.id,
          source_record_id: registration.id,
        });
      }
      void qc.invalidateQueries({ queryKey: ["camp-registrations"] });
      createHandlers.close();
      reset(registrationDefaults);
      notifications.show({
        title: t("notify.registered"),
        message: t("notify.participantRegistered"),
        color: "success",
      });
    },
  });

  const openClinicalVisitMut = useMutation({
    mutationFn: ({
      registration,
      values,
    }: {
      registration: CampRegistration;
      values: CampClinicalVisitFormInput;
    }) =>
      campService.openCampRegistrationEncounter(registration.id, {
        department_id: values.department_id,
        doctor_id: values.doctor_id,
      }),
    onSuccess: (result, { registration }) => {
      emit("opd.encounter.created", {
        camp_id: registration.camp_id,
        camp_registration_id: registration.id,
        department_id: result.department_id,
        doctor_id: result.doctor_id,
        encounter_id: result.encounter_id,
        patient_id: result.patient_id,
        queue_entry_id: result.queue_id,
        registration_id: registration.id,
        registration_number: registration.registration_number,
        source_record_id: result.encounter_id,
      });
      setClinicalContext(result);
      routeHandlers.close();
      setSelectedRegistrationForClinical(null);
      resetClinicalVisit(clinicalVisitDefaults);
      clinicalHandlers.open();
      void qc.invalidateQueries({ queryKey: ["camp-registrations"] });
      void qc.invalidateQueries({ queryKey: ["opd-queue"] });
    },
    onError: () => {
      notifications.show({
        title: t("notify.unableToOpenClinicalDrawer"),
        message: t("notify.selectDepartmentAndPermission"),
        color: "danger",
      });
    },
  });

  const openClinicalRouting = (registration: CampRegistration, forceRoute = false) => {
    const departmentId =
      registration.clinical_department_id ?? selectedCamp?.organizing_department_id ?? null;
    const doctorId = registration.attending_doctor_id ?? null;
    const values: CampClinicalVisitFormInput = {
      department_id: departmentId,
      doctor_id: doctorId,
    };

    if (!forceRoute && registration.clinical_department_id) {
      openClinicalVisitMut.mutate({ registration, values });
      return;
    }

    setSelectedRegistrationForClinical(registration);
    resetClinicalVisit(values);
    routeHandlers.open();
  };

  const submitClinicalRouting = (values: CampClinicalVisitFormInput) => {
    if (!selectedRegistrationForClinical) return;
    openClinicalVisitMut.mutate({
      registration: selectedRegistrationForClinical,
      values,
    });
  };

  const handleCreateRegistration = (values: CampRegistrationFormInput) => {
    if (!campId) return;
    createMut.mutate({
      camp_id: campId,
      person_name: values.person_name.trim(),
      age: campOptionalInteger(values.age),
      gender: campOptionalText(values.gender),
      phone: campOptionalText(values.phone),
      address: campOptionalText(values.address),
      id_proof_type: campOptionalText(values.id_proof_type),
      id_proof_number: campOptionalText(values.id_proof_number),
      clinical_department_id: values.clinical_department_id ?? undefined,
      attending_doctor_id: values.attending_doctor_id ?? undefined,
      service_line: campOptionalText(values.service_line),
      chief_complaint: campOptionalText(values.chief_complaint),
      is_walk_in: values.is_walk_in,
      patient_id: contextPatientId || undefined,
    });
  };

  const columns: Column<CampRegistration>[] = [
    {
      key: "registration_number",
      label: t("registrations.columns.registration"),
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.registration_number}
        </Text>
      ),
    },
    {
      key: "person_name",
      label: t("registrations.columns.name"),
      fieldAccessKey: CAMP_REGISTRATION_NAME_FIELD_ACCESS_KEY,
      accessor: (r) => r.person_name,
      fieldKind: "name",
      hiddenLabel: t("registrations.restrictedParticipant"),
      render: (r) => r.person_name,
    },
    { key: "age", label: t("registrations.columns.age"), render: (r) => r.age?.toString() ?? "—" },
    { key: "gender", label: t("registrations.columns.gender"), render: (r) => r.gender ?? "—" },
    {
      key: "phone",
      label: t("registrations.columns.phone"),
      fieldAccessKey: CAMP_REGISTRATION_PHONE_FIELD_ACCESS_KEY,
      accessor: (r) => r.phone,
      fieldKind: "phone",
      hiddenLabel: t("registrations.restrictedPhone"),
      render: (r) => r.phone ?? "—",
    },
    {
      key: "status",
      label: t("registrations.columns.status"),
      render: (r) => <CampRegistrationSignals registration={r} />,
    },
    {
      key: "chief_complaint",
      label: t("registrations.columns.complaint"),
      render: (r) => r.chief_complaint ?? "—",
    },
    {
      key: "actions",
      label: t("registrations.columns.actions"),
      render: (r) => (
        <Group gap={4}>
          <Tooltip
            label={t("registrations.actions.recordScreening")}
            closeDelay={0}
            withinPortal={false}
          >
            <IconButton
              tone="primary"
              size="sm"
              onClick={(event) => {
                event.currentTarget.blur();
                onScreenRegistration(r.id);
              }}
              aria-label={t("registrations.actions.recordScreening")}
            >
              <IconStethoscope size={14} />
            </IconButton>
          </Tooltip>
          {canOpenClinicalVisit && (
            <Tooltip
              label={
                r.clinical_department_id
                  ? t("registrations.actions.openOpd")
                  : t("registrations.actions.selectDepartmentOpenOpd")
              }
              closeDelay={0}
              withinPortal={false}
            >
              <IconButton
                tone="success"
                size="sm"
                loading={openClinicalVisitMut.isPending}
                onClick={(event) => {
                  event.currentTarget.blur();
                  openClinicalRouting(r);
                }}
                aria-label={t("registrations.actions.openOpd")}
              >
                <IconArrowRight size={14} />
              </IconButton>
            </Tooltip>
          )}
          {canOpenClinicalVisit && r.clinical_department_id && (
            <Tooltip
              label={t("registrations.actions.changeDepartmentDoctor")}
              closeDelay={0}
              withinPortal={false}
            >
              <IconButton
                size="sm"
                onClick={(event) => {
                  event.currentTarget.blur();
                  openClinicalRouting(r, true);
                }}
                aria-label={t("registrations.actions.changeDepartmentDoctor")}
              >
                <IconTransferIn size={14} />
              </IconButton>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Stack gap={2}>
          <Text fw={600}>
            {selectedCamp ? selectedCamp.name : t("registrations.selectActiveCamp")}
          </Text>
          <Text size="xs" c="dimmed">
            {contextPatientId
              ? t("registrations.linkedToPatient")
              : t("registrations.newParticipantsContext")}
          </Text>
        </Stack>
        {canCreate && campId && (
          <Tooltip
            label={
              canEditCampName
                ? t("registrations.actions.registerParticipant")
                : t("registrations.nameEditRequired")
            }
          >
            <span>
              <Button
                tone="primary"
                leftSection={<IconPlus size={16} />}
                onClick={createHandlers.open}
                disabled={!canEditCampName}
              >
                {t("registrations.actions.registerParticipant")}
              </Button>
            </span>
          </Tooltip>
        )}
      </Group>

      {campId ? (
        <Stack>
          <TextInput
            label={t("registrations.searchLabel")}
            placeholder={
              contextPatientId
                ? t("registrations.searchLinkedPlaceholder")
                : t("registrations.searchPlaceholder")
            }
            value={patientSearch}
            onChange={(event) => setPatientSearch(event.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            rightSection={
              patientSearch ? (
                <IconButton
                  size="sm"
                  aria-label={t("registrations.clearSearch")}
                  onClick={() => setPatientSearch("")}
                >
                  <IconX size={14} />
                </IconButton>
              ) : null
            }
          />
          <Tabs value={statusTab} onChange={setStatusTab}>
            <Tabs.List>
              <Tabs.Tab value="all">{t("registrationStatus.all")}</Tabs.Tab>
              <Tabs.Tab value="registered">{t("registrationStatus.registered")}</Tabs.Tab>
              <Tabs.Tab value="screened">{t("registrationStatus.screened")}</Tabs.Tab>
              <Tabs.Tab value="referred">{t("registrationStatus.referred")}</Tabs.Tab>
              <Tabs.Tab value="converted">{t("registrationStatus.converted")}</Tabs.Tab>
            </Tabs.List>
          </Tabs>
          <DataTable
            columns={columns}
            data={filteredRegs}
            loading={isLoading}
            rowKey={(r) => r.id}
          />
        </Stack>
      ) : (
        <Text c="dimmed" ta="center" mt="xl">
          {t("registrations.selectActiveCampToView")}
        </Text>
      )}

      <Drawer
        opened={createOpen}
        onClose={() => {
          createHandlers.close();
          reset(registrationDefaults);
        }}
        title="Register Participant"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleSubmit(handleCreateRegistration)}>
          <TextInput
            label="Person Name"
            required
            error={errors.person_name?.message}
            disabled={!canEditCampName}
            {...register("person_name")}
          />
          <Group grow>
            <Controller
              control={control}
              name="age"
              render={({ field }) => (
                <NumberInput
                  label="Age"
                  min={0}
                  max={150}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.age?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <Select
                  label="Gender"
                  data={[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                    { value: "other", label: "Other" },
                  ]}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.gender?.message}
                  clearable
                />
              )}
            />
          </Group>
          <TextInput
            label="Phone"
            error={errors.phone?.message}
            disabled={!canEditCampPhone}
            {...register("phone")}
          />
          <Textarea label="Address" error={errors.address?.message} {...register("address")} />
          <Group grow>
            <Controller
              control={control}
              name="clinical_department_id"
              render={({ field }) => (
                <Select
                  label="Service department"
                  placeholder="Optional at registration"
                  data={departmentOptions}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? null)}
                  error={errors.clinical_department_id?.message}
                  clearable
                  searchable
                />
              )}
            />
            <Controller
              control={control}
              name="attending_doctor_id"
              render={({ field }) => (
                <DoctorSearchSelect
                  label="Attending doctor"
                  placeholder="Optional at registration"
                  value={field.value ?? ""}
                  onChange={(value) => field.onChange(value || null)}
                />
              )}
            />
          </Group>
          <Controller
            control={control}
            name="service_line"
            render={({ field }) => (
              <Select
                label="Camp service needed"
                placeholder="Opinion, X-ray, lab, pharmacy..."
                data={CAMP_SERVICE_LINE_OPTIONS}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                error={errors.service_line?.message}
                clearable
                searchable
              />
            )}
          />
          <Group grow>
            <Controller
              control={control}
              name="id_proof_type"
              render={({ field }) => (
                <Select
                  label="ID Proof Type"
                  data={campIdProofTypeOptions}
                  placeholder="Select ID type"
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.id_proof_type?.message}
                  clearable
                  searchable
                  disabled={!canEditCampIdProof}
                />
              )}
            />
            <TextInput
              label="ID Proof Number"
              error={errors.id_proof_number?.message}
              disabled={!canEditCampIdProof}
              {...register("id_proof_number")}
            />
          </Group>
          <Textarea
            label="Chief Complaint"
            error={errors.chief_complaint?.message}
            {...register("chief_complaint")}
          />
          <Controller
            control={control}
            name="is_walk_in"
            render={({ field }) => (
              <Switch
                label="Walk-in"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Button tone="primary" type="submit" loading={createMut.isPending}>
            Register
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={routeOpen}
        onClose={() => {
          routeHandlers.close();
          setSelectedRegistrationForClinical(null);
          resetClinicalVisit(clinicalVisitDefaults);
        }}
        title={
          selectedRegistrationForClinical?.clinical_department_id
            ? t("registrations.routeDrawer.changeTitle")
            : t("registrations.routeDrawer.openTitle")
        }
        position="right"
        size="md"
      >
        <Stack component="form" onSubmit={handleClinicalVisitSubmit(submitClinicalRouting)}>
          <Stack gap={2}>
            <Text fw={600}>
              {protectedCampParticipantName(
                selectedRegistrationForClinical?.person_name,
                campNameAccess,
              )}
            </Text>
            <Text size="xs" c="dimmed">
              {t("registrations.routeDrawer.description")}
            </Text>
          </Stack>
          <Controller
            control={clinicalControl}
            name="department_id"
            render={({ field }) => (
              <Select
                label={t("registrations.routeDrawer.department")}
                placeholder={t("registrations.routeDrawer.selectDepartment")}
                data={departmentOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? null)}
                error={clinicalErrors.department_id?.message}
                searchable
                required
              />
            )}
          />
          <Controller
            control={clinicalControl}
            name="doctor_id"
            render={({ field }) => (
              <DoctorSearchSelect
                label={t("registrations.routeDrawer.doctor")}
                placeholder={t("registrations.routeDrawer.selectDoctor")}
                value={field.value ?? ""}
                onChange={(value) => field.onChange(value || null)}
              />
            )}
          />
          <Button tone="primary" type="submit" loading={openClinicalVisitMut.isPending}>
            {t("registrations.routeDrawer.openOpd")}
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={clinicalOpen}
        onClose={() => {
          clinicalHandlers.close();
          setClinicalContext(null);
        }}
        position="right"
        size="100%"
        withCloseButton
        title={
          <Button
            tone="ghost"
            size="xs"
            onClick={() => {
              clinicalHandlers.close();
              setClinicalContext(null);
            }}
            leftSection={<IconArrowRight size={14} style={{ transform: "rotate(180deg)" }} />}
          >
            Back to Camp Work
          </Button>
        }
        styles={{
          header: {
            padding: "6px 12px",
            minHeight: 36,
            borderBottom: "1px solid var(--fc-rule, #e7ebe8)",
          },
          body: { padding: 0, height: "calc(100vh - 36px)", overflow: "hidden" },
        }}
      >
        {clinicalContext && (
          <EncounterDetail
            encounterId={clinicalContext.encounter_id}
            patientId={clinicalContext.patient_id}
            patientName={protectedPatientName(clinicalContext.patient_name, patientNameAccess)}
            uhid={protectedPatientIdentifier(clinicalContext.uhid, patientUhidAccess)}
            doctorId={clinicalContext.doctor_id ?? null}
            departmentId={clinicalContext.department_id}
            canUpdate={canOpenClinicalVisit}
          />
        )}
      </Drawer>
    </>
  );
}

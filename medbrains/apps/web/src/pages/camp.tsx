import { Box, Card, Divider, Grid, Group, Select, Stack, Tabs, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { CampRegistration, ClinicalEventName, ClinicalJourneyContext } from "@medbrains/types";
import { activeCampRegistrationIdForJourney, P } from "@medbrains/types";
import {
  IconArrowRight,
  IconCalendarCheck,
  IconChartBar,
  IconFirstAidKit,
  IconStethoscope,
  IconUsers,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ClinicalEventProvider, DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientFlowNavigator } from "@/components/Patient/PatientFlowNavigator";
import { PatientJourneyActions } from "@/components/Patient/PatientJourneyActions";
import { deriveCampJourneyCompletedEvents } from "@/components/Patient/patient-journey-events";
import { Alert, Badge, Button } from "@/components/ui";
import { useHashTabs } from "@/hooks/useHashTabs";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { campService } from "@/services/camp.service";
import { CampAnalyticsTab } from "./camp/analytics-tab";
import { CampsTab } from "./camp/camps-tab";
import { FollowupsTab } from "./camp/followups-tab";
import { RegistrationsTab } from "./camp/registrations-tab";
import { ScreeningsTab } from "./camp/screenings-tab";
import {
  CAMP_STATUS_COLORS,
  CampRegistrationSignals,
  campClinicalRoutePath,
  campLandingPath,
  campWorkPath,
} from "./camp/shared";
import classes from "./camp.module.scss";
import {
  CAMP_LANDING_TAB_VALUES,
  CAMP_WORK_TAB_VALUES,
  type CampWorkTabValue,
  campJourneyContext,
  campWorkDefaultTab,
} from "./camp-workspace";

// ── Constants ──────────────────────────────────────────

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

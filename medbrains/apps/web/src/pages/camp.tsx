import { Box, Card, Divider, Grid, Group, Select, Stack, Tabs, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { CampRegistration, ClinicalJourneyContext } from "@medbrains/types";
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
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ClinicalEventProvider, PageHeader } from "@/components";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientFlowNavigator } from "@/components/Patient/PatientFlowNavigator";
import { PatientJourneyActions } from "@/components/Patient/PatientJourneyActions";
import { deriveCampJourneyCompletedEvents } from "@/components/Patient/patient-journey-events";
import { Badge, Button } from "@/components/ui";
import { useHashTabs } from "@/hooks/useHashTabs";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { campService } from "@/services/camp.service";
import { CampAnalyticsTab } from "./camp/analytics-tab";
import { CampsTab } from "./camp/camps-tab";
import { FollowupsTab } from "./camp/followups-tab";
import { CampPatientContextPanel } from "./camp/patient-context-panel";
import { RegistrationsTab } from "./camp/registrations-tab";
import { ScreeningsTab } from "./camp/screenings-tab";
import {
  CAMP_STATUS_COLORS,
  campLandingPath,
  campScreeningCreatePath,
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

  // Screening is its own screen now, so handing a participant to it is a
  // navigation carrying the registration rather than a tab switch plus a
  // drawer that opened itself. The focused id is still tracked because the
  // journey rail reads it.
  const openRegistrationClinicalFlow = (registrationId: string) => {
    setFocusedRegistrationId(registrationId);
    navigate(campScreeningCreatePath(campId ?? "", registrationId, contextPatientId));
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

export function CampPlanEditPage() {
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

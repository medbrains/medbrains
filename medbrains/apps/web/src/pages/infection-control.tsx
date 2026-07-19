import "@mantine/charts/styles.css";
import {
  Card,
  Drawer,
  Grid,
  Group,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { CreateExposureRequest, CreateIcMeetingRequest, IcMeeting } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconBiohazard,
  IconBug,
  IconChartBar,
  IconHandStop,
  IconNeedleThread,
  IconPill,
  IconPlus,
  IconShieldCheck,
  IconTemperature,
  IconUsers,
  IconVirusSearch,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { DataTable, IpdContextStrip, ipdContextFromSearchParams, PageHeader } from "@/components";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { InvasiveDevicesPanel } from "@/pages/infection-control/InvasiveDevicesPanel";
import { infectionControlService } from "@/services/infectionControl.service";
import { AnalyticsTab } from "./infection-control/analytics-tab";
import { BiowasteTab } from "./infection-control/biowaste-tab";
import { HygieneTab } from "./infection-control/hygiene-tab";
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

function MeetingsTab() {
  const canCreate = useHasPermission(P.INFECTION_CONTROL.SURVEILLANCE_CREATE);
  const qc = useQueryClient();
  const [subView, setSubView] = useState<string>("meetings");
  const [meetingOpened, { open: openMeeting, close: closeMeeting }] = useDisclosure(false);
  const [exposureOpened, { open: openExposure, close: closeExposure }] = useDisclosure(false);

  // Monthly report state
  const now = new Date();
  const [reportMonth, setReportMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [reportYear, setReportYear] = useState(String(now.getFullYear()));
  const monthParam = `${reportYear}-${reportMonth}`;

  const { data: meetings = [], isLoading: meetingsLoading } = useQuery({
    queryKey: ["ic-meetings"],
    queryFn: () => infectionControlService.listIcMeetings(),
    enabled: subView === "meetings",
  });

  const { data: monthlyReport, isLoading: reportLoading } = useQuery({
    queryKey: ["ic-monthly-report", monthParam],
    queryFn: () => infectionControlService.icMonthlySurveillance({ month: monthParam }),
    enabled: subView === "monthly",
  });

  const [meetingForm, setMeetingForm] = useState<CreateIcMeetingRequest>({
    meeting_date: "",
    meeting_type: "regular",
  });

  const createMeetingMut = useMutation({
    mutationFn: (data: CreateIcMeetingRequest) => infectionControlService.createIcMeeting(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ic-meetings"] });
      notifications.show({ title: "Meeting created", message: "", color: "success" });
      closeMeeting();
      setMeetingForm({ meeting_date: "", meeting_type: "regular" });
    },
  });

  const [exposureForm, setExposureForm] = useState<CreateExposureRequest>({
    event_type: "",
    exposure_date: "",
    exposure_type: "",
    pep_initiated: false,
  });

  const createExposureMut = useMutation({
    mutationFn: (data: CreateExposureRequest) => infectionControlService.createIcExposure(data),
    onSuccess: () => {
      notifications.show({ title: "Exposure recorded", message: "", color: "success" });
      closeExposure();
      setExposureForm({
        event_type: "",
        exposure_date: "",
        exposure_type: "",
        pep_initiated: false,
      });
    },
  });

  const meetingColumns = [
    {
      key: "meeting_date" as const,
      label: "Date",
      render: (r: IcMeeting) => new Date(r.meeting_date).toLocaleDateString(),
    },
    {
      key: "meeting_type" as const,
      label: "Type",
      render: (r: IcMeeting) => <Badge tone="neutral">{r.meeting_type}</Badge>,
    },
    { key: "agenda" as const, label: "Agenda", render: (r: IcMeeting) => r.agenda ?? "---" },
    {
      key: "attendees" as const,
      label: "Attendees",
      render: (r: IcMeeting) => (
        <Badge tone="neutral" size="sm">
          {Array.isArray(r.attendees) ? r.attendees.length : 0}
        </Badge>
      ),
    },
    {
      key: "minutes" as const,
      label: "Minutes",
      render: (r: IcMeeting) =>
        r.minutes ? (
          <Text size="sm" lineClamp={1}>
            {r.minutes}
          </Text>
        ) : (
          "---"
        ),
    },
    {
      key: "action_items" as const,
      label: "Actions",
      render: (r: IcMeeting) => (
        <Badge size="sm" tone="warning">
          {Array.isArray(r.action_items) ? r.action_items.length : 0}
        </Badge>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <SegmentedControl
          value={subView}
          onChange={setSubView}
          data={[
            { value: "meetings", label: "IC Meetings" },
            { value: "exposures", label: "Exposures" },
            { value: "monthly", label: "Monthly Report" },
          ]}
        />
        <Group>
          {canCreate && subView === "meetings" && (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openMeeting}>
              New Meeting
            </Button>
          )}
          {canCreate && subView === "exposures" && (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openExposure}>
              Record Exposure
            </Button>
          )}
        </Group>
      </Group>

      {subView === "meetings" && (
        <DataTable
          columns={meetingColumns}
          data={meetings}
          loading={meetingsLoading}
          rowKey={(r) => r.id}
          emptyTitle="No IC meetings"
        />
      )}

      {subView === "exposures" && (
        <Paper p="md" withBorder>
          <Text fw={600} mb="md">
            Exposure Recording
          </Text>
          <Text c="dimmed" size="sm">
            Use the "Record Exposure" button to log an occupational exposure event (needlestick,
            blood/body fluid contact, etc.).
          </Text>
        </Paper>
      )}

      {subView === "monthly" && (
        <Stack>
          <Group>
            <Select
              label="Month"
              value={reportMonth}
              onChange={(v) => setReportMonth(v ?? reportMonth)}
              data={Array.from({ length: 12 }, (_, i) => ({
                value: String(i + 1).padStart(2, "0"),
                label: new Date(2024, i, 1).toLocaleDateString("en-US", { month: "long" }),
              }))}
              w={160}
            />
            <Select
              label="Year"
              value={reportYear}
              onChange={(v) => setReportYear(v ?? reportYear)}
              data={Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - 2 + i))}
              w={120}
            />
          </Group>
          {reportLoading ? (
            <Text c="dimmed">Loading monthly report...</Text>
          ) : monthlyReport ? (
            <Grid>
              <Grid.Col span={{ base: 6, md: 3 }}>
                <Card withBorder p="md">
                  <Text size="sm" c="dimmed">
                    HAI Count
                  </Text>
                  <Text size="xl" fw={600} c="danger">
                    {monthlyReport.hai_count}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Rate: {monthlyReport.hai_rate.toFixed(2)}/1000
                  </Text>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 6, md: 3 }}>
                <Card withBorder p="md">
                  <Text size="sm" c="dimmed">
                    Hand Hygiene
                  </Text>
                  <Text size="xl" fw={600} c="teal">
                    {monthlyReport.hand_hygiene_compliance.toFixed(1)}%
                  </Text>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 6, md: 3 }}>
                <Card withBorder p="md">
                  <Text size="sm" c="dimmed">
                    BMW Total (kg)
                  </Text>
                  <Text size="xl" fw={600}>
                    {monthlyReport.bmw_total_kg.toFixed(1)}
                  </Text>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 6, md: 3 }}>
                <Card withBorder p="md">
                  <Text size="sm" c="dimmed">
                    Cultures / MDRO / Outbreaks
                  </Text>
                  <Text size="xl" fw={600}>
                    {monthlyReport.culture_count} / {monthlyReport.mdro_count} /{" "}
                    {monthlyReport.outbreak_count}
                  </Text>
                </Card>
              </Grid.Col>
            </Grid>
          ) : (
            <Text c="dimmed">No data for the selected month</Text>
          )}
        </Stack>
      )}

      {/* Create Meeting Drawer */}
      <Drawer
        opened={meetingOpened}
        onClose={closeMeeting}
        title="New IC Meeting"
        position="right"
        size="xl"
      >
        <Stack>
          <TextInput
            label="Meeting Date"
            type="datetime-local"
            required
            value={meetingForm.meeting_date}
            onChange={(e) =>
              setMeetingForm({ ...meetingForm, meeting_date: e.currentTarget.value })
            }
          />
          <Select
            label="Meeting Type"
            data={["regular", "emergency", "ad_hoc", "orientation"]}
            value={meetingForm.meeting_type ?? "regular"}
            onChange={(v) => setMeetingForm({ ...meetingForm, meeting_type: v ?? "regular" })}
          />
          <Textarea
            label="Agenda"
            value={meetingForm.agenda ?? ""}
            onChange={(e) =>
              setMeetingForm({ ...meetingForm, agenda: e.currentTarget.value || undefined })
            }
          />
          <Textarea
            label="Minutes"
            value={meetingForm.minutes ?? ""}
            onChange={(e) =>
              setMeetingForm({ ...meetingForm, minutes: e.currentTarget.value || undefined })
            }
          />
          <Button
            tone="primary"
            loading={createMeetingMut.isPending}
            onClick={() => createMeetingMut.mutate(meetingForm)}
          >
            Create
          </Button>
        </Stack>
      </Drawer>

      {/* Exposure Drawer */}
      <Drawer
        opened={exposureOpened}
        onClose={closeExposure}
        title="Record Exposure"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Event Type"
            required
            data={["needlestick", "splash", "cut", "bite", "other"]}
            value={exposureForm.event_type || null}
            onChange={(v) => setExposureForm({ ...exposureForm, event_type: v ?? "" })}
          />
          <TextInput
            label="Exposure Date"
            type="datetime-local"
            required
            value={exposureForm.exposure_date}
            onChange={(e) =>
              setExposureForm({ ...exposureForm, exposure_date: e.currentTarget.value })
            }
          />
          <Select
            label="Exposure Type"
            required
            data={["percutaneous", "mucocutaneous", "intact_skin", "other"]}
            value={exposureForm.exposure_type || null}
            onChange={(v) => setExposureForm({ ...exposureForm, exposure_type: v ?? "" })}
          />
          <PatientSearchSelect
            label="Source Patient"
            value={exposureForm.source_patient_id ?? ""}
            onChange={(id) =>
              setExposureForm({ ...exposureForm, source_patient_id: id || undefined })
            }
          />
          <EmployeeSearchSelect
            label="Exposed Staff"
            value={exposureForm.exposed_staff_id ?? ""}
            onChange={(id) =>
              setExposureForm({ ...exposureForm, exposed_staff_id: id || undefined })
            }
          />
          <Switch
            label="PEP Initiated"
            checked={exposureForm.pep_initiated}
            onChange={(e) =>
              setExposureForm({ ...exposureForm, pep_initiated: e.currentTarget.checked })
            }
          />
          <Textarea
            label="Notes"
            value={exposureForm.notes ?? ""}
            onChange={(e) =>
              setExposureForm({ ...exposureForm, notes: e.currentTarget.value || undefined })
            }
          />
          <Button
            tone="primary"
            loading={createExposureMut.isPending}
            onClick={() => createExposureMut.mutate(exposureForm)}
          >
            Save
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Main Infection Control Page
// ══════════════════════════════════════════════════════════

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

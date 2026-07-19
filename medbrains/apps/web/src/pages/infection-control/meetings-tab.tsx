// IPD MeetingsTab — split from infection-control.tsx (pure move).

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
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { CreateExposureRequest, CreateIcMeetingRequest, IcMeeting } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button } from "@/components/ui";
import { infectionControlService } from "@/services/infectionControl.service";

export function MeetingsTab() {
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

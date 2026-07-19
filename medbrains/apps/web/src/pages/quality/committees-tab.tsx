// QUALITY CommitteesTab — split from quality.tsx (pure move).

import { BarChart, DonutChart } from "@mantine/charts";
import {
  Card,
  Checkbox,
  Drawer,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type {
  CommitteeFrequencyType,
  CreateMeetingRequest,
  CreateQualityCommitteeRequest,
  QualityActionItem,
  QualityCommittee,
  QualityCommitteeMeeting,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCalendarEvent, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Badge, Button, IconButton, Table, toast } from "@/components/ui";
import { qualityService } from "@/services/quality.service";

export function CommitteesTab() {
  const canManage = useHasPermission(P.QUALITY.COMMITTEES_MANAGE);
  const qc = useQueryClient();
  const [committeeOpened, { open: openCommittee, close: closeCommittee }] = useDisclosure(false);
  const [meetingOpened, { open: openMeeting, close: closeMeeting }] = useDisclosure(false);
  const [selectedCommittee, setSelectedCommittee] = useState<QualityCommittee | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const { data: committees = [], isLoading } = useQuery({
    queryKey: ["quality-committees"],
    queryFn: () => qualityService.listQualityCommittees(),
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["quality-meetings", selectedCommittee?.id],
    queryFn: () => qualityService.listCommitteeMeetings({ committee_id: selectedCommittee?.id }),
    enabled: !!selectedCommittee,
  });

  const { data: actionItems = [] } = useQuery({
    queryKey: ["quality-action-items"],
    queryFn: () => qualityService.listActionItems(),
  });

  // Patient feedback data (graceful fallback if API not available)
  const { data: feedbackData, isLoading: feedbackLoading } = useQuery({
    queryKey: ["patient-feedback"],
    queryFn: async () => null,
    enabled: showFeedback,
  });

  // Mock chart data for feedback analysis
  const feedbackByDeptData = useMemo(() => {
    if (!feedbackData || !Array.isArray(feedbackData)) {
      return [
        { department: "OPD", count: 45 },
        { department: "IPD", count: 32 },
        { department: "Emergency", count: 28 },
        { department: "Lab", count: 18 },
        { department: "Pharmacy", count: 15 },
      ];
    }
    // Process real data if available
    return feedbackData;
  }, [feedbackData]);

  const feedbackByRatingData = useMemo(() => {
    if (!feedbackData || !Array.isArray(feedbackData)) {
      return [
        { name: "Excellent", value: 42, color: "green.6" },
        { name: "Good", value: 35, color: "teal.5" },
        { name: "Average", value: 15, color: "yellow.5" },
        { name: "Poor", value: 5, color: "orange.5" },
        { name: "Very Poor", value: 3, color: "red.6" },
      ];
    }
    // Process real data if available
    return feedbackData;
  }, [feedbackData]);

  const [committeeForm, setCommitteeForm] = useState<CreateQualityCommitteeRequest>({
    name: "",
    code: "",
    committee_type: "",
    meeting_frequency: "monthly",
  });

  const createCommitteeMut = useMutation({
    mutationFn: (data: CreateQualityCommitteeRequest) =>
      qualityService.createQualityCommittee(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-committees"] });
      toast.success("", { title: "Committee created" });
      closeCommittee();
      setCommitteeForm({ name: "", code: "", committee_type: "", meeting_frequency: "monthly" });
    },
  });

  const [meetingForm, setMeetingForm] = useState<CreateMeetingRequest>({
    committee_id: "",
    scheduled_date: "",
  });

  const createMeetingMut = useMutation({
    mutationFn: (data: CreateMeetingRequest) => qualityService.createCommitteeMeeting(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-meetings"] });
      toast.success("", { title: "Meeting scheduled" });
      closeMeeting();
      setMeetingForm({ committee_id: "", scheduled_date: "" });
    },
  });

  const autoScheduleMut = useMutation({
    mutationFn: (committeeId: string) =>
      qualityService.autoScheduleMeetings(committeeId, { months_ahead: 6 }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["quality-meetings"] });
      toast.success("Scheduled for the next 6 months", { title: "Meetings auto-scheduled" });
    },
    onError: () => {
      toast.error("Could not generate meeting schedule", { title: "Auto-schedule failed" });
    },
  });

  const committeeColumns = [
    {
      key: "code" as const,
      label: "Code",
      render: (c: QualityCommittee) => <Text fw={500}>{c.code}</Text>,
    },
    { key: "name" as const, label: "Name", render: (c: QualityCommittee) => c.name },
    { key: "type" as const, label: "Type", render: (c: QualityCommittee) => c.committee_type },
    {
      key: "frequency" as const,
      label: "Meeting Frequency",
      render: (c: QualityCommittee) => c.meeting_frequency.replace(/_/g, " "),
    },
    {
      key: "mandatory" as const,
      label: "Mandatory",
      render: (c: QualityCommittee) =>
        c.is_mandatory ? (
          <Badge tone="danger" size="sm">
            Mandatory
          </Badge>
        ) : (
          "---"
        ),
    },
    {
      key: "active" as const,
      label: "Status",
      render: (c: QualityCommittee) =>
        c.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>,
    },
    {
      key: "actions" as const,
      label: "Actions",
      render: (c: QualityCommittee) => (
        <Group gap="xs">
          <Tooltip label="View Meetings">
            <IconButton
              tone="primary"
              onClick={() => {
                setSelectedCommittee(c);
              }}
              aria-label="View Meetings"
            >
              <IconCalendarEvent size={16} />
            </IconButton>
          </Tooltip>
          {canManage && (
            <Tooltip label="Schedule Meeting">
              <IconButton
                tone="success"
                onClick={() => {
                  setSelectedCommittee(c);
                  setMeetingForm({ committee_id: c.id, scheduled_date: "" });
                  openMeeting();
                }}
                aria-label="Schedule Meeting"
              >
                <IconPlus size={16} />
              </IconButton>
            </Tooltip>
          )}
          {canManage && (
            <Tooltip label="Auto-Schedule 6 Months">
              <IconButton
                tone="primary"
                loading={autoScheduleMut.isPending}
                onClick={() => autoScheduleMut.mutate(c.id)}
                aria-label="Auto-Schedule 6 Months"
              >
                <IconCalendarEvent size={16} />
              </IconButton>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Text c="dimmed" size="sm">
            {committees.length} committee(s)
          </Text>
          <Button tone="secondary" size="sm" onClick={() => setShowFeedback(!showFeedback)}>
            {showFeedback ? "Hide Feedback" : "Show Feedback"}
          </Button>
        </Group>
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCommittee}>
            New Committee
          </Button>
        )}
      </Group>

      {showFeedback && (
        <Card withBorder shadow="sm" p="md" mb="md">
          <Text fw={600} mb="md">
            Patient Feedback Analysis
          </Text>
          {feedbackLoading ? (
            <Text c="dimmed">Loading feedback data...</Text>
          ) : !feedbackData ? (
            <>
              <Text c="dimmed" size="sm" mb="md">
                No feedback data available. Showing sample structure.
              </Text>
              <SimpleGrid cols={2} spacing="lg">
                <div>
                  <Text size="sm" fw={600} mb="xs">
                    Feedback by Department
                  </Text>
                  <BarChart
                    h={250}
                    data={feedbackByDeptData}
                    dataKey="department"
                    series={[{ name: "count", color: "teal.6" }]}
                    withLegend={false}
                  />
                </div>
                <div>
                  <Text size="sm" fw={600} mb="xs">
                    Feedback by Rating
                  </Text>
                  <DonutChart
                    data={feedbackByRatingData}
                    withLabelsLine
                    withLabels
                    tooltipDataSource="segment"
                    size={220}
                    thickness={30}
                  />
                </div>
              </SimpleGrid>
            </>
          ) : (
            <Text c="dimmed">Feedback data loaded. Display logic pending.</Text>
          )}
        </Card>
      )}

      <DataTable
        columns={committeeColumns}
        data={committees}
        loading={isLoading}
        rowKey={(c) => c.id}
        emptyTitle="No committees"
      />

      {/* Meetings for selected committee */}
      {selectedCommittee && (
        <>
          <Text fw={600} mt="md">
            Meetings: {selectedCommittee.name}
          </Text>
          {meetings.length > 0 ? (
            <Table withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Meeting #</Table.Th>
                  <Table.Th>Scheduled</Table.Th>
                  <Table.Th>Actual</Table.Th>
                  <Table.Th>Venue</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {meetings.map((m: QualityCommitteeMeeting) => (
                  <Table.Tr key={m.id}>
                    <Table.Td>{m.meeting_number ?? "---"}</Table.Td>
                    <Table.Td>{new Date(m.scheduled_date).toLocaleDateString()}</Table.Td>
                    <Table.Td>
                      {m.actual_date ? new Date(m.actual_date).toLocaleDateString() : "---"}
                    </Table.Td>
                    <Table.Td>{m.venue ?? "---"}</Table.Td>
                    <Table.Td>
                      <Badge tone="neutral">{m.status}</Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text c="dimmed" size="sm">
              No meetings scheduled
            </Text>
          )}
        </>
      )}

      {/* Action Items */}
      {actionItems.length > 0 && (
        <>
          <Text fw={600} mt="md">
            Action Items ({actionItems.length})
          </Text>
          <Table withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Source</Table.Th>
                <Table.Th>Description</Table.Th>
                <Table.Th>Due Date</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {actionItems.map((a: QualityActionItem) => (
                <Table.Tr key={a.id}>
                  <Table.Td>{a.source_type}</Table.Td>
                  <Table.Td>{a.description ?? "---"}</Table.Td>
                  <Table.Td>{new Date(a.due_date).toLocaleDateString()}</Table.Td>
                  <Table.Td>
                    <Badge
                      tone={
                        a.status === "completed"
                          ? "success"
                          : a.status === "overdue"
                            ? "danger"
                            : "primary"
                      }
                    >
                      {a.status}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}

      {/* Create Committee Drawer */}
      <Drawer
        opened={committeeOpened}
        onClose={closeCommittee}
        title="New Committee"
        position="right"
        size="xl"
      >
        <Stack>
          <TextInput
            label="Code"
            required
            value={committeeForm.code}
            onChange={(e) => setCommitteeForm({ ...committeeForm, code: e.currentTarget.value })}
          />
          <TextInput
            label="Name"
            required
            value={committeeForm.name}
            onChange={(e) => setCommitteeForm({ ...committeeForm, name: e.currentTarget.value })}
          />
          <Textarea
            label="Description"
            value={committeeForm.description ?? ""}
            onChange={(e) =>
              setCommitteeForm({
                ...committeeForm,
                description: e.currentTarget.value || undefined,
              })
            }
          />
          <Select
            label="Committee Type"
            required
            data={[
              "quality_assurance",
              "infection_control",
              "pharmacy_therapeutic",
              "mortality_review",
              "ethics",
              "safety",
              "credentialing",
              "other",
            ]}
            value={committeeForm.committee_type}
            onChange={(v) => setCommitteeForm({ ...committeeForm, committee_type: v ?? "" })}
          />
          <EmployeeSearchSelect
            label="Chairperson"
            value={committeeForm.chairperson_id ?? ""}
            onChange={(employeeId) =>
              setCommitteeForm({
                ...committeeForm,
                chairperson_id: employeeId || undefined,
              })
            }
          />
          <EmployeeSearchSelect
            label="Secretary"
            value={committeeForm.secretary_id ?? ""}
            onChange={(employeeId) =>
              setCommitteeForm({
                ...committeeForm,
                secretary_id: employeeId || undefined,
              })
            }
          />
          <Select
            label="Meeting Frequency"
            required
            data={
              [
                "weekly",
                "biweekly",
                "monthly",
                "quarterly",
                "biannual",
                "annual",
                "as_needed",
              ] satisfies CommitteeFrequencyType[]
            }
            value={committeeForm.meeting_frequency}
            onChange={(v) =>
              setCommitteeForm({
                ...committeeForm,
                meeting_frequency: (v ?? "monthly") as CommitteeFrequencyType,
              })
            }
          />
          <Textarea
            label="Charter"
            value={committeeForm.charter ?? ""}
            onChange={(e) =>
              setCommitteeForm({ ...committeeForm, charter: e.currentTarget.value || undefined })
            }
          />
          <Checkbox
            label="Mandatory Committee"
            checked={committeeForm.is_mandatory ?? false}
            onChange={(e) =>
              setCommitteeForm({ ...committeeForm, is_mandatory: e.currentTarget.checked })
            }
          />
          <Button
            tone="primary"
            loading={createCommitteeMut.isPending}
            onClick={() => createCommitteeMut.mutate(committeeForm)}
          >
            Save
          </Button>
        </Stack>
      </Drawer>

      {/* Schedule Meeting Drawer */}
      <Drawer
        opened={meetingOpened}
        onClose={closeMeeting}
        title={`Schedule Meeting: ${selectedCommittee?.name ?? ""}`}
        position="right"
        size="sm"
      >
        <Stack>
          <TextInput
            label="Scheduled Date"
            type="datetime-local"
            required
            value={meetingForm.scheduled_date}
            onChange={(e) =>
              setMeetingForm({ ...meetingForm, scheduled_date: e.currentTarget.value })
            }
          />
          <TextInput
            label="Venue"
            value={meetingForm.venue ?? ""}
            onChange={(e) =>
              setMeetingForm({ ...meetingForm, venue: e.currentTarget.value || undefined })
            }
          />
          <Button
            tone="primary"
            loading={createMeetingMut.isPending}
            onClick={() => createMeetingMut.mutate(meetingForm)}
          >
            Schedule
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Accreditation Tab ───────────────────────────────────

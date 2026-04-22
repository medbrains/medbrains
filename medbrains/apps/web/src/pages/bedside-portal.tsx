import { useState } from "react";
import {
  Badge, Button, Card, Group, Loader, SimpleGrid, Slider,
  Stack, Text, TextInput, Textarea, Title, Timeline, ThemeIcon,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBell, IconHeartRateMonitor, IconPill, IconToolsKitchen2, IconVideo,
  IconMoodSmile, IconBath, IconGlass, IconBed, IconArrowsMove, IconDots,
  IconFlask, IconStethoscope,
} from "@tabler/icons-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { P } from "@medbrains/types";
import type {
  BedsideRequestType, BedsideDailyScheduleItem, BedsideMedicationItem,
  BedsideVitalReading, BedsideEducationVideoRow,
} from "@medbrains/types";
import { useHasPermission } from "@medbrains/stores";
import { useRequirePermission } from "../hooks/useRequirePermission";
import { PageHeader } from "../components/PageHeader";

// ── Helpers ──

const REQUEST_TYPE_CONFIG: Record<BedsideRequestType, { label: string; icon: React.ReactNode; color: string }> = {
  nurse_call: { label: "Nurse Call", icon: <IconBell size={28} />, color: "red" },
  pain_management: { label: "Pain Help", icon: <IconHeartRateMonitor size={28} />, color: "orange" },
  bathroom_assist: { label: "Bathroom", icon: <IconBath size={28} />, color: "blue" },
  water_food: { label: "Water / Food", icon: <IconGlass size={28} />, color: "cyan" },
  blanket_pillow: { label: "Blanket / Pillow", icon: <IconBed size={28} />, color: "violet" },
  position_change: { label: "Reposition", icon: <IconArrowsMove size={28} />, color: "teal" },
  other: { label: "Other", icon: <IconDots size={28} />, color: "gray" },
};

function scheduleIcon(eventType: string) {
  switch (eventType) {
    case "medication": return <IconPill size={16} />;
    case "nursing_task": return <IconStethoscope size={16} />;
    case "meal": return <IconToolsKitchen2 size={16} />;
    default: return <IconDots size={16} />;
  }
}

function scheduleColor(eventType: string) {
  switch (eventType) {
    case "medication": return "blue";
    case "nursing_task": return "green";
    case "meal": return "orange";
    default: return "gray";
  }
}

// ── Main Page Component ──

export function BedsidePortalPage() {
  useRequirePermission(P.BEDSIDE.VIEW);
  const canRequest = useHasPermission(P.BEDSIDE.REQUEST);
  const canFeedback = useHasPermission(P.BEDSIDE.FEEDBACK_CREATE);
  const canViewVideos = useHasPermission(P.BEDSIDE.VIDEOS_LIST);
  const queryClient = useQueryClient();

  // For demo, use a stored admission ID or prompt
  const [admissionId, setAdmissionId] = useState("");
  const [patientId, setPatientId] = useState("");

  // Feedback state
  const [painLevel, setPainLevel] = useState<number>(0);
  const [comfortLevel, setComfortLevel] = useState<number>(3);
  const [cleanlinessLevel, setCleanlinessLevel] = useState<number>(3);
  const [feedbackComment, setFeedbackComment] = useState("");

  // Nurse request note
  const [requestNote, setRequestNote] = useState("");

  const isReady = admissionId.length > 0 && patientId.length > 0;

  // ── Queries ──
  const scheduleQ = useQuery({
    queryKey: ["bedside", "schedule", admissionId],
    queryFn: () => api.getBedsideDailySchedule(admissionId),
    enabled: isReady,
  });

  const medsQ = useQuery({
    queryKey: ["bedside", "medications", admissionId],
    queryFn: () => api.getBedsideMedications(admissionId),
    enabled: isReady,
  });

  const vitalsQ = useQuery({
    queryKey: ["bedside", "vitals", admissionId],
    queryFn: () => api.getBedsideVitals(admissionId),
    enabled: isReady,
  });

  const videosQ = useQuery({
    queryKey: ["bedside", "videos"],
    queryFn: () => api.listBedsideVideos(),
    enabled: isReady && canViewVideos,
  });

  useQuery({
    queryKey: ["bedside", "feedback", admissionId],
    queryFn: () => api.listBedsideFeedback(admissionId),
    enabled: isReady,
  });

  // ── Mutations ──
  const nurseRequestMut = useMutation({
    mutationFn: (requestType: BedsideRequestType) =>
      api.createBedsideNurseRequest(admissionId, {
        patient_id: patientId,
        request_type: requestType,
        notes: requestNote || undefined,
      }),
    onSuccess: () => {
      notifications.show({ title: "Request Sent", message: "A nurse has been notified.", color: "green" });
      setRequestNote("");
      queryClient.invalidateQueries({ queryKey: ["bedside", "nurse-requests"] });
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to send request.", color: "red" });
    },
  });

  const feedbackMut = useMutation({
    mutationFn: () =>
      api.submitBedsideFeedback(admissionId, {
        patient_id: patientId,
        pain_level: painLevel,
        comfort_level: comfortLevel,
        cleanliness_level: cleanlinessLevel,
        comments: feedbackComment || undefined,
      }),
    onSuccess: () => {
      notifications.show({ title: "Thank You", message: "Your feedback has been recorded.", color: "green" });
      setFeedbackComment("");
      queryClient.invalidateQueries({ queryKey: ["bedside", "feedback"] });
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to submit feedback.", color: "red" });
    },
  });

  // ── Setup Screen (enter admission ID) ──
  if (!isReady) {
    return (
      <div>
        <PageHeader title="Bedside Portal" subtitle="Patient bedside tablet interface" />
        <Card shadow="sm" padding="xl" radius="md" withBorder maw={500} mx="auto" mt="xl">
          <Stack gap="md">
            <Title order={3}>Enter Session Details</Title>
            <Text size="sm" c="dimmed">Enter the admission and patient IDs to start the bedside session.</Text>
            <TextInput
              label="Admission ID"
              placeholder="UUID of the admission"
              value={admissionId}
              onChange={(e) => setAdmissionId(e.currentTarget.value)}
              size="lg"
            />
            <TextInput
              label="Patient ID"
              placeholder="UUID of the patient"
              value={patientId}
              onChange={(e) => setPatientId(e.currentTarget.value)}
              size="lg"
            />
          </Stack>
        </Card>
      </div>
    );
  }

  // ── Main Dashboard ──
  return (
    <div>
      <PageHeader title="Bedside Portal" subtitle="Your daily care overview" />

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" mt="md">
        {/* ── LEFT COLUMN ── */}
        <Stack gap="lg">
          {/* Daily Schedule */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Title order={4} mb="md">Today&apos;s Schedule</Title>
            {scheduleQ.isLoading && <Loader size="sm" />}
            {scheduleQ.data && scheduleQ.data.length === 0 && (
              <Text c="dimmed" size="sm">No events scheduled for today.</Text>
            )}
            {scheduleQ.data && scheduleQ.data.length > 0 && (
              <Timeline active={-1} bulletSize={28} lineWidth={2}>
                {scheduleQ.data.map((item: BedsideDailyScheduleItem, idx: number) => (
                  <Timeline.Item
                    key={idx}
                    bullet={
                      <ThemeIcon size={28} radius="xl" color={scheduleColor(item.event_type)} variant="light">
                        {scheduleIcon(item.event_type)}
                      </ThemeIcon>
                    }
                    title={
                      <Group gap="xs">
                        <Text fw={600} size="md">{item.description}</Text>
                        <Badge size="sm" color={scheduleColor(item.event_type)} variant="light">
                          {item.event_type}
                        </Badge>
                      </Group>
                    }
                  >
                    <Text size="sm" c="dimmed">
                      {item.scheduled_at ? new Date(item.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Time TBD"}
                      {item.status && ` — ${item.status}`}
                    </Text>
                  </Timeline.Item>
                ))}
              </Timeline>
            )}
          </Card>

          {/* Current Medications */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Title order={4} mb="md">Current Medications</Title>
            {medsQ.isLoading && <Loader size="sm" />}
            {medsQ.data && medsQ.data.length === 0 && (
              <Text c="dimmed" size="sm">No scheduled medications.</Text>
            )}
            <Stack gap="xs">
              {medsQ.data?.map((med: BedsideMedicationItem) => (
                <Card key={med.id} padding="sm" radius="sm" withBorder>
                  <Group justify="space-between">
                    <Group gap="xs">
                      <IconPill size={20} color="var(--mantine-color-blue-6)" />
                      <Text fw={600} size="md">{med.drug_name ?? "Medication"}</Text>
                    </Group>
                    <Badge size="sm" variant="light">{med.status ?? "scheduled"}</Badge>
                  </Group>
                  <Text size="sm" c="dimmed" mt={4}>
                    {[med.dose, med.route, med.frequency].filter(Boolean).join(" | ")}
                    {med.scheduled_at && ` — ${new Date(med.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                  </Text>
                </Card>
              ))}
            </Stack>
          </Card>

          {/* Lab Results */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Title order={4} mb="md">Recent Lab Results</Title>
            <LabResultsSection admissionId={admissionId} />
          </Card>
        </Stack>

        {/* ── RIGHT COLUMN ── */}
        <Stack gap="lg">
          {/* Quick Actions — Nurse Requests */}
          {canRequest && (
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Title order={4} mb="md">Need Help?</Title>
              <Textarea
                placeholder="Optional note for the nurse..."
                value={requestNote}
                onChange={(e) => setRequestNote(e.currentTarget.value)}
                mb="md"
                size="md"
                autosize
                minRows={2}
              />
              <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
                {(Object.entries(REQUEST_TYPE_CONFIG) as [BedsideRequestType, typeof REQUEST_TYPE_CONFIG[BedsideRequestType]][]).map(
                  ([type, cfg]) => (
                    <Button
                      key={type}
                      variant="light"
                      color={cfg.color}
                      size="xl"
                      h={90}
                      loading={nurseRequestMut.isPending}
                      onClick={() => nurseRequestMut.mutate(type)}
                      styles={{ label: { flexDirection: "column", gap: 4 } }}
                    >
                      {cfg.icon}
                      <Text size="xs" fw={600}>{cfg.label}</Text>
                    </Button>
                  ),
                )}
              </SimpleGrid>
            </Card>
          )}

          {/* Latest Vitals */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Title order={4} mb="md">Your Vitals</Title>
            {vitalsQ.isLoading && <Loader size="sm" />}
            {vitalsQ.data && vitalsQ.data.length === 0 && (
              <Text c="dimmed" size="sm">No vitals recorded yet.</Text>
            )}
            <SimpleGrid cols={2} spacing="sm">
              {vitalsQ.data?.slice(0, 6).map((v: BedsideVitalReading) => (
                <Card key={v.id} padding="sm" radius="sm" withBorder>
                  <Text size="xs" c="dimmed" tt="uppercase">{v.vital_type ?? "Vital"}</Text>
                  <Text fw={700} size="lg">
                    {v.value_numeric ?? v.value_text ?? "-"}
                    {v.unit && <Text component="span" size="sm" c="dimmed"> {v.unit}</Text>}
                  </Text>
                </Card>
              ))}
            </SimpleGrid>
          </Card>

          {/* Feedback */}
          {canFeedback && (
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Title order={4} mb="md">How Are You Feeling?</Title>
              <Stack gap="md">
                <div>
                  <Text size="sm" fw={600} mb={4}>Pain Level (0 = none, 10 = worst)</Text>
                  <Slider
                    min={0} max={10} step={1}
                    value={painLevel}
                    onChange={setPainLevel}
                    marks={[{ value: 0, label: "0" }, { value: 5, label: "5" }, { value: 10, label: "10" }]}
                    color={painLevel > 6 ? "red" : painLevel > 3 ? "yellow" : "green"}
                    size="lg"
                  />
                </div>
                <div>
                  <Text size="sm" fw={600} mb={4}>Comfort (1 = poor, 5 = excellent)</Text>
                  <Slider
                    min={1} max={5} step={1}
                    value={comfortLevel}
                    onChange={setComfortLevel}
                    marks={[{ value: 1, label: "1" }, { value: 3, label: "3" }, { value: 5, label: "5" }]}
                    color="blue"
                    size="lg"
                  />
                </div>
                <div>
                  <Text size="sm" fw={600} mb={4}>Cleanliness (1 = poor, 5 = excellent)</Text>
                  <Slider
                    min={1} max={5} step={1}
                    value={cleanlinessLevel}
                    onChange={setCleanlinessLevel}
                    marks={[{ value: 1, label: "1" }, { value: 3, label: "3" }, { value: 5, label: "5" }]}
                    color="teal"
                    size="lg"
                  />
                </div>
                <Textarea
                  placeholder="Any comments or concerns..."
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.currentTarget.value)}
                  size="md"
                  autosize
                  minRows={2}
                />
                <Button
                  size="lg"
                  onClick={() => feedbackMut.mutate()}
                  loading={feedbackMut.isPending}
                  leftSection={<IconMoodSmile size={20} />}
                >
                  Submit Feedback
                </Button>
              </Stack>
            </Card>
          )}

          {/* Education Videos */}
          {canViewVideos && videosQ.data && videosQ.data.length > 0 && (
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Title order={4} mb="md">Education Videos</Title>
              <Stack gap="sm">
                {videosQ.data.map((video: BedsideEducationVideoRow) => (
                  <Card key={video.id} padding="sm" radius="sm" withBorder>
                    <Group gap="sm">
                      <ThemeIcon size={40} radius="md" color="grape" variant="light">
                        <IconVideo size={22} />
                      </ThemeIcon>
                      <div style={{ flex: 1 }}>
                        <Text fw={600} size="sm">{video.title}</Text>
                        <Text size="xs" c="dimmed" lineClamp={1}>{video.description}</Text>
                        <Group gap="xs" mt={2}>
                          <Badge size="xs" variant="light">{video.category}</Badge>
                          {video.duration_seconds && (
                            <Text size="xs" c="dimmed">{Math.round(video.duration_seconds / 60)} min</Text>
                          )}
                        </Group>
                      </div>
                    </Group>
                  </Card>
                ))}
              </Stack>
            </Card>
          )}
        </Stack>
      </SimpleGrid>
    </div>
  );
}

// ── Sub-components ──

function LabResultsSection({ admissionId }: { admissionId: string }) {
  const labQ = useQuery({
    queryKey: ["bedside", "lab-results", admissionId],
    queryFn: () => api.getBedsideLabResults(admissionId),
    enabled: admissionId.length > 0,
  });

  if (labQ.isLoading) return <Loader size="sm" />;
  if (!labQ.data || labQ.data.length === 0) return <Text c="dimmed" size="sm">No lab results available.</Text>;

  return (
    <Stack gap="xs">
      {labQ.data.map((r) => (
        <Group key={r.id} justify="space-between">
          <Group gap="xs">
            <IconFlask size={16} color="var(--mantine-color-violet-6)" />
            <Text size="sm" fw={500}>{r.test_name ?? "Test"}</Text>
          </Group>
          <Group gap="xs">
            <Text size="sm" fw={700} c={r.is_abnormal ? "red" : undefined}>
              {r.result_value ?? "-"} {r.unit ?? ""}
            </Text>
            {r.reference_range && (
              <Text size="xs" c="dimmed">({r.reference_range})</Text>
            )}
          </Group>
        </Group>
      ))}
    </Stack>
  );
}

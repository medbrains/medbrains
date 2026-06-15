import {
  Card,
  Group,
  Loader,
  SimpleGrid,
  Slider,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Timeline,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  BedsideDailyScheduleItem,
  BedsideDietOrderItem,
  BedsideEducationVideoRow,
  BedsideMedicationItem,
  BedsideNurseRequestRow,
  BedsideRequestStatus,
  BedsideRequestType,
  BedsideSessionRow,
  BedsideVitalReading,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconArrowsMove,
  IconBath,
  IconBed,
  IconBell,
  IconDots,
  IconFlask,
  IconGlass,
  IconHeartRateMonitor,
  IconMoodSmile,
  IconPill,
  IconStethoscope,
  IconToolsKitchen2,
  IconVideo,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { PageHeader } from "@/components/PageHeader";
import { Badge, type BadgeTone, Button, Table } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { bedsideService } from "@/services/bedside.service";

// ── Helpers ──

const REQUEST_TYPE_CONFIG: Record<
  BedsideRequestType,
  { label: string; icon: React.ReactNode; color: string }
> = {
  nurse_call: { label: "Nurse Call", icon: <IconBell size={28} />, color: "red" },
  pain_management: {
    label: "Pain Help",
    icon: <IconHeartRateMonitor size={28} />,
    color: "orange",
  },
  bathroom_assist: { label: "Bathroom", icon: <IconBath size={28} />, color: "blue" },
  water_food: { label: "Water / Food", icon: <IconGlass size={28} />, color: "cyan" },
  blanket_pillow: { label: "Blanket / Pillow", icon: <IconBed size={28} />, color: "violet" },
  position_change: { label: "Reposition", icon: <IconArrowsMove size={28} />, color: "teal" },
  other: { label: "Other", icon: <IconDots size={28} />, color: "gray" },
};

const BEDSIDE_PAGE_PERMISSIONS = [
  P.BEDSIDE.VIEW,
  P.BEDSIDE.REQUEST,
  P.BEDSIDE.VIDEOS_LIST,
  P.BEDSIDE.VIDEOS_MANAGE,
  P.BEDSIDE.FEEDBACK_LIST,
  P.BEDSIDE.FEEDBACK_CREATE,
  P.BEDSIDE.SESSIONS_LIST,
  P.BEDSIDE.SESSIONS_MANAGE,
] as const;

const requestStatusColors: Record<BedsideRequestStatus, BadgeTone> = {
  pending: "warning",
  acknowledged: "info",
  in_progress: "accent",
  completed: "success",
  cancelled: "neutral",
};

function scheduleIcon(eventType: string) {
  switch (eventType) {
    case "medication":
      return <IconPill size={16} />;
    case "nursing_task":
      return <IconStethoscope size={16} />;
    case "meal":
      return <IconToolsKitchen2 size={16} />;
    default:
      return <IconDots size={16} />;
  }
}

function scheduleColor(eventType: string) {
  switch (eventType) {
    case "medication":
      return "blue";
    case "nursing_task":
      return "green";
    case "meal":
      return "orange";
    default:
      return "gray";
  }
}

const SCHEDULE_BADGE_TONES: Record<string, BadgeTone> = {
  blue: "info",
  green: "success",
  orange: "warning",
  gray: "neutral",
};

function scheduleBadgeTone(eventType: string): BadgeTone {
  return SCHEDULE_BADGE_TONES[scheduleColor(eventType)] ?? "neutral";
}

function compactContextId(value: string) {
  return value ? value.slice(0, 8) : "";
}

function IpdBedsideContextStrip({
  admissionId,
  patientId,
  encounterId,
  wardId,
  bedId,
  chargeContext,
  chargeable,
}: {
  admissionId: string;
  patientId: string;
  encounterId: string;
  wardId: string;
  bedId: string;
  chargeContext: string;
  chargeable: string;
}) {
  if (!admissionId && !patientId && !encounterId && !wardId && !bedId) {
    return null;
  }

  return (
    <Card withBorder padding="sm">
      <Text size="xs" c="dimmed" mb={4}>
        Linked IPD context
      </Text>
      <Group gap="xs">
        {admissionId && (
          <Badge tone="neutral" variant="light">
            Admission {compactContextId(admissionId)}
          </Badge>
        )}
        {patientId && (
          <Badge tone="neutral" variant="light">
            Patient {compactContextId(patientId)}
          </Badge>
        )}
        {encounterId && (
          <Badge tone="neutral" variant="light">
            Encounter {compactContextId(encounterId)}
          </Badge>
        )}
        {wardId && (
          <Badge tone="neutral" variant="light">
            Ward {compactContextId(wardId)}
          </Badge>
        )}
        {bedId && (
          <Badge tone="neutral" variant="light">
            Bed {compactContextId(bedId)}
          </Badge>
        )}
        {chargeContext && (
          <Badge tone={chargeable === "true" ? "warning" : "neutral"} variant="light">
            {chargeContext}
            {chargeable ? ` · chargeable ${chargeable}` : ""}
          </Badge>
        )}
      </Group>
    </Card>
  );
}

// ── Main Page Component ──

export function BedsidePortalPage() {
  useRequirePermission(BEDSIDE_PAGE_PERMISSIONS);
  const canViewPortal = useHasPermission(P.BEDSIDE.VIEW);
  const canRequest = useHasPermission(P.BEDSIDE.REQUEST);
  const canFeedback = useHasPermission(P.BEDSIDE.FEEDBACK_CREATE);
  const canViewVideos = useHasPermission(P.BEDSIDE.VIDEOS_LIST);
  const canListFeedback = useHasPermission(P.BEDSIDE.FEEDBACK_LIST);
  const canListSessions = useHasPermission(P.BEDSIDE.SESSIONS_LIST);
  const canManageSessions = useHasPermission(P.BEDSIDE.SESSIONS_MANAGE);
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [admissionId, setAdmissionId] = useState(searchParams.get("admission_id") ?? "");
  const [patientId, setPatientId] = useState(searchParams.get("patient_id") ?? "");
  const encounterId = searchParams.get("encounter_id") ?? "";
  const wardId = searchParams.get("ward_id") ?? "";
  const bedId = searchParams.get("bed_id") ?? "";
  const chargeContext = searchParams.get("charge_context") ?? "";
  const chargeable = searchParams.get("chargeable") ?? "";
  const hasIpdContext = Boolean(admissionId || patientId || encounterId || wardId || bedId);
  const canOpenOperations = canListSessions || canManageSessions || canListFeedback;
  const initialTab = !canViewPortal && canOpenOperations ? "operations" : "portal";
  const [activeTab, setActiveTab] = useState<string | null>(initialTab);

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
    queryFn: () => bedsideService.getBedsideDailySchedule(admissionId),
    enabled: isReady,
  });

  const medsQ = useQuery({
    queryKey: ["bedside", "medications", admissionId],
    queryFn: () => bedsideService.getBedsideMedications(admissionId),
    enabled: isReady,
  });

  const vitalsQ = useQuery({
    queryKey: ["bedside", "vitals", admissionId],
    queryFn: () => bedsideService.getBedsideVitals(admissionId),
    enabled: isReady,
  });

  const videosQ = useQuery({
    queryKey: ["bedside", "videos"],
    queryFn: () => bedsideService.listBedsideVideos(),
    enabled: isReady && canViewVideos,
  });

  const dietQ = useQuery({
    queryKey: ["bedside", "diet-order", admissionId],
    queryFn: () => bedsideService.getBedsideDietOrder(admissionId),
    enabled: isReady && canViewPortal,
  });

  useQuery({
    queryKey: ["bedside", "feedback", admissionId],
    queryFn: () => bedsideService.listBedsideFeedback(admissionId),
    enabled: isReady && canListFeedback,
  });

  // ── Mutations ──
  const nurseRequestMut = useMutation({
    mutationFn: (requestType: BedsideRequestType) =>
      bedsideService.createBedsideNurseRequest(admissionId, {
        patient_id: patientId,
        request_type: requestType,
        notes: requestNote || undefined,
      }),
    onSuccess: () => {
      notifications.show({
        title: "Request Sent",
        message: "A nurse has been notified.",
        color: "green",
      });
      setRequestNote("");
      void queryClient.invalidateQueries({ queryKey: ["bedside", "nurse-requests"] });
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to send request.", color: "red" });
    },
  });

  const feedbackMut = useMutation({
    mutationFn: () =>
      bedsideService.submitBedsideFeedback(admissionId, {
        patient_id: patientId,
        pain_level: painLevel,
        comfort_level: comfortLevel,
        cleanliness_level: cleanlinessLevel,
        comments: feedbackComment || undefined,
      }),
    onSuccess: () => {
      notifications.show({
        title: "Thank You",
        message: "Your feedback has been recorded.",
        color: "green",
      });
      setFeedbackComment("");
      void queryClient.invalidateQueries({ queryKey: ["bedside", "feedback"] });
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
        <SimpleGrid cols={{ base: 1, lg: canOpenOperations ? 2 : 1 }} spacing="lg" mt="xl">
          {canViewPortal && (
            <Card shadow="sm" padding="xl" radius="md" withBorder maw={500} mx="auto" w="100%">
              <Stack gap="md">
                <Title order={3}>Bedside session</Title>
                {hasIpdContext ? (
                  <IpdBedsideContextStrip
                    admissionId={admissionId}
                    patientId={patientId}
                    encounterId={encounterId}
                    wardId={wardId}
                    bedId={bedId}
                    chargeContext={chargeContext}
                    chargeable={chargeable}
                  />
                ) : (
                  <Text size="sm" c="dimmed">
                    Enter the admission and patient IDs to start the bedside session.
                  </Text>
                )}
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
          )}
          {canOpenOperations && (
            <BedsideOperationsPanel
              admissionId={admissionId}
              canListSessions={canListSessions}
              canManageSessions={canManageSessions}
              canViewRequests={canViewPortal}
            />
          )}
        </SimpleGrid>
      </div>
    );
  }

  // ── Main Dashboard ──
  return (
    <div>
      <PageHeader title="Bedside Portal" subtitle="Your daily care overview" />
      <IpdBedsideContextStrip
        admissionId={admissionId}
        patientId={patientId}
        encounterId={encounterId}
        wardId={wardId}
        bedId={bedId}
        chargeContext={chargeContext}
        chargeable={chargeable}
      />

      <Tabs value={activeTab} onChange={setActiveTab} mt="md">
        <Tabs.List mb="md">
          {canViewPortal && <Tabs.Tab value="portal">Patient Portal</Tabs.Tab>}
          {canOpenOperations && <Tabs.Tab value="operations">Operations</Tabs.Tab>}
        </Tabs.List>

        {canViewPortal && (
          <Tabs.Panel value="portal">
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <Stack gap="lg">
                {/* Daily Schedule */}
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                  <Title order={4} mb="md">
                    Today&apos;s Schedule
                  </Title>
                  {scheduleQ.isLoading && <Loader size="sm" />}
                  {scheduleQ.data && scheduleQ.data.length === 0 && (
                    <Text c="dimmed" size="sm">
                      No events scheduled for today.
                    </Text>
                  )}
                  {scheduleQ.data && scheduleQ.data.length > 0 && (
                    <Timeline active={-1} bulletSize={28} lineWidth={2}>
                      {scheduleQ.data.map((item: BedsideDailyScheduleItem) => (
                        <Timeline.Item
                          key={`${item.event_type}-${item.scheduled_at ?? "unscheduled"}-${item.description}`}
                          bullet={
                            <ThemeIcon
                              size={28}
                              radius="xl"
                              color={scheduleColor(item.event_type)}
                              variant="light"
                            >
                              {scheduleIcon(item.event_type)}
                            </ThemeIcon>
                          }
                          title={
                            <Group gap="xs">
                              <Text fw={600} size="md">
                                {item.description}
                              </Text>
                              <Badge
                                size="sm"
                                tone={scheduleBadgeTone(item.event_type)}
                                variant="light"
                              >
                                {item.event_type}
                              </Badge>
                            </Group>
                          }
                        >
                          <Text size="sm" c="dimmed">
                            {item.scheduled_at
                              ? new Date(item.scheduled_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Time TBD"}
                            {item.status && ` — ${item.status}`}
                          </Text>
                        </Timeline.Item>
                      ))}
                    </Timeline>
                  )}
                </Card>

                {/* Current Medications */}
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                  <Title order={4} mb="md">
                    Current Medications
                  </Title>
                  {medsQ.isLoading && <Loader size="sm" />}
                  {medsQ.data && medsQ.data.length === 0 && (
                    <Text c="dimmed" size="sm">
                      No scheduled medications.
                    </Text>
                  )}
                  <Stack gap="xs">
                    {medsQ.data?.map((med: BedsideMedicationItem) => (
                      <Card key={med.id} padding="sm" radius="sm" withBorder>
                        <Group justify="space-between">
                          <Group gap="xs">
                            <IconPill size={20} color="var(--mantine-color-blue-6)" />
                            <Text fw={600} size="md">
                              {med.drug_name ?? "Medication"}
                            </Text>
                          </Group>
                          <Badge size="sm" tone="neutral" variant="light">
                            {med.status ?? "scheduled"}
                          </Badge>
                        </Group>
                        <Text size="sm" c="dimmed" mt={4}>
                          {[med.dose, med.route, med.frequency].filter(Boolean).join(" | ")}
                          {med.scheduled_at &&
                            ` — ${new Date(med.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                        </Text>
                      </Card>
                    ))}
                  </Stack>
                </Card>

                {/* Lab Results */}
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                  <Title order={4} mb="md">
                    Recent Lab Results
                  </Title>
                  <LabResultsSection admissionId={admissionId} />
                </Card>
                <DietOrderSection orders={dietQ.data ?? []} loading={dietQ.isLoading} />
              </Stack>

              <Stack gap="lg">
                {/* Quick Actions — Nurse Requests */}
                {canRequest && (
                  <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Title order={4} mb="md">
                      Need Help?
                    </Title>
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
                      {(
                        Object.entries(REQUEST_TYPE_CONFIG) as [
                          BedsideRequestType,
                          (typeof REQUEST_TYPE_CONFIG)[BedsideRequestType],
                        ][]
                      ).map(([type, cfg]) => (
                        <Button
                          key={type}
                          tone="secondary"
                          size="xl"
                          h={90}
                          loading={nurseRequestMut.isPending}
                          onClick={() => nurseRequestMut.mutate(type)}
                          styles={{ label: { flexDirection: "column", gap: 4 } }}
                        >
                          {cfg.icon}
                          <Text size="xs" fw={600}>
                            {cfg.label}
                          </Text>
                        </Button>
                      ))}
                    </SimpleGrid>
                  </Card>
                )}

                {/* Latest Vitals */}
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                  <Title order={4} mb="md">
                    Your Vitals
                  </Title>
                  {vitalsQ.isLoading && <Loader size="sm" />}
                  {vitalsQ.data && vitalsQ.data.length === 0 && (
                    <Text c="dimmed" size="sm">
                      No vitals recorded yet.
                    </Text>
                  )}
                  <SimpleGrid cols={2} spacing="sm">
                    {vitalsQ.data?.slice(0, 6).map((v: BedsideVitalReading) => (
                      <Card key={v.id} padding="sm" radius="sm" withBorder>
                        <Text size="xs" c="dimmed" tt="uppercase">
                          {v.vital_type ?? "Vital"}
                        </Text>
                        <Text fw={700} size="lg">
                          {v.value_numeric ?? v.value_text ?? "-"}
                          {v.unit && (
                            <Text component="span" size="sm" c="dimmed">
                              {" "}
                              {v.unit}
                            </Text>
                          )}
                        </Text>
                      </Card>
                    ))}
                  </SimpleGrid>
                </Card>

                {/* Feedback */}
                {canFeedback && (
                  <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Title order={4} mb="md">
                      How Are You Feeling?
                    </Title>
                    <Stack gap="md">
                      <div>
                        <Text size="sm" fw={600} mb={4}>
                          Pain Level (0 = none, 10 = worst)
                        </Text>
                        <Slider
                          min={0}
                          max={10}
                          step={1}
                          value={painLevel}
                          onChange={setPainLevel}
                          marks={[
                            { value: 0, label: "0" },
                            { value: 5, label: "5" },
                            { value: 10, label: "10" },
                          ]}
                          color={painLevel > 6 ? "red" : painLevel > 3 ? "yellow" : "green"}
                          size="lg"
                        />
                      </div>
                      <div>
                        <Text size="sm" fw={600} mb={4}>
                          Comfort (1 = poor, 5 = excellent)
                        </Text>
                        <Slider
                          min={1}
                          max={5}
                          step={1}
                          value={comfortLevel}
                          onChange={setComfortLevel}
                          marks={[
                            { value: 1, label: "1" },
                            { value: 3, label: "3" },
                            { value: 5, label: "5" },
                          ]}
                          color="blue"
                          size="lg"
                        />
                      </div>
                      <div>
                        <Text size="sm" fw={600} mb={4}>
                          Cleanliness (1 = poor, 5 = excellent)
                        </Text>
                        <Slider
                          min={1}
                          max={5}
                          step={1}
                          value={cleanlinessLevel}
                          onChange={setCleanlinessLevel}
                          marks={[
                            { value: 1, label: "1" },
                            { value: 3, label: "3" },
                            { value: 5, label: "5" },
                          ]}
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
                        tone="primary"
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
                    <Title order={4} mb="md">
                      Education Videos
                    </Title>
                    <Stack gap="sm">
                      {videosQ.data.map((video: BedsideEducationVideoRow) => (
                        <Card key={video.id} padding="sm" radius="sm" withBorder>
                          <Group gap="sm">
                            <ThemeIcon size={40} radius="md" color="grape" variant="light">
                              <IconVideo size={22} />
                            </ThemeIcon>
                            <div style={{ flex: 1 }}>
                              <Text fw={600} size="sm">
                                {video.title}
                              </Text>
                              <Text size="xs" c="dimmed" lineClamp={1}>
                                {video.description}
                              </Text>
                              <Group gap="xs" mt={2}>
                                <Badge size="xs" tone="neutral" variant="light">
                                  {video.category}
                                </Badge>
                                {video.duration_seconds && (
                                  <Text size="xs" c="dimmed">
                                    {Math.round(video.duration_seconds / 60)} min
                                  </Text>
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
          </Tabs.Panel>
        )}

        {canOpenOperations && (
          <Tabs.Panel value="operations">
            <BedsideOperationsPanel
              admissionId={admissionId}
              canListSessions={canListSessions}
              canManageSessions={canManageSessions}
              canViewRequests={canViewPortal}
            />
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
}

// ── Sub-components ──

function LabResultsSection({ admissionId }: { admissionId: string }) {
  const labQ = useQuery({
    queryKey: ["bedside", "lab-results", admissionId],
    queryFn: () => bedsideService.getBedsideLabResults(admissionId),
    enabled: admissionId.length > 0,
  });

  if (labQ.isLoading) return <Loader size="sm" />;
  if (!labQ.data || labQ.data.length === 0)
    return (
      <Text c="dimmed" size="sm">
        No lab results available.
      </Text>
    );

  return (
    <Stack gap="xs">
      {labQ.data.map((r) => (
        <Group key={r.id} justify="space-between">
          <Group gap="xs">
            <IconFlask size={16} color="var(--mantine-color-violet-6)" />
            <Text size="sm" fw={500}>
              {r.test_name ?? "Test"}
            </Text>
          </Group>
          <Group gap="xs">
            <Text size="sm" fw={700} c={r.is_abnormal ? "red" : undefined}>
              {r.result_value ?? "-"} {r.unit ?? ""}
            </Text>
            {r.reference_range && (
              <Text size="xs" c="dimmed">
                ({r.reference_range})
              </Text>
            )}
          </Group>
        </Group>
      ))}
    </Stack>
  );
}

function DietOrderSection({
  orders,
  loading,
}: {
  orders: BedsideDietOrderItem[];
  loading: boolean;
}) {
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Title order={4} mb="md">
        Diet & Meals
      </Title>
      {loading && <Loader size="sm" />}
      {!loading && orders.length === 0 && (
        <Text c="dimmed" size="sm">
          No active diet order.
        </Text>
      )}
      <Stack gap="xs">
        {orders.map((order) => (
          <Card key={order.id} padding="sm" radius="sm" withBorder>
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Text size="sm" fw={600}>
                  {order.diet_type ?? "Diet order"}
                </Text>
                <Text size="xs" c="dimmed">
                  {[order.meal_type, order.instructions].filter(Boolean).join(" | ") || "—"}
                </Text>
              </Stack>
              <Badge tone="neutral" variant="light">
                {order.status ?? "active"}
              </Badge>
            </Group>
          </Card>
        ))}
      </Stack>
    </Card>
  );
}

function BedsideOperationsPanel({
  admissionId,
  canListSessions,
  canManageSessions,
  canViewRequests,
}: {
  admissionId: string;
  canListSessions: boolean;
  canManageSessions: boolean;
  canViewRequests: boolean;
}) {
  const queryClient = useQueryClient();

  const sessionsQ = useQuery({
    queryKey: ["bedside", "sessions"],
    queryFn: () => bedsideService.listBedsideSessions(),
    enabled: canListSessions,
  });

  const requestsQ = useQuery({
    queryKey: ["bedside", "nurse-requests", admissionId],
    queryFn: () => bedsideService.listBedsideNurseRequests(admissionId),
    enabled: canViewRequests && admissionId.length > 0,
  });

  const endSessionMut = useMutation({
    mutationFn: (sessionId: string) => bedsideService.endBedsideSession(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bedside", "sessions"] });
      notifications.show({ title: "Session ended", message: "Bedside tablet session closed." });
    },
  });

  const updateRequestMut = useMutation({
    mutationFn: ({ requestId, status }: { requestId: string; status: BedsideRequestStatus }) =>
      bedsideService.updateBedsideRequestStatus(requestId, { status }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["bedside", "nurse-requests", admissionId] }),
  });

  return (
    <Stack gap="md">
      {canListSessions && (
        <Card withBorder padding="md">
          <Group justify="space-between" mb="sm">
            <Title order={4}>Tablet Sessions</Title>
            <Badge tone="neutral" variant="light">
              {(sessionsQ.data ?? []).filter((session) => session.is_active).length} active
            </Badge>
          </Group>
          {sessionsQ.isLoading ? (
            <Loader size="sm" />
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Admission</Table.Th>
                  <Table.Th>Bed / Device</Table.Th>
                  <Table.Th>Started</Table.Th>
                  <Table.Th>Status</Table.Th>
                  {canManageSessions && <Table.Th>Actions</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(sessionsQ.data ?? []).slice(0, 20).map((session: BedsideSessionRow) => (
                  <Table.Tr key={session.id}>
                    <Table.Td>
                      <Text size="sm" fw={600}>
                        {compactContextId(session.admission_id)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Patient {compactContextId(session.patient_id)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{session.bed_location ?? "—"}</Text>
                      <Text size="xs" c="dimmed">
                        {session.device_id ?? "No device id"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{new Date(session.started_at).toLocaleString()}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge tone={session.is_active ? "success" : "neutral"} variant="light">
                        {session.is_active ? "Active" : "Ended"}
                      </Badge>
                    </Table.Td>
                    {canManageSessions && (
                      <Table.Td>
                        <Button
                          tone="secondary"
                          size="xs"
                          disabled={!session.is_active}
                          loading={endSessionMut.isPending}
                          onClick={() => endSessionMut.mutate(session.id)}
                        >
                          End
                        </Button>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>
      )}

      {canViewRequests && admissionId.length > 0 && (
        <Card withBorder padding="md">
          <Group justify="space-between" mb="sm">
            <Title order={4}>Nurse Request Queue</Title>
            <Badge tone="neutral" variant="light">
              {requestsQ.data?.length ?? 0} requests
            </Badge>
          </Group>
          {requestsQ.isLoading ? (
            <Loader size="sm" />
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Request</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th>Status</Table.Th>
                  {canManageSessions && <Table.Th>Actions</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(requestsQ.data ?? []).map((request: BedsideNurseRequestRow) => (
                  <Table.Tr key={request.id}>
                    <Table.Td>
                      <Text size="sm" fw={600}>
                        {REQUEST_TYPE_CONFIG[request.request_type]?.label ?? request.request_type}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {request.notes ?? "—"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{new Date(request.created_at).toLocaleString()}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        tone={requestStatusColors[request.status] ?? "neutral"}
                        variant="light"
                      >
                        {request.status.replace(/_/g, " ")}
                      </Badge>
                    </Table.Td>
                    {canManageSessions && (
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <Button
                            tone="secondary"
                            size="xs"
                            disabled={request.status !== "pending"}
                            loading={updateRequestMut.isPending}
                            onClick={() =>
                              updateRequestMut.mutate({
                                requestId: request.id,
                                status: "acknowledged",
                              })
                            }
                          >
                            Ack
                          </Button>
                          <Button
                            tone="secondary"
                            size="xs"
                            disabled={
                              request.status === "completed" || request.status === "cancelled"
                            }
                            loading={updateRequestMut.isPending}
                            onClick={() =>
                              updateRequestMut.mutate({
                                requestId: request.id,
                                status: "completed",
                              })
                            }
                          >
                            Done
                          </Button>
                        </Group>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>
      )}
    </Stack>
  );
}

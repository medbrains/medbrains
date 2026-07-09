import {
  Card,
  Group,
  Loader,
  Menu,
  Modal,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { TeleConsultation } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconBrandGoogle,
  IconCalendarPlus,
  IconDownload,
  IconPhoneOff,
  IconPlayerPlay,
  IconSettings,
  IconVideo,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { telemedicineService } from "@/services/telemedicine.service";
import { type CalendarEvent, downloadIcs, googleCalendarUrl } from "@/utils/calendar";

const PROVIDER_OPTIONS = [
  { value: "jitsi", label: "Jitsi (auto room)" },
  { value: "external", label: "External link (paste)" },
  { value: "zoom", label: "Zoom" },
  { value: "google_meet", label: "Google Meet" },
  { value: "teams", label: "Microsoft Teams" },
] as const;

const STATUS_TONE: Record<string, BadgeTone> = {
  scheduled: "info",
  waiting: "warning",
  in_progress: "success",
  completed: "neutral",
  cancelled: "danger",
  no_show: "danger",
};

const QUERY_KEY = ["tele-consultations"] as const;

interface CreateForm {
  patient_id: string;
  provider: string;
  meeting_url: string;
  scheduled_at: string;
}

const EMPTY_FORM: CreateForm = {
  patient_id: "",
  provider: "jitsi",
  meeting_url: "",
  scheduled_at: "",
};

function WaitingRoom() {
  const { data = [] } = useQuery({
    queryKey: ["tele-waiting-room"],
    queryFn: () => telemedicineService.getTeleWaitingRoom(),
    refetchInterval: 15_000,
  });
  if (data.length === 0) return null;
  return (
    <Card withBorder padding="md">
      <Text fw={600} size="sm" mb="xs">
        Waiting room ({data.length})
      </Text>
      <Stack gap="xs">
        {data.map((w) => (
          <Group key={w.id} gap="sm">
            <Badge tone="info" size="sm">
              #{w.position}
            </Badge>
            {w.acuity && (
              <Badge
                tone={
                  w.acuity === "emergent" ? "danger" : w.acuity === "urgent" ? "warning" : "neutral"
                }
                size="sm"
              >
                {w.acuity}
                {w.red_flags && w.red_flags.length > 0 ? ` · ${w.red_flags.length}🚩` : ""}
              </Badge>
            )}
            <Text size="sm">{w.patient_name ?? "Patient"}</Text>
            <Text size="xs" c="dimmed">
              {w.scheduled_at ? new Date(w.scheduled_at).toLocaleTimeString() : ""}
            </Text>
          </Group>
        ))}
      </Stack>
    </Card>
  );
}

const SYMPTOM_OPTIONS = [
  "chest_pain",
  "breathlessness",
  "sweating",
  "radiation_arm",
  "fever",
  "neck_stiffness",
  "photophobia",
  "facial_droop",
  "arm_weakness",
  "speech_difficulty",
  "anaphylaxis",
  "rash",
  "severe_bleeding",
  "suicidal_ideation",
  "cough",
  "sore_throat",
  "abdominal_pain",
  "headache",
  "vomiting",
  "dizziness",
];

function acuityTone(a: string): BadgeTone {
  if (a === "emergent") return "danger";
  if (a === "urgent") return "warning";
  return "success";
}

function TriageModal({ consultationId, onClose }: { consultationId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: existing } = useQuery({
    queryKey: ["triage", consultationId],
    queryFn: () => telemedicineService.getTriage(consultationId),
  });
  const [complaint, setComplaint] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [severity, setSeverity] = useState<number | "">("");
  const [spo2, setSpo2] = useState<number | "">("");
  const [systolic, setSystolic] = useState<number | "">("");

  const submit = useMutation({
    mutationFn: () =>
      telemedicineService.submitTriage(consultationId, {
        chief_complaint: complaint || undefined,
        symptoms,
        severity: typeof severity === "number" ? severity : undefined,
        vitals: {
          ...(typeof spo2 === "number" ? { spo2 } : {}),
          ...(typeof systolic === "number" ? { systolic } : {}),
        },
      }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["triage", consultationId] });
      void qc.invalidateQueries({ queryKey: ["tele-waiting-room"] });
      notifications.show({
        title: `Triage: ${r.acuity}`,
        message: r.recommended_timeframe ?? "",
        color: r.acuity === "emergent" ? "danger" : r.acuity === "urgent" ? "warning" : "success",
      });
    },
    onError: (e: Error) =>
      notifications.show({ title: "Triage failed", message: e.message, color: "danger" }),
  });
  const result = submit.data ?? existing ?? null;

  return (
    <Modal opened onClose={onClose} title="Pre-consult triage" size="md">
      <Stack gap="sm">
        <TextInput
          label="Chief complaint"
          value={complaint}
          onChange={(e) => setComplaint(e.currentTarget.value)}
        />
        <MultiSelect
          label="Symptoms"
          data={SYMPTOM_OPTIONS.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))}
          value={symptoms}
          onChange={setSymptoms}
          searchable
        />
        <Group grow>
          <NumberInput
            label="Severity 0-10"
            value={severity}
            onChange={(v) => setSeverity(typeof v === "number" ? v : "")}
            min={0}
            max={10}
          />
          <NumberInput
            label="SpO₂ %"
            value={spo2}
            onChange={(v) => setSpo2(typeof v === "number" ? v : "")}
          />
          <NumberInput
            label="Systolic BP"
            value={systolic}
            onChange={(v) => setSystolic(typeof v === "number" ? v : "")}
          />
        </Group>
        <Button onClick={() => submit.mutate()} loading={submit.isPending}>
          Run triage
        </Button>
        {result && (
          <Card withBorder padding="sm">
            <Group gap="xs">
              <Badge tone={acuityTone(result.acuity)}>{result.acuity}</Badge>
              <Text size="sm">{result.recommended_timeframe}</Text>
            </Group>
            {result.reasoning.length > 0 && (
              <Stack gap={2} mt="xs">
                {result.reasoning.map((r) => (
                  <Text key={r.flag} size="xs">
                    🚩 {r.flag.replace(/_/g, " ")} — {r.rule}
                  </Text>
                ))}
              </Stack>
            )}
          </Card>
        )}
      </Stack>
    </Modal>
  );
}

function ChatModal({ consultationId, onClose }: { consultationId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["tele-chat", consultationId],
    queryFn: () => telemedicineService.listTeleChat(consultationId),
    refetchInterval: 5_000,
  });
  const send = useMutation({
    mutationFn: () => telemedicineService.postTeleChat(consultationId, { body: text }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tele-chat", consultationId] });
      setText("");
    },
    onError: (e: Error) =>
      notifications.show({ title: "Send failed", message: e.message, color: "danger" }),
  });
  return (
    <Modal opened onClose={onClose} title="Consultation chat" size="md">
      <Stack gap="sm">
        <Stack gap="xs" style={{ maxHeight: 300, overflowY: "auto" }}>
          {data.length === 0 ? (
            <Text size="sm" c="dimmed">
              No messages yet.
            </Text>
          ) : (
            data.map((m) => (
              <Group key={m.id} gap={6}>
                <Badge tone={m.sender_role === "doctor" ? "info" : "neutral"} size="xs">
                  {m.sender_role}
                </Badge>
                <Text size="sm">{m.body}</Text>
              </Group>
            ))
          )}
        </Stack>
        <Group align="flex-end" gap="xs">
          <TextInput
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            placeholder="Message…"
            style={{ flex: 1 }}
          />
          <Button onClick={() => send.mutate()} loading={send.isPending} disabled={!text.trim()}>
            Send
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function TeleSettingsModal({
  opened,
  onClose,
  canManage,
}: {
  opened: boolean;
  onClose: () => void;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["tele-config"],
    queryFn: () => telemedicineService.getTeleConfig(),
    enabled: opened,
  });
  const [videoBase, setVideoBase] = useState("");
  const [provider, setProvider] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);
  if (data && !seeded) {
    setVideoBase(data.video_base_configured ? data.video_base : "");
    setProvider(data.default_provider);
    setSeeded(true);
  }
  const save = useMutation({
    mutationFn: () =>
      telemedicineService.updateTeleConfig({
        video_base: videoBase.trim() || undefined,
        default_provider: provider ?? undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tele-config"] });
      notifications.show({ title: "Saved", message: "Video config updated.", color: "success" });
      onClose();
    },
    onError: (e: Error) =>
      notifications.show({ title: "Save failed", message: e.message, color: "danger" }),
  });
  const available = (data?.providers ?? []).filter((p) => p.available);
  return (
    <Modal opened={opened} onClose={onClose} title="Video provider settings" size="md">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Effective Jitsi base: {data?.video_base ?? "…"}
          {data && !data.video_base_configured ? " (public default)" : ""}
        </Text>
        <TextInput
          label="Jitsi base URL (self-host)"
          value={videoBase}
          onChange={(e) => setVideoBase(e.currentTarget.value)}
          placeholder="https://meet.jit.si"
          disabled={!canManage}
        />
        <Select
          label="Default provider"
          data={available.map((p) => ({ value: p.name, label: p.name }))}
          value={provider}
          onChange={setProvider}
          disabled={!canManage}
        />
        <Text fw={600} size="sm">
          Providers
        </Text>
        {(data?.providers ?? []).map((p) => (
          <Group key={p.name} gap="xs">
            <Text size="sm">{p.name}</Text>
            <Badge tone={p.available ? "success" : "neutral"} size="xs">
              {p.available ? "available" : "not available"}
            </Badge>
            {p.requires_credentials && (
              <Badge tone="warning" size="xs">
                needs credentials
              </Badge>
            )}
          </Group>
        ))}
        <Text size="xs" c="dimmed">
          Zoom credentials (account / client id + secret) are provisioned in the secrets store, not
          entered here.
        </Text>
        {canManage && (
          <Button onClick={() => save.mutate()} loading={save.isPending}>
            Save
          </Button>
        )}
      </Stack>
    </Modal>
  );
}

function ResearchModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ["triage-research"],
    queryFn: () => telemedicineService.getTriageResearchSummary(),
    enabled: opened,
  });
  const download = useMutation({
    mutationFn: () => telemedicineService.getTriageResearchDataset(),
    onSuccess: (rows) => {
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tele-triage-research.json";
      a.click();
      URL.revokeObjectURL(url);
      notifications.show({
        title: "Downloaded",
        message: `${rows.length} de-identified rows`,
        color: "success",
      });
    },
    onError: (e: Error) =>
      notifications.show({ title: "Download failed", message: e.message, color: "danger" }),
  });
  const pct = data ? Math.round(data.emergent_escalation_rate * 100) : 0;
  return (
    <Modal opened={opened} onClose={onClose} title="Tele-triage research" size="md">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Aggregate + de-identified — no patient identifiers leave here.
        </Text>
        <Text size="sm">
          Triaged consults: <b>{data?.total ?? 0}</b>
        </Text>
        <Text fw={600} size="sm">
          By acuity
        </Text>
        {(data?.by_acuity ?? []).map((a) => (
          <Group key={a.acuity} gap="xs">
            <Badge tone={acuityTone(a.acuity)} size="xs">
              {a.acuity}
            </Badge>
            <Text size="sm">{a.count}</Text>
          </Group>
        ))}
        <Text fw={600} size="sm">
          Top red flags
        </Text>
        {(data?.red_flag_frequency ?? []).slice(0, 8).map((f) => (
          <Group key={f.flag} gap="xs">
            <Text size="sm">🚩 {f.flag.replace(/_/g, " ")}</Text>
            <Text size="xs" c="dimmed">
              {f.count}
            </Text>
          </Group>
        ))}
        <Text size="sm">
          Emergent → EMR-escalation rate: <b>{pct}%</b>
        </Text>
        <Button onClick={() => download.mutate()} loading={download.isPending}>
          Download de-identified dataset
        </Button>
      </Stack>
    </Modal>
  );
}

export function TelemedicinePage() {
  useRequirePermission(P.OPD.QUEUE_VIEW);
  const canCreate = useHasPermission(P.OPD.VISIT_CREATE);
  const canUpdate = useHasPermission(P.OPD.VISIT_UPDATE);
  const queryClient = useQueryClient();
  const [modalOpen, modal] = useDisclosure(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [followUpId, setFollowUpId] = useState<string | null>(null);
  const [followUpDate, setFollowUpDate] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [triageId, setTriageId] = useState<string | null>(null);
  const [settingsOpen, settings] = useDisclosure(false);
  const [researchOpen, research] = useDisclosure(false);
  const canManageSettings = useHasPermission("admin.settings.general.manage");

  const {
    data: consults = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => telemedicineService.listTeleConsultations(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const createMutation = useMutation({
    mutationFn: () =>
      telemedicineService.createTeleConsultation({
        patient_id: form.patient_id.trim(),
        provider: form.provider,
        meeting_url: form.meeting_url.trim() || undefined,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : undefined,
      }),
    onSuccess: () => {
      void invalidate();
      modal.close();
      setForm(EMPTY_FORM);
      notifications.show({
        title: "Consultation created",
        message: "Tele-consult scheduled.",
        color: "success",
      });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Create failed", message: err.message, color: "danger" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      telemedicineService.updateTeleStatus(id, { status }),
    onSuccess: () => void invalidate(),
    onError: (err: Error) =>
      notifications.show({ title: "Update failed", message: err.message, color: "danger" }),
  });

  const recordingMutation = useMutation({
    mutationFn: (v: { id: string; recording_consent?: boolean; is_recording?: boolean }) =>
      telemedicineService.updateTeleRecording(v.id, {
        recording_consent: v.recording_consent,
        is_recording: v.is_recording,
      }),
    onSuccess: () => void invalidate(),
    onError: (err: Error) =>
      notifications.show({
        title: "Recording update failed",
        message: err.message,
        color: "danger",
      }),
  });

  const followUpMutation = useMutation({
    mutationFn: (v: { id: string; scheduled_at: string }) =>
      telemedicineService.scheduleTeleFollowUp(v.id, { scheduled_at: v.scheduled_at }),
    onSuccess: () => {
      void invalidate();
      setFollowUpId(null);
      setFollowUpDate(null);
      notifications.show({
        title: "Follow-up scheduled",
        message: "A new tele-consult was created.",
        color: "success",
      });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Follow-up failed", message: err.message, color: "danger" }),
  });

  const join = async (c: TeleConsultation) => {
    try {
      const info = await telemedicineService.getTeleJoinInfo(c.id);
      if (!info.join_url) {
        notifications.show({
          title: "Not ready",
          message: "The meeting link is still being created — try again shortly.",
          color: "warning",
        });
        return;
      }
      window.open(info.join_url, "_blank", "noopener");
      if (c.status === "scheduled" || c.status === "waiting") {
        statusMutation.mutate({ id: c.id, status: "in_progress" });
      }
    } catch (err) {
      notifications.show({
        title: "Join failed",
        message: err instanceof Error ? err.message : "Unknown error",
        color: "danger",
      });
    }
  };

  const calendarEvent = async (c: TeleConsultation): Promise<CalendarEvent | null> => {
    try {
      const info = await telemedicineService.getTeleJoinInfo(c.id);
      return {
        title: "Tele-consultation",
        description: `Video consultation (${c.provider}).`,
        url: info.join_url,
        start: c.scheduled_at ? new Date(c.scheduled_at) : new Date(),
        durationMinutes: 30,
      };
    } catch {
      notifications.show({
        title: "Calendar",
        message: "Couldn't build the calendar event — the meeting link may not be ready.",
        color: "danger",
      });
      return null;
    }
  };

  const addToIcs = async (c: TeleConsultation) => {
    const event = await calendarEvent(c);
    if (event) downloadIcs(event, `tele-${c.id.slice(0, 8)}.ics`);
  };

  const addToGoogle = async (c: TeleConsultation) => {
    const event = await calendarEvent(c);
    if (event) window.open(googleCalendarUrl(event), "_blank", "noopener");
  };

  const submit = () => {
    if (!form.patient_id.trim()) {
      notifications.show({
        title: "Patient required",
        message: "Enter a patient id.",
        color: "danger",
      });
      return;
    }
    createMutation.mutate();
  };

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading consultations…</Text>
      </Stack>
    );
  }
  if (isError) {
    return (
      <Text c="danger" p="md">
        Failed to load tele-consultations.
      </Text>
    );
  }

  return (
    <Stack gap="lg" p="md">
      <Group justify="space-between">
        <div>
          <Group gap="xs">
            <IconVideo size={22} />
            <Text fw={700} size="xl">
              Telemedicine
            </Text>
          </Group>
          <Text size="sm" c="dimmed">
            Video consultations — Jitsi, an external link, or a connected provider (Zoom).
          </Text>
        </div>
        <Group gap="xs">
          <Button tone="ghost" size="compact-sm" onClick={research.open}>
            Research
          </Button>
          <IconButton
            tone="default"
            size="lg"
            aria-label="Video provider settings"
            onClick={settings.open}
          >
            <IconSettings size={16} />
          </IconButton>
          {canCreate && (
            <Button
              tone="primary"
              leftSection={<IconCalendarPlus size={16} />}
              onClick={modal.open}
            >
              New consultation
            </Button>
          )}
        </Group>
      </Group>

      <WaitingRoom />

      {consults.length > 0 ? (
        <DataTable
          columns={[
            {
              key: "patient",
              label: "Patient",
              render: (c: TeleConsultation) => (
                <Text size="xs" ff="monospace">
                  {c.patient_id.slice(0, 8)}
                </Text>
              ),
            },
            {
              key: "provider",
              label: "Provider",
              render: (c: TeleConsultation) => (
                <Badge tone="info" size="sm">
                  {c.provider}
                </Badge>
              ),
            },
            {
              key: "scheduled",
              label: "Scheduled",
              render: (c: TeleConsultation) => (
                <Text size="xs">
                  {c.scheduled_at ? new Date(c.scheduled_at).toLocaleString("en-IN") : "—"}
                </Text>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (c: TeleConsultation) => (
                <Badge tone={STATUS_TONE[c.status] ?? "neutral"} size="sm">
                  {c.status}
                </Badge>
              ),
            },
            {
              key: "actions",
              label: "Actions",
              render: (c: TeleConsultation) => {
                const closed = ["completed", "cancelled", "no_show"].includes(c.status);
                return (
                  <Group gap="xs" wrap="nowrap">
                    {!closed && (
                      <Button
                        tone="primary"
                        size="compact-xs"
                        leftSection={<IconVideo size={14} />}
                        onClick={() => void join(c)}
                      >
                        Join
                      </Button>
                    )}
                    {!closed && (
                      <Menu position="bottom-end" withinPortal>
                        <Menu.Target>
                          <IconButton tone="default" size="sm" aria-label="Add to calendar">
                            <IconCalendarPlus size={14} />
                          </IconButton>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconDownload size={14} />}
                            onClick={() => void addToIcs(c)}
                          >
                            Download .ics
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconBrandGoogle size={14} />}
                            onClick={() => void addToGoogle(c)}
                          >
                            Add to Google Calendar
                          </Menu.Item>
                          <Menu.Item onClick={() => setTriageId(c.id)}>Triage</Menu.Item>
                          <Menu.Item onClick={() => setChatId(c.id)}>Chat</Menu.Item>
                          <Menu.Item onClick={() => setFollowUpId(c.id)}>
                            Schedule follow-up
                          </Menu.Item>
                          {canUpdate && (
                            <Menu.Item
                              onClick={() =>
                                recordingMutation.mutate({
                                  id: c.id,
                                  recording_consent: true,
                                  is_recording: true,
                                })
                              }
                            >
                              Consent &amp; record
                            </Menu.Item>
                          )}
                          {canUpdate && (
                            <Menu.Item
                              onClick={() =>
                                recordingMutation.mutate({ id: c.id, is_recording: false })
                              }
                            >
                              Stop recording
                            </Menu.Item>
                          )}
                        </Menu.Dropdown>
                      </Menu>
                    )}
                    {canUpdate && c.status === "in_progress" && (
                      <IconButton
                        tone="success"
                        size="sm"
                        aria-label="Complete"
                        onClick={() => statusMutation.mutate({ id: c.id, status: "completed" })}
                      >
                        <IconPlayerPlay size={14} />
                      </IconButton>
                    )}
                    {canUpdate && !closed && (
                      <IconButton
                        tone="danger"
                        size="sm"
                        aria-label="Cancel"
                        onClick={() => statusMutation.mutate({ id: c.id, status: "cancelled" })}
                      >
                        <IconX size={14} />
                      </IconButton>
                    )}
                    {c.status === "completed" && (
                      <IconPhoneOff size={14} color="var(--mb-text-secondary)" />
                    )}
                  </Group>
                );
              },
            },
          ]}
          data={consults}
          rowKey={(c) => c.id}
        />
      ) : (
        <Stack align="center" py="xl" gap="xs">
          <IconVideo size={32} color="var(--mb-text-secondary)" />
          <Text c="dimmed">No tele-consultations yet.</Text>
        </Stack>
      )}

      <Modal opened={modalOpen} onClose={modal.close} title="New tele-consultation" size="md">
        <Stack gap="md">
          <PatientSearchSelect
            label="Patient"
            required
            value={form.patient_id}
            onChange={(patientId) => setForm({ ...form, patient_id: patientId })}
          />
          <Select
            label="Provider"
            data={[...PROVIDER_OPTIONS]}
            value={form.provider}
            onChange={(v) => setForm({ ...form, provider: v ?? "jitsi" })}
            allowDeselect={false}
          />
          {form.provider === "external" && (
            <TextInput
              label="Meeting link"
              placeholder="https://… (Zoom / Meet / Teams)"
              value={form.meeting_url}
              onChange={(e) => setForm({ ...form, meeting_url: e.currentTarget.value })}
            />
          )}
          <TextInput
            label="Scheduled at"
            type="datetime-local"
            value={form.scheduled_at}
            onChange={(e) => setForm({ ...form, scheduled_at: e.currentTarget.value })}
          />
          <Group justify="flex-end">
            <Button tone="ghost" onClick={modal.close}>
              Cancel
            </Button>
            <Button tone="primary" loading={createMutation.isPending} onClick={submit}>
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={!!followUpId}
        onClose={() => setFollowUpId(null)}
        title="Schedule follow-up"
        size="sm"
      >
        <Stack gap="sm">
          <DateTimePicker
            label="Follow-up date & time"
            value={followUpDate}
            onChange={setFollowUpDate}
          />
          <Button
            tone="primary"
            disabled={!followUpDate}
            loading={followUpMutation.isPending}
            onClick={() => {
              if (followUpId && followUpDate) {
                followUpMutation.mutate({
                  id: followUpId,
                  scheduled_at: new Date(followUpDate).toISOString(),
                });
              }
            }}
          >
            Schedule
          </Button>
        </Stack>
      </Modal>

      {triageId && <TriageModal consultationId={triageId} onClose={() => setTriageId(null)} />}
      {chatId && <ChatModal consultationId={chatId} onClose={() => setChatId(null)} />}

      <TeleSettingsModal
        opened={settingsOpen}
        onClose={settings.close}
        canManage={canManageSettings}
      />
      <ResearchModal opened={researchOpen} onClose={research.close} />
    </Stack>
  );
}

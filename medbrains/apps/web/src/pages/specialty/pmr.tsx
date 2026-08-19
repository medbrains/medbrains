import { Drawer, Group, NumberInput, Select, Stack, Tabs, Text, Textarea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useAuthStore, useHasPermission } from "@medbrains/stores";
import type {
  AudiologyTest,
  CreateRehabPlanRequest,
  CreateRehabSessionRequest,
  RehabDiscipline,
  RehabPlan,
  RehabSession,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { specialtyService } from "@/services/specialty.service";

const DISCIPLINES: { value: RehabDiscipline; label: string }[] = [
  { value: "physiotherapy", label: "Physiotherapy" },
  { value: "occupational_therapy", label: "Occupational Therapy" },
  { value: "speech_therapy", label: "Speech Therapy" },
  { value: "psychology", label: "Psychology" },
  { value: "prosthetics_orthotics", label: "Prosthetics & Orthotics" },
];

function toRehabDiscipline(value: string | null): RehabDiscipline {
  switch (value) {
    case "occupational_therapy":
    case "speech_therapy":
    case "psychology":
    case "prosthetics_orthotics":
      return value;
    default:
      return "physiotherapy";
  }
}

export function PmrPage() {
  useRequirePermission(P.SPECIALTY.PMR.PLANS_LIST);
  const qc = useQueryClient();
  const canPlan = useHasPermission(P.SPECIALTY.PMR.PLANS_CREATE);
  // Sessions are a separate read from plans, with their own code. An empty
  // session list reads as "this patient has attended no rehab".
  const canListSessions = useHasPermission(P.SPECIALTY.PMR.SESSIONS_LIST);

  const currentUserId = useAuthStore((s) => s.user?.id);
  const [tab, setTab] = useState<string | null>("plans");
  const [planOpen, planHandlers] = useDisclosure(false);
  const [sessionOpen, sessionHandlers] = useDisclosure(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["rehab-plans"],
    queryFn: () => specialtyService.listRehabPlans(),
  });
  const { data: sessions = [] } = useQuery({
    queryKey: ["rehab-sessions", selectedPlanId],
    queryFn: () => specialtyService.listRehabSessions(selectedPlanId ?? ""),
    enabled: !!selectedPlanId && canListSessions,
  });
  const { data: audioTests = [] } = useQuery({
    queryKey: ["audiology-tests"],
    queryFn: () => specialtyService.listAudiologyTests(),
  });

  const [planForm, setPlanForm] = useState<CreateRehabPlanRequest>({
    patient_id: "",
    discipline: "physiotherapy",
  });

  const createPlan = useMutation({
    mutationFn: (data: CreateRehabPlanRequest) => specialtyService.createRehabPlan(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rehab-plans"] });
      planHandlers.close();
      notifications.show({ title: "Created", message: "Rehab plan created", color: "success" });
    },
  });

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;
  const blankSession = (): CreateRehabSessionRequest => ({
    session_number: sessions.length + 1,
    therapist_id: currentUserId ?? "",
    intervention: "",
  });
  const [sessionForm, setSessionForm] = useState<CreateRehabSessionRequest>(blankSession);

  const createSession = useMutation({
    mutationFn: (data: CreateRehabSessionRequest) =>
      specialtyService.createRehabSession(selectedPlanId ?? "", data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rehab-sessions", selectedPlanId] });
      sessionHandlers.close();
      notifications.show({ title: "Recorded", message: "Session logged", color: "success" });
    },
    onError: (e: Error) =>
      notifications.show({ title: "Failed", message: e.message, color: "red" }),
  });

  const openSession = () => {
    setSessionForm(blankSession());
    sessionHandlers.open();
  };

  const planCols: Column<RehabPlan>[] = [
    {
      key: "patient_id",
      label: "Patient",
      render: (r) => <PatientNameCell patientId={r.patient_id} showUhid={false} />,
    },
    {
      key: "discipline",
      label: "Discipline",
      render: (r) => <Badge tone="neutral">{r.discipline.replace(/_/g, " ")}</Badge>,
    },
    {
      key: "fim_initial",
      label: "FIM (Initial)",
      render: (r) => <Text size="sm">{r.fim_score_initial ?? "---"}</Text>,
    },
    {
      key: "barthel_initial",
      label: "Barthel (Initial)",
      render: (r) => <Text size="sm">{r.barthel_score_initial ?? "---"}</Text>,
    },
    {
      key: "date",
      label: "Date",
      render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text>,
    },
  ];

  const sessionCols: Column<RehabSession>[] = [
    {
      key: "session",
      label: "Session #",
      render: (r) => <Text size="sm">{r.session_number}</Text>,
    },
    {
      key: "therapist",
      label: "Therapist",
      render: (r) => <Text size="sm">{r.therapist_id.slice(0, 8)}</Text>,
    },
    { key: "pain", label: "Pain", render: (r) => <Text size="sm">{r.pain_score ?? "---"}</Text> },
    { key: "fim", label: "FIM", render: (r) => <Text size="sm">{r.fim_score ?? "---"}</Text> },
    {
      key: "barthel",
      label: "Barthel",
      render: (r) => <Text size="sm">{r.barthel_score ?? "---"}</Text>,
    },
    {
      key: "date",
      label: "Date",
      render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text>,
    },
  ];

  const audioCols: Column<AudiologyTest>[] = [
    {
      key: "patient_id",
      label: "Patient",
      render: (r) => <PatientNameCell patientId={r.patient_id} showUhid={false} />,
    },
    {
      key: "test_type",
      label: "Test",
      render: (r) => <Badge tone="neutral">{r.test_type.toUpperCase()}</Badge>,
    },
    {
      key: "nhsp",
      label: "NHSP",
      render: (r) => (r.is_nhsp ? <Badge tone="primary">NHSP</Badge> : <Text size="sm">No</Text>),
    },
    {
      key: "referral",
      label: "Referral Needed",
      render: (r) =>
        r.nhsp_referral_needed ? <Badge tone="warning">Yes</Badge> : <Text size="sm">No</Text>,
    },
    {
      key: "date",
      label: "Date",
      render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="PMR & Audiology"
        subtitle="Physical medicine, rehabilitation, and hearing assessment"
        actions={
          canPlan ? (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={planHandlers.open}>
              New Rehab Plan
            </Button>
          ) : undefined
        }
      />
      <Tabs value={tab} onChange={setTab} mt="md">
        <Tabs.List>
          <Tabs.Tab value="plans">Rehab Plans</Tabs.Tab>
          <Tabs.Tab value="sessions">Sessions</Tabs.Tab>
          <Tabs.Tab value="audiology">Audiology</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="plans" pt="md">
          <DataTable
            columns={planCols}
            data={plans}
            loading={isLoading}
            rowKey={(r) => r.id}
            onRowClick={(r) => {
              setSelectedPlanId(r.id);
              setTab("sessions");
            }}
          />
        </Tabs.Panel>
        <Tabs.Panel value="sessions" pt="md">
          {selectedPlan ? (
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  {selectedPlan.discipline.replace(/_/g, " ")} plan · {sessions.length} session
                  {sessions.length === 1 ? "" : "s"}
                </Text>
                {canPlan && (
                  <Button
                    size="xs"
                    tone="primary"
                    leftSection={<IconPlus size={14} />}
                    onClick={openSession}
                  >
                    Record session
                  </Button>
                )}
              </Group>
              <DataTable
                columns={sessionCols}
                data={sessions}
                loading={false}
                rowKey={(r) => r.id}
              />
            </Stack>
          ) : (
            <Text c="dimmed">
              Select a rehab plan (from the Plans tab) to view and record sessions
            </Text>
          )}
        </Tabs.Panel>
        <Tabs.Panel value="audiology" pt="md">
          <DataTable columns={audioCols} data={audioTests} loading={false} rowKey={(r) => r.id} />
        </Tabs.Panel>
      </Tabs>
      <Drawer
        opened={planOpen}
        onClose={planHandlers.close}
        title="New Rehabilitation Plan"
        size="lg"
        position="right"
      >
        <Stack>
          <PatientSearchSelect
            value={planForm.patient_id}
            onChange={(patientId) => setPlanForm((p) => ({ ...p, patient_id: patientId }))}
          />
          <Select
            label="Discipline"
            required
            data={DISCIPLINES}
            value={planForm.discipline}
            onChange={(v) => setPlanForm((p) => ({ ...p, discipline: toRehabDiscipline(v) }))}
          />
          <Textarea
            label="Goals"
            value={planForm.goals ?? ""}
            onChange={(e) => setPlanForm((p) => ({ ...p, goals: e.currentTarget.value }))}
          />
          <NumberInput
            label="FIM Score (Initial)"
            value={planForm.fim_score_initial ?? ""}
            onChange={(v) =>
              setPlanForm((p) => ({
                ...p,
                fim_score_initial: typeof v === "number" ? v : undefined,
              }))
            }
          />
          <NumberInput
            label="Barthel Score (Initial)"
            value={planForm.barthel_score_initial ?? ""}
            onChange={(v) =>
              setPlanForm((p) => ({
                ...p,
                barthel_score_initial: typeof v === "number" ? v : undefined,
              }))
            }
          />
          <Button
            tone="primary"
            onClick={() => createPlan.mutate(planForm)}
            loading={createPlan.isPending}
          >
            Create Plan
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={sessionOpen}
        onClose={sessionHandlers.close}
        title="Record rehabilitation session"
        size="lg"
        position="right"
      >
        <Stack>
          <NumberInput
            label="Session number"
            required
            min={1}
            value={sessionForm.session_number}
            onChange={(v) =>
              setSessionForm((p) => ({ ...p, session_number: typeof v === "number" ? v : 1 }))
            }
          />
          <Textarea
            label="Intervention"
            required
            placeholder="Therapy performed this session (e.g. gait training, ROM exercises)"
            value={sessionForm.intervention ?? ""}
            onChange={(e) => setSessionForm((p) => ({ ...p, intervention: e.currentTarget.value }))}
          />
          <NumberInput
            label="Pain score (0–10)"
            min={0}
            max={10}
            value={sessionForm.pain_score ?? ""}
            onChange={(v) =>
              setSessionForm((p) => ({ ...p, pain_score: typeof v === "number" ? v : undefined }))
            }
          />
          <NumberInput
            label="FIM score"
            value={sessionForm.fim_score ?? ""}
            onChange={(v) =>
              setSessionForm((p) => ({ ...p, fim_score: typeof v === "number" ? v : undefined }))
            }
          />
          <NumberInput
            label="Barthel score"
            value={sessionForm.barthel_score ?? ""}
            onChange={(v) =>
              setSessionForm((p) => ({
                ...p,
                barthel_score: typeof v === "number" ? v : undefined,
              }))
            }
          />
          <Button
            tone="primary"
            disabled={!sessionForm.intervention?.trim()}
            loading={createSession.isPending}
            onClick={() => createSession.mutate(sessionForm)}
          >
            Save session
          </Button>
        </Stack>
      </Drawer>
    </div>
  );
}

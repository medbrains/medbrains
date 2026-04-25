import { useState } from "react";
import { Badge, Button, Drawer, NumberInput, Select, Stack, Tabs, Text, TextInput, Textarea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  RehabPlan, RehabSession, AudiologyTest,
  CreateRehabPlanRequest,
  RehabDiscipline,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../../components";
import { useRequirePermission } from "../../hooks/useRequirePermission";
import type { Column } from "../../components/DataTable";

const DISCIPLINES: { value: RehabDiscipline; label: string }[] = [
  { value: "physiotherapy", label: "Physiotherapy" },
  { value: "occupational_therapy", label: "Occupational Therapy" },
  { value: "speech_therapy", label: "Speech Therapy" },
  { value: "psychology", label: "Psychology" },
  { value: "prosthetics_orthotics", label: "Prosthetics & Orthotics" },
];

export function PmrPage() {
  useRequirePermission(P.SPECIALTY.PMR.PLANS_LIST);
  const qc = useQueryClient();
  const canPlan = useHasPermission(P.SPECIALTY.PMR.PLANS_CREATE);

  const [tab, setTab] = useState<string | null>("plans");
  const [planOpen, planHandlers] = useDisclosure(false);
  const [selectedPlanId] = useState<string | null>(null);

  const { data: plans = [], isLoading } = useQuery({ queryKey: ["rehab-plans"], queryFn: () => api.listRehabPlans() });
  const { data: sessions = [] } = useQuery({ queryKey: ["rehab-sessions", selectedPlanId], queryFn: () => api.listRehabSessions(selectedPlanId!), enabled: !!selectedPlanId });
  const { data: audioTests = [] } = useQuery({ queryKey: ["audiology-tests"], queryFn: () => api.listAudiologyTests() });

  const [planForm, setPlanForm] = useState<CreateRehabPlanRequest>({ patient_id: "", discipline: "physiotherapy" });

  const createPlan = useMutation({
    mutationFn: (data: CreateRehabPlanRequest) => api.createRehabPlan(data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["rehab-plans"] }); planHandlers.close(); notifications.show({ title: "Created", message: "Rehab plan created", color: "success" }); },
  });

  const planCols: Column<RehabPlan>[] = [
    { key: "patient_id", label: "Patient", render: (r) => <Text size="sm">{r.patient_id.slice(0, 8)}</Text> },
    { key: "discipline", label: "Discipline", render: (r) => <Badge>{r.discipline.replace(/_/g, " ")}</Badge> },
    { key: "fim_initial", label: "FIM (Initial)", render: (r) => <Text size="sm">{r.fim_score_initial ?? "---"}</Text> },
    { key: "barthel_initial", label: "Barthel (Initial)", render: (r) => <Text size="sm">{r.barthel_score_initial ?? "---"}</Text> },
    { key: "date", label: "Date", render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text> },
  ];

  const sessionCols: Column<RehabSession>[] = [
    { key: "session", label: "Session #", render: (r) => <Text size="sm">{r.session_number}</Text> },
    { key: "therapist", label: "Therapist", render: (r) => <Text size="sm">{r.therapist_id.slice(0, 8)}</Text> },
    { key: "pain", label: "Pain", render: (r) => <Text size="sm">{r.pain_score ?? "---"}</Text> },
    { key: "fim", label: "FIM", render: (r) => <Text size="sm">{r.fim_score ?? "---"}</Text> },
    { key: "barthel", label: "Barthel", render: (r) => <Text size="sm">{r.barthel_score ?? "---"}</Text> },
    { key: "date", label: "Date", render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text> },
  ];

  const audioCols: Column<AudiologyTest>[] = [
    { key: "patient_id", label: "Patient", render: (r) => <Text size="sm">{r.patient_id.slice(0, 8)}</Text> },
    { key: "test_type", label: "Test", render: (r) => <Badge>{r.test_type.toUpperCase()}</Badge> },
    { key: "nhsp", label: "NHSP", render: (r) => r.is_nhsp ? <Badge color="primary">NHSP</Badge> : <Text size="sm">No</Text> },
    { key: "referral", label: "Referral Needed", render: (r) => r.nhsp_referral_needed ? <Badge color="orange">Yes</Badge> : <Text size="sm">No</Text> },
    { key: "date", label: "Date", render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text> },
  ];

  return (
    <div>
      <PageHeader
        title="PMR & Audiology"
        subtitle="Physical medicine, rehabilitation, and hearing assessment"
        actions={canPlan ? <Button leftSection={<IconPlus size={16} />} onClick={planHandlers.open}>New Rehab Plan</Button> : undefined}
      />
      <Tabs value={tab} onChange={setTab} mt="md">
        <Tabs.List>
          <Tabs.Tab value="plans">Rehab Plans</Tabs.Tab>
          <Tabs.Tab value="sessions">Sessions</Tabs.Tab>
          <Tabs.Tab value="audiology">Audiology</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="plans" pt="md">
          <DataTable columns={planCols} data={plans} loading={isLoading} rowKey={(r) => r.id} />
        </Tabs.Panel>
        <Tabs.Panel value="sessions" pt="md">
          {selectedPlanId ? <DataTable columns={sessionCols} data={sessions} loading={false} rowKey={(r) => r.id} /> : <Text c="dimmed">Select a rehab plan to view sessions</Text>}
        </Tabs.Panel>
        <Tabs.Panel value="audiology" pt="md">
          <DataTable columns={audioCols} data={audioTests} loading={false} rowKey={(r) => r.id} />
        </Tabs.Panel>
      </Tabs>
      <Drawer opened={planOpen} onClose={planHandlers.close} title="New Rehabilitation Plan" size="lg" position="right">
        <Stack>
          <TextInput label="Patient ID" required value={planForm.patient_id} onChange={(e) => setPlanForm((p) => ({ ...p, patient_id: e.currentTarget.value }))} />
          <Select label="Discipline" required data={DISCIPLINES} value={planForm.discipline} onChange={(v) => setPlanForm((p) => ({ ...p, discipline: (v ?? "physiotherapy") as RehabDiscipline }))} />
          <Textarea label="Goals" value={planForm.goals ?? ""} onChange={(e) => setPlanForm((p) => ({ ...p, goals: e.currentTarget.value }))} />
          <NumberInput label="FIM Score (Initial)" value={planForm.fim_score_initial ?? ""} onChange={(v) => setPlanForm((p) => ({ ...p, fim_score_initial: typeof v === "number" ? v : undefined }))} />
          <NumberInput label="Barthel Score (Initial)" value={planForm.barthel_score_initial ?? ""} onChange={(v) => setPlanForm((p) => ({ ...p, barthel_score_initial: typeof v === "number" ? v : undefined }))} />
          <Button onClick={() => createPlan.mutate(planForm)} loading={createPlan.isPending}>Create Plan</Button>
        </Stack>
      </Drawer>
    </div>
  );
}

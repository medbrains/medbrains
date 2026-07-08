import {
  Card,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { MdsAssessment, PharmacyCatalog } from "@medbrains/types";
import { IconPlus, IconReportMedical } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { DrugSearchSelect } from "@/components/DrugSearchSelect";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { longTermCareService } from "@/services/longTermCare.service";

const MDS_TYPES = ["admission", "quarterly", "annual", "significant_change", "discharge"];
const COGNITIVE = ["intact", "mild impairment", "moderate impairment", "severe impairment"];
const CONTINENCE = [
  "continent",
  "occasionally incontinent",
  "frequently incontinent",
  "incontinent",
];

function CreateMdsModal({
  patientId,
  opened,
  onClose,
}: {
  patientId: string;
  opened: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [type, setType] = useState<string | null>("admission");
  const [cognitive, setCognitive] = useState<string | null>(null);
  const [mood, setMood] = useState<number | "">("");
  const [adl, setAdl] = useState<number | "">("");
  const [continence, setContinence] = useState<string | null>(null);
  const [nutrition, setNutrition] = useState("");

  const create = useMutation({
    mutationFn: () =>
      longTermCareService.createMdsAssessment({
        patient_id: patientId,
        assessment_type: type ?? "admission",
        cognitive_status: cognitive ?? undefined,
        mood_score: typeof mood === "number" ? mood : undefined,
        adl_dependency_score: typeof adl === "number" ? adl : undefined,
        continence_status: continence ?? undefined,
        nutrition_notes: nutrition || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mds", patientId] });
      toast.success("Assessment started", { title: "Long-term care" });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="New MDS assessment" size="lg">
      <Stack gap="sm">
        <Group grow>
          <Select
            label="Type"
            data={MDS_TYPES.map((t) => ({ value: t, label: t.replace("_", " ") }))}
            value={type}
            onChange={setType}
          />
          <Select
            label="Cognition"
            data={COGNITIVE.map((c) => ({ value: c, label: c }))}
            value={cognitive}
            onChange={setCognitive}
            clearable
          />
        </Group>
        <Group grow>
          <NumberInput
            label="Mood score (PHQ-9)"
            value={mood}
            onChange={(v) => setMood(typeof v === "number" ? v : "")}
            min={0}
            max={27}
          />
          <NumberInput
            label="ADL dependency"
            value={adl}
            onChange={(v) => setAdl(typeof v === "number" ? v : "")}
            min={0}
            max={28}
          />
          <Select
            label="Continence"
            data={CONTINENCE.map((c) => ({ value: c, label: c }))}
            value={continence}
            onChange={setContinence}
            clearable
          />
        </Group>
        <Textarea
          label="Nutrition notes"
          value={nutrition}
          onChange={(e) => setNutrition(e.currentTarget.value)}
        />
        <Button onClick={() => create.mutate()} loading={create.isPending}>
          Start assessment
        </Button>
      </Stack>
    </Modal>
  );
}

function LtcMedicationsPanel({ patientId, canManage }: { patientId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [drugId, setDrugId] = useState("");
  const [drugName, setDrugName] = useState("");
  const [dosage, setDosage] = useState("");
  const [freq, setFreq] = useState("");
  const [supply, setSupply] = useState<number | "">(90);
  const [autoRefill, setAutoRefill] = useState(true);

  const { data = [] } = useQuery({
    queryKey: ["ltc-meds", patientId],
    queryFn: () => longTermCareService.listLtcMedications(patientId),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["ltc-meds", patientId] });
  };
  const add = useMutation({
    mutationFn: () =>
      longTermCareService.addLtcMedication({
        patient_id: patientId,
        drug_name: drugName,
        dosage: dosage || undefined,
        frequency: freq || undefined,
        supply_days: typeof supply === "number" ? supply : 90,
        auto_refill: autoRefill,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Medication added", { title: "Long-term care" });
      setDrugId("");
      setDrugName("");
      setDosage("");
      setFreq("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  const refill = useMutation({
    mutationFn: (id: string) => longTermCareService.refillLtcMedication(id),
    onSuccess: () => {
      invalidate();
      toast.success("Refilled", { title: "Long-term care" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  const update = useMutation({
    mutationFn: (v: { id: string; status: string }) =>
      longTermCareService.updateLtcMedication(v.id, { status: v.status }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  const medTone = (s: string): BadgeTone =>
    s === "active" ? "success" : s === "paused" ? "warning" : "neutral";

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        Long-term medications
      </Text>
      {canManage && (
        <>
          <DrugSearchSelect
            value={drugId}
            onChange={(id, drug?: PharmacyCatalog) => {
              setDrugId(id);
              setDrugName(drug?.name ?? "");
            }}
          />
          <Group grow>
            <TextInput
              label="Dosage"
              value={dosage}
              onChange={(e) => setDosage(e.currentTarget.value)}
              placeholder="500 mg"
            />
            <TextInput
              label="Frequency"
              value={freq}
              onChange={(e) => setFreq(e.currentTarget.value)}
              placeholder="BD"
            />
            <NumberInput
              label="Supply (days)"
              value={supply}
              onChange={(v) => setSupply(typeof v === "number" ? v : "")}
              min={1}
            />
          </Group>
          <Switch
            label="Auto-refill"
            checked={autoRefill}
            onChange={(e) => setAutoRefill(e.currentTarget.checked)}
          />
          <Button onClick={() => add.mutate()} loading={add.isPending} disabled={!drugName}>
            Add medication
          </Button>
        </>
      )}
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          No long-term medications.
        </Text>
      ) : (
        data.map((m) => (
          <Group key={m.id} justify="space-between">
            <Stack gap={0}>
              <Group gap={6}>
                <Badge tone={medTone(m.status)} size="xs">
                  {m.status}
                </Badge>
                {m.auto_refill && (
                  <Badge tone="info" size="xs">
                    auto
                  </Badge>
                )}
                <Text size="sm">
                  {m.drug_name} {m.dosage} {m.frequency}
                </Text>
              </Group>
              <Text size="xs" c="dimmed">
                next refill{" "}
                {m.next_refill_date ? new Date(m.next_refill_date).toLocaleDateString() : "—"} ·{" "}
                {m.refill_count} refills
              </Text>
            </Stack>
            {canManage && m.status === "active" && (
              <Group gap="xs">
                <Button size="xs" tone="primary" onClick={() => refill.mutate(m.id)}>
                  Refill
                </Button>
                <Button
                  size="xs"
                  tone="ghost"
                  onClick={() => update.mutate({ id: m.id, status: "discontinued" })}
                >
                  Stop
                </Button>
              </Group>
            )}
          </Group>
        ))
      )}
    </Stack>
  );
}

export function LongTermCarePage() {
  useRequirePermission("ipd.nursing_assessment.list");
  const canManage = useHasPermission("ipd.nursing_assessment.create");
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [modalOpen, modal] = useDisclosure(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["mds", patientId],
    queryFn: () => longTermCareService.listMdsAssessments(patientId),
    enabled: !!patientId,
  });

  const complete = useMutation({
    mutationFn: (id: string) => longTermCareService.completeMdsAssessment(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mds", patientId] });
      toast.success("Assessment completed", { title: "Long-term care" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  const columns: Column<MdsAssessment>[] = [
    { key: "assessment_type", label: "Type", render: (r) => r.assessment_type.replace("_", " ") },
    {
      key: "assessment_date",
      label: "Date",
      render: (r) => new Date(r.assessment_date).toLocaleDateString(),
    },
    { key: "cognitive_status", label: "Cognition", render: (r) => r.cognitive_status ?? "—" },
    { key: "mood_score", label: "Mood", render: (r) => r.mood_score ?? "—" },
    { key: "adl_dependency_score", label: "ADL", render: (r) => r.adl_dependency_score ?? "—" },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge tone={(r.status === "completed" ? "success" : "neutral") as BadgeTone}>
          {r.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canManage && r.status === "draft" ? (
          <Button
            size="xs"
            tone="primary"
            loading={complete.isPending}
            onClick={() => complete.mutate(r.id)}
          >
            Complete
          </Button>
        ) : null,
    },
  ];

  return (
    <Stack gap="md">
      <PageHeader
        title="Long-term care"
        subtitle="MDS assessments for long-stay residents"
        icon={<IconReportMedical size={20} />}
      />
      <Group align="flex-end" gap="sm">
        <PatientSearchSelect value={patientId} onChange={setPatientId} />
        {patientId && canManage && (
          <Button leftSection={<IconPlus size={16} />} onClick={modal.open}>
            New MDS assessment
          </Button>
        )}
      </Group>
      {patientId ? (
        <DataTable
          columns={columns}
          data={data}
          loading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="No MDS assessments for this resident."
        />
      ) : (
        <Text c="dimmed">Select a resident to view their MDS assessments.</Text>
      )}
      {patientId && (
        <Card withBorder padding="md">
          <LtcMedicationsPanel patientId={patientId} canManage={canManage} />
        </Card>
      )}
      {patientId && (
        <CreateMdsModal patientId={patientId} opened={modalOpen} onClose={modal.close} />
      )}
    </Stack>
  );
}

import { Checkbox, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { VteRiskFactors } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { vteService } from "@/services/vte.service";

const FACTORS: { key: keyof VteRiskFactors; label: string; weight: number }[] = [
  { key: "active_cancer", label: "Active cancer", weight: 3 },
  { key: "previous_vte", label: "Previous VTE", weight: 3 },
  { key: "reduced_mobility", label: "Reduced mobility (≥3 days)", weight: 3 },
  { key: "thrombophilia", label: "Known thrombophilia", weight: 3 },
  { key: "recent_trauma_surgery", label: "Trauma / surgery (≤1 month)", weight: 2 },
  { key: "age_over_70", label: "Age ≥ 70", weight: 1 },
  { key: "cardiac_resp_failure", label: "Heart / respiratory failure", weight: 1 },
  { key: "acute_mi_stroke", label: "Acute MI / ischemic stroke", weight: 1 },
  { key: "acute_infection_rheum", label: "Acute infection / rheumatologic", weight: 1 },
  { key: "obesity", label: "Obesity (BMI ≥ 30)", weight: 1 },
  { key: "hormonal_treatment", label: "Ongoing hormonal treatment", weight: 1 },
];

/** Padua VTE risk assessment — the server computes the authoritative score; this shows a live preview. */
export function VteAssessmentPanel({ patientId }: { patientId: string }) {
  const qc = useQueryClient();
  const [factors, setFactors] = useState<Partial<VteRiskFactors>>({});
  const [bleeding, setBleeding] = useState(false);
  const [notes, setNotes] = useState("");

  const { data: history = [] } = useQuery({
    queryKey: ["vte-assessments", patientId],
    queryFn: () => vteService.listVteAssessments(patientId),
    enabled: !!patientId,
  });

  const create = useMutation({
    mutationFn: () =>
      vteService.createVteAssessment({
        patient_id: patientId,
        ...factors,
        has_bleeding_risk: bleeding,
        notes: notes.trim() || undefined,
      }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["vte-assessments", patientId] });
      notifications.show({
        title: `Padua ${r.score} — ${r.high_risk ? "HIGH risk" : "low risk"}`,
        message: r.prophylaxis_recommended
          ? "Pharmacological thromboprophylaxis recommended."
          : r.high_risk
            ? "High risk but bleeding risk noted — consider mechanical prophylaxis."
            : "No pharmacological prophylaxis indicated.",
        color: r.high_risk ? "warning" : "success",
      });
      setFactors({});
      setBleeding(false);
      setNotes("");
    },
    onError: (e: Error) =>
      notifications.show({ title: "Save failed", message: e.message, color: "danger" }),
  });

  const liveScore = FACTORS.reduce((s, f) => s + (factors[f.key] ? f.weight : 0), 0);

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        Padua VTE risk factors
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        {FACTORS.map((f) => (
          <Checkbox
            key={f.key}
            label={`${f.label} (+${f.weight})`}
            checked={!!factors[f.key]}
            onChange={(e) => setFactors((p) => ({ ...p, [f.key]: e.currentTarget.checked }))}
          />
        ))}
      </SimpleGrid>
      <Checkbox
        label="Bleeding risk — contraindicates pharmacological prophylaxis"
        checked={bleeding}
        onChange={(e) => setBleeding(e.currentTarget.checked)}
      />
      <TextInput label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
      <Text size="sm">
        Live Padua score:{" "}
        <Badge tone={liveScore >= 4 ? "warning" : "success"}>
          {liveScore} · {liveScore >= 4 ? "high risk" : "low risk"}
        </Badge>
      </Text>
      <Button tone="primary" loading={create.isPending} onClick={() => create.mutate()}>
        Save assessment
      </Button>

      {history.length > 0 && (
        <Stack gap={4}>
          <Text fw={600} size="sm">
            History
          </Text>
          {history.map((h) => (
            <Text key={h.id} size="xs" c="dimmed">
              {new Date(h.created_at).toLocaleString()} — Padua {h.score} (
              {h.high_risk ? "high" : "low"})
              {h.prophylaxis_recommended ? " · prophylaxis recommended" : ""}
            </Text>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

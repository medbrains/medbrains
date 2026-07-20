// Telemedicine TriageModal — split from telemedicine.tsx (pure move).

import {
  Card,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { telemedicineService } from "@/services/telemedicine.service";
import { acuityTone } from "./shared";

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

export function TriageModal({
  consultationId,
  onClose,
}: {
  consultationId: string;
  onClose: () => void;
}) {
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

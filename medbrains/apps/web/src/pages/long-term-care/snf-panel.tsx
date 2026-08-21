// Long-term-care SnfPanel — split from long-term-care.tsx (pure move).

import { Group, NumberInput, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { BadgeTone } from "@/components/ui";
import { Badge, Button, toast } from "@/components/ui";
import { longTermCareService } from "@/services/longTermCare.service";

const SNF_SOURCES = ["hospital_discharge", "direct", "transfer"];
const SNF_LEVELS = ["skilled_nursing", "rehab", "long_term"];

export function SnfPanel({ patientId }: { patientId: string }) {
  const canView = useHasPermission(P.SPECIALTY.LTC.SNF_LIST);
  const canCreate = useHasPermission(P.SPECIALTY.LTC.SNF_CREATE);
  const canUpdate = useHasPermission(P.SPECIALTY.LTC.SNF_UPDATE);
  const qc = useQueryClient();
  const [source, setSource] = useState<string | null>("hospital_discharge");
  const [level, setLevel] = useState<string | null>("skilled_nursing");
  const [diagnosis, setDiagnosis] = useState("");
  const [plan, setPlan] = useState("");
  const [los, setLos] = useState<number | "">("");

  const { data = [] } = useQuery({
    queryKey: ["snf", patientId],
    queryFn: () => longTermCareService.listSnfAdmissions(patientId),
    enabled: canView,
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["snf", patientId] });
  };
  const admit = useMutation({
    mutationFn: () =>
      longTermCareService.createSnfAdmission({
        patient_id: patientId,
        source: source ?? "hospital_discharge",
        level_of_care: level ?? "skilled_nursing",
        primary_diagnosis: diagnosis || undefined,
        care_plan: plan || undefined,
        expected_los_days: typeof los === "number" ? los : undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Admitted to SNF", { title: "Long-term care" });
      setDiagnosis("");
      setPlan("");
      setLos("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  const update = useMutation({
    mutationFn: (v: { id: string; status: string }) =>
      longTermCareService.updateSnfAdmission(v.id, { status: v.status }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  const snfTone = (s: string): BadgeTone =>
    s === "admitted" ? "success" : s === "transferred" ? "warning" : "neutral";

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        SNF admissions
      </Text>
      {canCreate && (
        <>
          <Group grow>
            <Select
              label="Source"
              data={SNF_SOURCES.map((s) => ({ value: s, label: s.replace("_", " ") }))}
              value={source}
              onChange={setSource}
            />
            <Select
              label="Level of care"
              data={SNF_LEVELS.map((s) => ({ value: s, label: s.replace("_", " ") }))}
              value={level}
              onChange={setLevel}
            />
            <NumberInput
              label="Expected LOS (days)"
              value={los}
              onChange={(v) => setLos(typeof v === "number" ? v : "")}
              min={0}
            />
          </Group>
          <TextInput
            label="Primary diagnosis"
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.currentTarget.value)}
          />
          <Textarea
            label="Care plan"
            value={plan}
            onChange={(e) => setPlan(e.currentTarget.value)}
            minRows={2}
          />
          <Button onClick={() => admit.mutate()} loading={admit.isPending}>
            Admit to SNF
          </Button>
        </>
      )}
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          No SNF admissions.
        </Text>
      ) : (
        data.map((a) => (
          <Group key={a.id} justify="space-between">
            <Stack gap={0}>
              <Group gap={6}>
                <Badge tone={snfTone(a.status)} size="xs">
                  {a.status}
                </Badge>
                <Badge tone="neutral" size="xs">
                  {a.level_of_care.replace("_", " ")}
                </Badge>
                <Text size="sm">{a.primary_diagnosis}</Text>
              </Group>
              <Text size="xs" c="dimmed">
                {new Date(a.admission_date).toLocaleDateString()}
                {a.expected_los_days ? ` · ~${a.expected_los_days}d` : ""}
              </Text>
            </Stack>
            {canUpdate && a.status === "admitted" && (
              <Button
                size="xs"
                tone="secondary"
                onClick={() => update.mutate({ id: a.id, status: "discharged" })}
              >
                Discharge
              </Button>
            )}
          </Group>
        ))
      )}
    </Stack>
  );
}

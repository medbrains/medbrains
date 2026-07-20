// Long-term-care ReadmissionRiskPanel — split from long-term-care.tsx (pure move).

import { Group, NumberInput, Stack, Text } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { BadgeTone } from "@/components/ui";
import { Badge, Button, toast } from "@/components/ui";
import { longTermCareService } from "@/services/longTermCare.service";

export function ReadmissionRiskPanel({
  patientId,
  canManage,
}: {
  patientId: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [los, setLos] = useState<number | "">("");
  const [acuity, setAcuity] = useState<number | "">("");
  const [comorbidity, setComorbidity] = useState<number | "">("");
  const [ed, setEd] = useState<number | "">("");

  const { data = [] } = useQuery({
    queryKey: ["readmission-risk", patientId],
    queryFn: () => longTermCareService.listReadmissionRisk(patientId),
  });
  const n = (x: number | "") => (typeof x === "number" ? x : 0);
  const assess = useMutation({
    mutationFn: () =>
      longTermCareService.assessReadmissionRisk({
        patient_id: patientId,
        length_of_stay: n(los),
        acuity_score: n(acuity),
        comorbidity_score: n(comorbidity),
        ed_visits: n(ed),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["readmission-risk", patientId] });
      toast.success("Risk scored", { title: "Long-term care" });
      setLos("");
      setAcuity("");
      setComorbidity("");
      setEd("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  const riskTone = (l: string): BadgeTone =>
    l === "high" ? "danger" : l === "moderate" ? "warning" : "success";

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        Readmission risk (LACE)
      </Text>
      {canManage && (
        <>
          <Group grow>
            <NumberInput
              label="Length of stay"
              value={los}
              onChange={(v) => setLos(typeof v === "number" ? v : "")}
              min={0}
            />
            <NumberInput
              label="Acuity"
              value={acuity}
              onChange={(v) => setAcuity(typeof v === "number" ? v : "")}
              min={0}
            />
            <NumberInput
              label="Comorbidity"
              value={comorbidity}
              onChange={(v) => setComorbidity(typeof v === "number" ? v : "")}
              min={0}
            />
            <NumberInput
              label="ED visits"
              value={ed}
              onChange={(v) => setEd(typeof v === "number" ? v : "")}
              min={0}
            />
          </Group>
          <Button onClick={() => assess.mutate()} loading={assess.isPending}>
            Score risk
          </Button>
        </>
      )}
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          No risk assessments.
        </Text>
      ) : (
        data.map((r) => (
          <Group key={r.id} gap="xs">
            <Badge tone={riskTone(r.risk_level)} size="xs">
              {r.risk_level} · {r.total_score}
            </Badge>
            <Text size="xs" c="dimmed">
              LOS {r.length_of_stay} · acuity {r.acuity_score} · comorbid {r.comorbidity_score} · ED{" "}
              {r.ed_visits} · {new Date(r.assessed_at).toLocaleDateString()}
            </Text>
          </Group>
        ))
      )}
    </Stack>
  );
}

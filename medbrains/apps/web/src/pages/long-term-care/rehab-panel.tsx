// Long-term-care RehabPanel — split from long-term-care.tsx (pure move).

import { Group, NumberInput, Select, Stack, Text, TextInput } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, toast } from "@/components/ui";
import { longTermCareService } from "@/services/longTermCare.service";

const THERAPY_TYPES = ["physiotherapy", "occupational", "speech"];

export function RehabPanel({ patientId }: { patientId: string }) {
  const canView = useHasPermission(P.SPECIALTY.LTC.REHAB_LIST);
  const canCreate = useHasPermission(P.SPECIALTY.LTC.REHAB_CREATE);
  const qc = useQueryClient();
  const [type, setType] = useState<string | null>("physiotherapy");
  const [goal, setGoal] = useState("");
  const [note, setNote] = useState("");
  const [score, setScore] = useState<number | "">("");

  const { data = [] } = useQuery({
    queryKey: ["rehab", patientId],
    queryFn: () => longTermCareService.listRehabProgress(patientId),
    enabled: canView,
  });
  const add = useMutation({
    mutationFn: () =>
      longTermCareService.addRehabProgress({
        patient_id: patientId,
        therapy_type: type ?? "physiotherapy",
        goal: goal || undefined,
        progress_note: note || undefined,
        functional_score: typeof score === "number" ? score : undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rehab", patientId] });
      toast.success("Session recorded", { title: "Long-term care" });
      setGoal("");
      setNote("");
      setScore("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        Rehabilitation progress
      </Text>
      {canCreate && (
        <>
          <Group grow>
            <Select
              label="Therapy"
              data={THERAPY_TYPES.map((t) => ({ value: t, label: t }))}
              value={type}
              onChange={setType}
            />
            <NumberInput
              label="Functional score"
              value={score}
              onChange={(v) => setScore(typeof v === "number" ? v : "")}
              min={0}
              max={100}
            />
          </Group>
          <TextInput label="Goal" value={goal} onChange={(e) => setGoal(e.currentTarget.value)} />
          <TextInput
            label="Progress note"
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
          />
          <Button onClick={() => add.mutate()} loading={add.isPending}>
            Record session
          </Button>
        </>
      )}
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          No rehab sessions recorded.
        </Text>
      ) : (
        data.map((r) => (
          <Group key={r.id} gap="xs">
            <Badge tone="neutral" size="xs">
              {r.therapy_type}
            </Badge>
            {r.functional_score != null && (
              <Badge tone="info" size="xs">
                score {r.functional_score}
              </Badge>
            )}
            <Text size="sm">{r.goal || r.progress_note}</Text>
            <Text size="xs" c="dimmed">
              {new Date(r.session_date).toLocaleDateString()}
            </Text>
          </Group>
        ))
      )}
    </Stack>
  );
}

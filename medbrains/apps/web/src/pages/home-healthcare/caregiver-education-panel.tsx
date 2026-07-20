// Home-healthcare CaregiverEducationPanel — split from home-healthcare.tsx (pure move).

import { Group, Stack, Switch, Text, TextInput } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, toast } from "@/components/ui";
import { homeHealthService } from "@/services/homeHealth.service";

export function CaregiverEducationPanel({
  patientId,
  canManage,
}: {
  patientId: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [rel, setRel] = useState("");
  const [topic, setTopic] = useState("");
  const [materials, setMaterials] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["caregiver-edu", patientId],
    queryFn: () => homeHealthService.listCaregiverEducation(patientId),
  });
  const record = useMutation({
    mutationFn: () =>
      homeHealthService.recordCaregiverEducation({
        patient_id: patientId,
        caregiver_name: name,
        relationship: rel || undefined,
        topic,
        materials_provided: materials || undefined,
        understanding_confirmed: confirmed,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["caregiver-edu", patientId] });
      toast.success("Session recorded", { title: "Home healthcare" });
      setName("");
      setTopic("");
      setMaterials("");
      setConfirmed(false);
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        Caregiver education
      </Text>
      {canManage && (
        <>
          <Group grow>
            <TextInput
              label="Caregiver"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
            />
            <TextInput
              label="Relationship"
              value={rel}
              onChange={(e) => setRel(e.currentTarget.value)}
              placeholder="son / spouse"
            />
          </Group>
          <Group grow>
            <TextInput
              label="Topic"
              value={topic}
              onChange={(e) => setTopic(e.currentTarget.value)}
              placeholder="Wound dressing technique"
            />
            <TextInput
              label="Materials given"
              value={materials}
              onChange={(e) => setMaterials(e.currentTarget.value)}
            />
          </Group>
          <Switch
            label="Understanding confirmed (teach-back)"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.currentTarget.checked)}
          />
          <Button
            onClick={() => record.mutate()}
            loading={record.isPending}
            disabled={!name.trim() || !topic.trim()}
          >
            Record session
          </Button>
        </>
      )}
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          No caregiver education recorded.
        </Text>
      ) : (
        data.map((s) => (
          <Group key={s.id} gap="xs">
            <Text size="sm">
              {s.caregiver_name}
              {s.relationship ? ` (${s.relationship})` : ""} · {s.topic}
            </Text>
            <Badge tone={s.understanding_confirmed ? "success" : "warning"} size="xs">
              {s.understanding_confirmed ? "understood" : "pending"}
            </Badge>
            <Text size="xs" c="dimmed">
              {new Date(s.session_date).toLocaleDateString()}
            </Text>
          </Group>
        ))
      )}
    </Stack>
  );
}

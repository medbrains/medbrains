// Home-healthcare DischargePanel — split from home-healthcare.tsx (pure move).

import { Checkbox, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, toast } from "@/components/ui";
import { homeHealthService } from "@/services/homeHealth.service";

export function DischargePanel({
  patientId,
  canManage,
}: {
  patientId: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string | null>("criterion");
  const { data = [] } = useQuery({
    queryKey: ["home-discharge", patientId],
    queryFn: () => homeHealthService.listDischargeProgram(patientId),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["home-discharge", patientId] });
  };
  const add = useMutation({
    mutationFn: () =>
      homeHealthService.addDischargeItem({
        patient_id: patientId,
        item_type: type ?? "criterion",
        title,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Item added", { title: "Home healthcare" });
      setTitle("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; done: boolean }) =>
      homeHealthService.toggleDischargeItem(v.id, v.done),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        Discharge readiness
      </Text>
      {canManage && (
        <Group align="flex-end" gap="sm">
          <Select
            label="Type"
            data={[
              { value: "criterion", label: "Discharge criterion" },
              { value: "training", label: "Training material" },
            ]}
            value={type}
            onChange={setType}
            w={190}
          />
          <TextInput
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button onClick={() => add.mutate()} loading={add.isPending} disabled={!title.trim()}>
            Add
          </Button>
        </Group>
      )}
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          No discharge items.
        </Text>
      ) : (
        data.map((i) => (
          <Group key={i.id} gap="xs">
            <Checkbox
              checked={i.is_complete}
              disabled={!canManage}
              onChange={(e) => toggle.mutate({ id: i.id, done: e.currentTarget.checked })}
              label={i.title}
            />
            <Badge tone="neutral" size="xs">
              {i.item_type === "training" ? "training" : "criterion"}
            </Badge>
          </Group>
        ))
      )}
    </Stack>
  );
}

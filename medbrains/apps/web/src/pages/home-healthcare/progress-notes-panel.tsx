// Home-healthcare ProgressNotesPanel — split from home-healthcare.tsx (pure move).

import { Group, Select, Stack, Text, Textarea } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, toast } from "@/components/ui";
import { homeHealthService } from "@/services/homeHealth.service";

export function ProgressNotesPanel({
  patientId,
  canManage,
}: {
  patientId: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [role, setRole] = useState<string | null>("nurse");
  const { data = [] } = useQuery({
    queryKey: ["home-progress-notes", patientId],
    queryFn: () => homeHealthService.listProgressNotes(patientId),
  });
  const add = useMutation({
    mutationFn: () =>
      homeHealthService.addProgressNote({
        patient_id: patientId,
        author_role: role ?? "nurse",
        note_text: text,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["home-progress-notes", patientId] });
      toast.success("Note added", { title: "Home healthcare" });
      setText("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        Progress notes
      </Text>
      {canManage && (
        <Group align="flex-end" gap="sm">
          <Select
            label="Author"
            data={["nurse", "physician"].map((v) => ({ value: v, label: v }))}
            value={role}
            onChange={setRole}
            w={140}
          />
          <Textarea
            label="Note"
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            style={{ flex: 1 }}
            minRows={1}
          />
          <Button onClick={() => add.mutate()} loading={add.isPending} disabled={!text.trim()}>
            Add
          </Button>
        </Group>
      )}
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          No progress notes.
        </Text>
      ) : (
        data.map((n) => (
          <Stack key={n.id} gap={0}>
            <Group gap={6}>
              <Badge tone="neutral" size="xs">
                {n.author_role}
              </Badge>
              <Text size="xs" c="dimmed">
                {new Date(n.note_date).toLocaleDateString()}
              </Text>
            </Group>
            <Text size="sm">{n.note_text}</Text>
          </Stack>
        ))
      )}
    </Stack>
  );
}

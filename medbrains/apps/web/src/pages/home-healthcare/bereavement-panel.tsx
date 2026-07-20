// Home-healthcare BereavementPanel — split from home-healthcare.tsx (pure move).

import { Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { BadgeTone } from "@/components/ui";
import { Badge, Button, toast } from "@/components/ui";
import { homeHealthService } from "@/services/homeHealth.service";

const BEREAVEMENT_TYPES = ["call", "visit", "support_group", "letter", "other"];

export function BereavementPanel({
  patientId,
  canManage,
}: {
  patientId: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [contact, setContact] = useState("");
  const [rel, setRel] = useState("");
  const [type, setType] = useState<string | null>("call");
  const [date, setDate] = useState<string | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["bereavement", patientId],
    queryFn: () => homeHealthService.listBereavement(patientId),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["bereavement", patientId] });
  };
  const schedule = useMutation({
    mutationFn: () =>
      homeHealthService.scheduleBereavement({
        patient_id: patientId,
        family_contact_name: contact,
        relationship: rel || undefined,
        contact_type: type ?? "call",
        scheduled_date: date ?? "",
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Follow-up scheduled", { title: "Home healthcare" });
      setContact("");
      setRel("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  const update = useMutation({
    mutationFn: (v: { id: string; status: string }) =>
      homeHealthService.updateBereavement(v.id, { status: v.status }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  const berTone = (s: string): BadgeTone =>
    s === "completed" ? "success" : s === "declined" ? "neutral" : "info";

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        Bereavement support
      </Text>
      {canManage && (
        <>
          <Group grow>
            <TextInput
              label="Family contact"
              value={contact}
              onChange={(e) => setContact(e.currentTarget.value)}
            />
            <TextInput
              label="Relationship"
              value={rel}
              onChange={(e) => setRel(e.currentTarget.value)}
            />
          </Group>
          <Group grow>
            <Select
              label="Contact type"
              data={BEREAVEMENT_TYPES.map((t) => ({ value: t, label: t.replace("_", " ") }))}
              value={type}
              onChange={setType}
            />
            <DateInput label="Scheduled date" value={date} onChange={setDate} />
          </Group>
          <Button
            onClick={() => schedule.mutate()}
            loading={schedule.isPending}
            disabled={!contact.trim() || !date}
          >
            Schedule follow-up
          </Button>
        </>
      )}
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          No bereavement follow-ups.
        </Text>
      ) : (
        data.map((b) => (
          <Group key={b.id} justify="space-between">
            <Group gap={6}>
              <Badge tone={berTone(b.status)} size="xs">
                {b.contact_type.replace("_", " ")}
              </Badge>
              <Text size="sm">
                {b.family_contact_name}
                {b.relationship ? ` (${b.relationship})` : ""}
              </Text>
              <Text size="xs" c="dimmed">
                {new Date(b.scheduled_date).toLocaleDateString()}
              </Text>
            </Group>
            {canManage && b.status === "scheduled" && (
              <Group gap="xs">
                <Button
                  size="xs"
                  tone="primary"
                  onClick={() => update.mutate({ id: b.id, status: "completed" })}
                >
                  Done
                </Button>
                <Button
                  size="xs"
                  tone="ghost"
                  onClick={() => update.mutate({ id: b.id, status: "declined" })}
                >
                  Declined
                </Button>
              </Group>
            )}
          </Group>
        ))
      )}
    </Stack>
  );
}

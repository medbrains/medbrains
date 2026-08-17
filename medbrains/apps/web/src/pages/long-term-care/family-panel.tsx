// Long-term-care FamilyPanel — split from long-term-care.tsx (pure move).

import { Group, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, toast } from "@/components/ui";
import { longTermCareService } from "@/services/longTermCare.service";

const MSG_TYPES = ["care_update", "visit_request", "general"];

export function FamilyPanel({ patientId }: { patientId: string }) {
  const canView = useHasPermission(P.SPECIALTY.LTC.FAMILY_LIST);
  const canCreate = useHasPermission(P.SPECIALTY.LTC.FAMILY_CREATE);
  const canUpdate = useHasPermission(P.SPECIALTY.LTC.FAMILY_UPDATE);
  const qc = useQueryClient();
  const [type, setType] = useState<string | null>("care_update");
  const [direction, setDirection] = useState<string | null>("to_family");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [famContact, setFamContact] = useState("");

  const { data = [] } = useQuery({
    queryKey: ["family-messages", patientId],
    queryFn: () => longTermCareService.listFamilyMessages(patientId),
    enabled: canView,
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["family-messages", patientId] });
  };
  const post = useMutation({
    mutationFn: () =>
      longTermCareService.postFamilyMessage({
        patient_id: patientId,
        direction: direction ?? "to_family",
        message_type: type ?? "care_update",
        subject: subject || undefined,
        body,
        family_contact: famContact || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Message posted", { title: "Long-term care" });
      setSubject("");
      setBody("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });
  const update = useMutation({
    mutationFn: (v: { id: string; status: string }) =>
      longTermCareService.updateFamilyMessage(v.id, { status: v.status }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  return (
    <Stack gap="sm">
      <Text fw={600} size="sm">
        Family communication
      </Text>
      {canCreate && (
        <>
          <Group grow>
            <Select
              label="Direction"
              data={[
                { value: "to_family", label: "To family" },
                { value: "from_family", label: "From family" },
              ]}
              value={direction}
              onChange={setDirection}
            />
            <Select
              label="Type"
              data={MSG_TYPES.map((t) => ({ value: t, label: t.replace("_", " ") }))}
              value={type}
              onChange={setType}
            />
            <TextInput
              label="Family contact"
              value={famContact}
              onChange={(e) => setFamContact(e.currentTarget.value)}
            />
          </Group>
          <TextInput
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.currentTarget.value)}
          />
          <Textarea
            label="Message"
            value={body}
            onChange={(e) => setBody(e.currentTarget.value)}
            minRows={2}
          />
          <Button onClick={() => post.mutate()} loading={post.isPending} disabled={!body.trim()}>
            Post message
          </Button>
        </>
      )}
      {data.length === 0 ? (
        <Text size="sm" c="dimmed">
          No family messages.
        </Text>
      ) : (
        data.map((m) => (
          <Group key={m.id} justify="space-between">
            <Stack gap={0}>
              <Group gap={6}>
                <Badge tone={m.direction === "to_family" ? "info" : "warning"} size="xs">
                  {m.direction === "to_family" ? "to family" : "from family"}
                </Badge>
                <Badge tone="neutral" size="xs">
                  {m.message_type.replace("_", " ")}
                </Badge>
                <Text size="sm">{m.subject || m.body}</Text>
              </Group>
              <Text size="xs" c="dimmed">
                {new Date(m.created_at).toLocaleString()}
              </Text>
            </Stack>
            {canUpdate && m.status !== "actioned" && (
              <Button
                size="xs"
                tone="ghost"
                onClick={() => update.mutate({ id: m.id, status: "actioned" })}
              >
                Actioned
              </Button>
            )}
          </Group>
        ))
      )}
    </Stack>
  );
}

// One incident's breach register: the statutory clocks, the assessment that
// starts them, the notices that stop them, and the timeline of everything done.
// Readable by every incident-list holder; editing needs `security.breach.manage`.

import { Divider, Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { SecurityIncident } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Modal, TextArea, toast } from "@/components/ui";
import { securityService } from "@/services/security.service";
import { BreachAssessmentForm } from "./breach-assessment-form";
import { incidentClocks } from "./breach-clock";
import { BreachNotices } from "./breach-notices";

function Timeline({ incidentId, canNote }: { incidentId: string; canNote: boolean }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const updates = useQuery({
    queryKey: ["sec-incident-updates", incidentId],
    queryFn: () => securityService.getIncidentUpdates(incidentId),
  });
  const add = useMutation({
    mutationFn: () => securityService.addIncidentUpdate(incidentId, { description: note }),
    onSuccess: () => {
      setNote("");
      void qc.invalidateQueries({ queryKey: ["sec-incident-updates", incidentId] });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Note not added" }),
  });
  return (
    <Stack gap="xs">
      <Text fw={600}>Timeline</Text>
      {canNote && (
        <Stack gap="xs">
          <TextArea
            label="Add a note"
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
            autosize
            minRows={1}
          />
          <Group justify="flex-end">
            <Button onClick={() => add.mutate()} loading={add.isPending} disabled={!note.trim()}>
              Add note
            </Button>
          </Group>
        </Stack>
      )}
      {updates.isError ? (
        <Alert tone="danger" title="The timeline could not be loaded">
          {updates.error.message}
        </Alert>
      ) : (
        (updates.data ?? []).map((u) => (
          <Stack key={u.id} gap={0}>
            <Text size="xs" c="dimmed" ff="monospace">
              {new Date(u.created_at).toLocaleString()} · {u.updated_by_name ?? "System"} ·{" "}
              {u.update_type.replace(/_/g, " ")}
            </Text>
            <Text size="sm">{u.description}</Text>
          </Stack>
        ))
      )}
    </Stack>
  );
}

export function BreachDrawer({
  incident,
  onClose,
}: {
  incident: SecurityIncident | null;
  onClose: () => void;
}) {
  const canManage = useHasPermission(P.SECURITY.BREACH_MANAGE);
  const canNote = useHasPermission(P.SECURITY.INCIDENTS_UPDATE);
  const clocks = incident ? incidentClocks(incident, Date.now()) : [];
  return (
    <Modal
      opened={incident !== null}
      onClose={onClose}
      title={incident ? `Breach register — ${incident.incident_number}` : "Breach register"}
      fullScreen
    >
      {incident && (
        <Stack gap="md">
          <Group gap="xs">
            {clocks.length === 0 ? (
              <Text size="sm" c="dimmed">
                No reporting clock is running.
              </Text>
            ) : (
              clocks.map((c) => (
                <Badge key={c.label} tone={c.tone} size="lg">
                  {c.label}: {c.text}
                </Badge>
              ))
            )}
          </Group>
          {canManage && <BreachAssessmentForm key={incident.id} incident={incident} />}
          <Divider />
          <BreachNotices incident={incident} canManage={canManage} />
          <Divider />
          <Timeline incidentId={incident.id} canNote={canNote} />
        </Stack>
      )}
    </Modal>
  );
}

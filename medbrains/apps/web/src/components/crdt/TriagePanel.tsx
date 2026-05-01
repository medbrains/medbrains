/**
 * TriagePanel — ED triage log, REST↔CRDT.
 *
 * ESI levels: 1 (resuscitation) → 5 (non-urgent). Color follows the
 * NABH/IPSG triage convention (1=red, 2=orange, 3=yellow, 4=green,
 * 5=blue). Append-only — once recorded a triage decision can't be
 * mutated, only superseded by a later entry on the same visit.
 */

import { useState } from "react";
import { Badge, Button, Card, Group, Select, Stack, Text, Textarea, Timeline } from "@mantine/core";
import { useTriageSource, type TriageEntryInput } from "../../hooks/useTriageSource";

interface TriagePanelProps {
  visitId: string;
  canAppend?: boolean;
}

const esiColor: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "red",
  2: "orange",
  3: "yellow",
  4: "green",
  5: "blue",
};

const esiLabel: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "ESI-1 Resuscitation",
  2: "ESI-2 Emergent",
  3: "ESI-3 Urgent",
  4: "ESI-4 Less Urgent",
  5: "ESI-5 Non-Urgent",
};

export function TriagePanel({ visitId, canAppend = true }: TriagePanelProps) {
  const { entries, append, status, ready, unsyncedOps } = useTriageSource(visitId);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [observation, setObservation] = useState("");
  const [esiLevel, setEsiLevel] = useState<TriageEntryInput["esi_level"]>(3);

  const onAdd = () => {
    const cc = chiefComplaint.trim();
    if (!cc) return;
    append({ esi_level: esiLevel, chief_complaint: cc, observation: observation.trim() });
    setChiefComplaint("");
    setObservation("");
  };

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text fw={600}>Triage Log</Text>
        <Group gap="xs">
          <Badge variant="light" size="sm" color={statusColor(status)}>{status}</Badge>
          {unsyncedOps > 0 && (
            <Badge variant="filled" size="sm" color="orange">{unsyncedOps} unsynced</Badge>
          )}
        </Group>
      </Group>

      {canAppend && (
        <Card withBorder padding="sm">
          <Stack gap="xs">
            <Group gap="xs">
              <Select
                size="xs"
                value={String(esiLevel)}
                onChange={(v) => v && setEsiLevel(Number(v) as TriageEntryInput["esi_level"])}
                data={(Object.keys(esiLabel) as Array<`${1 | 2 | 3 | 4 | 5}`>).map((k) => ({
                  value: k,
                  label: esiLabel[Number(k) as 1 | 2 | 3 | 4 | 5],
                }))}
                w={200}
              />
              <Textarea
                placeholder="Chief complaint"
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.currentTarget.value)}
                autosize
                minRows={1}
                maxRows={2}
                style={{ flex: 1 }}
              />
            </Group>
            <Group gap="xs">
              <Textarea
                placeholder="Observation / vitals snippet"
                value={observation}
                onChange={(e) => setObservation(e.currentTarget.value)}
                autosize
                minRows={1}
                maxRows={3}
                style={{ flex: 1 }}
              />
              <Button size="xs" onClick={onAdd} disabled={!ready || !chiefComplaint.trim()}>
                Record
              </Button>
            </Group>
          </Stack>
        </Card>
      )}

      {entries.length === 0 ? (
        <Text size="sm" c="dimmed">No triage entries for this visit.</Text>
      ) : (
        <Timeline bulletSize={22} lineWidth={2}>
          {entries.map((e, i) => (
            <Timeline.Item
              key={`${e.ts}-${i}`}
              bullet={<Badge size="xs" color={esiColor[e.esi_level]}>{e.esi_level}</Badge>}
              title={
                <Group gap="xs">
                  <Text size="sm" fw={600}>{esiLabel[e.esi_level]}</Text>
                  <Text size="xs" c="dimmed">{new Date(e.ts).toLocaleString()} — {e.author}</Text>
                </Group>
              }
            >
              <Text size="sm" fw={500}>{e.chief_complaint}</Text>
              {e.observation && <Text size="sm" c="dimmed">{e.observation}</Text>}
            </Timeline.Item>
          ))}
        </Timeline>
      )}
    </Stack>
  );
}

function statusColor(status: string) {
  if (status === "online" || status === "synced") return "green";
  if (status === "loading" || status === "connecting") return "gray";
  if (status === "error" || status === "disconnected") return "red";
  return "blue";
}

/**
 * OfflineTriageObservations — fourth T2 example.
 *
 * Triage observations recorded at ED arrival: chief complaint,
 * vitals snapshot, ESI level, observation notes. Append-only,
 * timestamped, never edited after-the-fact (audit trail
 * requirement — triage clinicians can ADD a follow-up but never
 * mutate a prior entry).
 *
 * This is structurally near-identical to OfflineVitalsCard +
 * OfflineHandoffCard. The shape is:
 *   - useCrdtDoc(`triage/${visitId}`)
 *   - getList("entries"), append-only
 *   - render newest-first
 *   - SyncBadge for status
 *
 * After this one, we have THREE T2-list components doing the same
 * boilerplate — extract `useAppendOnlyCrdtList<T>` next.
 */

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Group,
  Select,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconCheck,
  IconCloud,
  IconCloudOff,
  IconStethoscope,
} from "@tabler/icons-react";
import { useCrdtDoc, type CrdtConnectionStatus } from "@medbrains/crdt";

interface OfflineTriageObservationsProps {
  visitId: string;
  tenantId: string;
  deviceId: string;
  edgeUrl: string;
  authorName: string;
}

interface TriageEntry {
  ts: number;
  author: string;
  esi_level: 1 | 2 | 3 | 4 | 5;
  chief_complaint: string;
  observation: string;
}

const ESI_COLORS: Record<TriageEntry["esi_level"], string> = {
  1: "red", // immediate
  2: "orange", // emergent
  3: "yellow", // urgent
  4: "blue", // less urgent
  5: "gray", // non-urgent
};

const ESI_LABELS: Record<TriageEntry["esi_level"], string> = {
  1: "ESI 1 — Immediate",
  2: "ESI 2 — Emergent",
  3: "ESI 3 — Urgent",
  4: "ESI 4 — Less urgent",
  5: "ESI 5 — Non-urgent",
};

const SyncBadge = ({
  status,
  unsynced,
}: {
  status: CrdtConnectionStatus;
  unsynced: number;
}) => {
  switch (status) {
    case "online":
      return unsynced > 0 ? (
        <Badge color="orange" leftSection={<IconCloudOff size={12} />}>
          {unsynced} pending
        </Badge>
      ) : (
        <Badge color="teal" leftSection={<IconCheck size={12} />}>
          Synced
        </Badge>
      );
    case "offline":
      return (
        <Badge color="orange" leftSection={<IconCloudOff size={12} />}>
          Offline {unsynced > 0 ? `· ${unsynced} queued` : ""}
        </Badge>
      );
    case "syncing":
      return (
        <Badge color="blue" leftSection={<IconStethoscope size={12} />}>
          Syncing…
        </Badge>
      );
    case "error":
      return (
        <Badge color="red" leftSection={<IconAlertCircle size={12} />}>
          Edge error
        </Badge>
      );
    default:
      return (
        <Badge color="gray" leftSection={<IconCloud size={12} />}>
          Connecting
        </Badge>
      );
  }
};

export function OfflineTriageObservations({
  visitId,
  tenantId,
  deviceId,
  edgeUrl,
  authorName,
}: OfflineTriageObservationsProps) {
  const { doc, ready, status, unsyncedOps } = useCrdtDoc(`triage/${visitId}`, {
    edgeUrl,
    tenantId,
    deviceId,
  });

  const [esiLevel, setEsiLevel] = useState<TriageEntry["esi_level"]>(3);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [observation, setObservation] = useState("");

  const entries = useMemo(() => {
    if (!ready) return [];
    const list = doc.getList("entries");
    const out: TriageEntry[] = [];
    for (let i = 0; i < list.length; i++) {
      const v = list.get(i);
      if (v && typeof v === "object") out.push(v as TriageEntry);
    }
    return out.sort((a, b) => b.ts - a.ts);
  }, [doc, ready, unsyncedOps, status]);

  const append = () => {
    if (!ready || !chiefComplaint.trim()) return;
    doc.getList("entries").insert(doc.getList("entries").length, {
      ts: Date.now(),
      author: authorName,
      esi_level: esiLevel,
      chief_complaint: chiefComplaint.trim(),
      observation: observation.trim(),
    });
    setChiefComplaint("");
    setObservation("");
  };

  if (!ready) {
    return <Text c="dimmed">Loading offline-capable triage log…</Text>;
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Triage observations
        </Text>
        <SyncBadge status={status} unsynced={unsyncedOps} />
      </Group>

      <Stack gap="xs">
        <Select
          label="ESI level"
          value={String(esiLevel)}
          onChange={(v) =>
            v && setEsiLevel(Number(v) as TriageEntry["esi_level"])
          }
          data={[1, 2, 3, 4, 5].map((n) => ({
            value: String(n),
            label: ESI_LABELS[n as TriageEntry["esi_level"]],
          }))}
        />
        <Textarea
          label="Chief complaint"
          placeholder="e.g. chest pain radiating to left arm, 2 hours"
          minRows={2}
          value={chiefComplaint}
          onChange={(e) => setChiefComplaint(e.currentTarget.value)}
        />
        <Textarea
          label="Observation"
          placeholder="Initial vitals + visual assessment"
          minRows={2}
          value={observation}
          onChange={(e) => setObservation(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button onClick={append} disabled={!chiefComplaint.trim()}>
            Add triage entry
          </Button>
        </Group>
      </Stack>

      <Stack gap="xs">
        {entries.map((e, i) => (
          <Group key={`${e.ts}-${i}`} gap="xs" align="flex-start">
            <Badge color={ESI_COLORS[e.esi_level]} size="sm">
              ESI {e.esi_level}
            </Badge>
            <Stack gap={2} style={{ flex: 1 }}>
              <Text size="sm" fw={500}>
                {e.chief_complaint}
              </Text>
              {e.observation && (
                <Text size="xs" c="dimmed">
                  {e.observation}
                </Text>
              )}
              <Text size="xs" c="dimmed">
                {new Date(e.ts).toLocaleString()} · {e.author}
              </Text>
            </Stack>
          </Group>
        ))}
        {entries.length === 0 && (
          <Text size="sm" c="dimmed">
            No triage entries yet for this visit.
          </Text>
        )}
      </Stack>

      <Text size="xs" c="dimmed" ff="monospace">
        doc: triage/{visitId} · {entries.length} entr
        {entries.length === 1 ? "y" : "ies"}
      </Text>
    </Stack>
  );
}

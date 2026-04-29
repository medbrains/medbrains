/**
 * OfflineVitalsCard — proof-of-concept for the @medbrains/crdt hook.
 *
 * Renders a vitals capture card backed by a Loro CRDT doc instead of
 * the existing REST flow. Two browser tabs open on the same encounter
 * converge after a network blip; readings entered offline survive a
 * page reload and drain when the bridge is reachable again.
 *
 * Tier classification: vital_signs is **T2** (append-only event
 * stream — no edits after-the-fact). Last-write-wins is fine because
 * concurrent writers are recording at different timestamps.
 *
 * NOT a replacement for VitalsRecorder.tsx (the REST-flow component
 * existing pages already use). This is a sibling that pages can opt
 * into for offline-tolerant clinics. Default deployments stay on the
 * REST flow until a hospital opts into offline-first via tenant
 * settings.
 */

import { useMemo } from "react";
import { Badge, Button, Group, NumberInput, Stack, Text } from "@mantine/core";
import { IconCloud, IconCloudOff, IconAlertCircle, IconCheck } from "@tabler/icons-react";
import { useCrdtDoc, type CrdtConnectionStatus } from "@medbrains/crdt";

interface OfflineVitalsCardProps {
  encounterId: string;
  tenantId: string;
  deviceId: string;
  edgeUrl: string;
}

interface VitalReading {
  ts: number;
  hr?: number;
  spo2?: number;
  temp?: number;
  recordedBy: string;
}

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
        <Badge color="blue" leftSection={<IconCloud size={12} />}>
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

export function OfflineVitalsCard({
  encounterId,
  tenantId,
  deviceId,
  edgeUrl,
}: OfflineVitalsCardProps) {
  const { doc, ready, status, unsyncedOps } = useCrdtDoc(`vitals/${encounterId}`, {
    edgeUrl,
    tenantId,
    deviceId,
  });

  const readings = useMemo(() => {
    if (!ready) return [];
    const list = doc.getList("readings");
    const out: VitalReading[] = [];
    for (let i = 0; i < list.length; i++) {
      const v = list.get(i);
      if (v && typeof v === "object") {
        out.push(v as VitalReading);
      }
    }
    return out;
  }, [doc, ready, unsyncedOps, status]);

  const recordReading = (partial: Partial<VitalReading>) => {
    if (!ready) return;
    const list = doc.getList("readings");
    const reading: VitalReading = {
      ts: Date.now(),
      recordedBy: deviceId,
      ...partial,
    };
    list.insert(list.length, reading);
  };

  if (!ready) {
    return <Text c="dimmed">Loading offline-capable vitals…</Text>;
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Vitals (offline-tolerant)
        </Text>
        <SyncBadge status={status} unsynced={unsyncedOps} />
      </Group>

      <Group>
        <NumberInput
          label="HR (bpm)"
          min={0}
          max={300}
          onChange={(v) =>
            typeof v === "number" && recordReading({ hr: v })
          }
        />
        <NumberInput
          label="SpO₂ (%)"
          min={0}
          max={100}
          onChange={(v) =>
            typeof v === "number" && recordReading({ spo2: v })
          }
        />
        <NumberInput
          label="Temp (°C)"
          decimalScale={1}
          step={0.1}
          min={30}
          max={45}
          onChange={(v) =>
            typeof v === "number" && recordReading({ temp: v })
          }
        />
      </Group>

      <Stack gap="xs">
        <Text size="xs" c="dimmed">
          {readings.length} reading{readings.length === 1 ? "" : "s"} in this
          encounter (CRDT doc <code>vitals/{encounterId}</code>)
        </Text>
        {readings.slice(-5).map((r, i) => (
          <Text key={i} size="sm" ff="monospace">
            {new Date(r.ts).toLocaleTimeString()} · HR={r.hr ?? "—"} · SpO₂=
            {r.spo2 ?? "—"} · Temp={r.temp ?? "—"} · by {r.recordedBy.slice(0, 8)}
          </Text>
        ))}
      </Stack>

      <Button
        variant="subtle"
        size="xs"
        onClick={() => {
          // Force a fresh reading with current state for demo
          recordReading({ hr: Math.floor(60 + Math.random() * 40) });
        }}
      >
        Demo: insert random HR
      </Button>
    </Stack>
  );
}

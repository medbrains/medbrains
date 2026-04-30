/**
 * Doctor → queue entry detail. Drives the call/start/complete state
 * machine for a single token. Permission-gated buttons; offline
 * writes go through the AuthzCache (online-required for state
 * transitions per the cache policy).
 */

import { useState } from "react";
import type { ReactNode } from "react";
import { View } from "react-native";
import { Button, Text } from "react-native-paper";
import { Badge, Card, COLORS, SPACING } from "@medbrains/ui-mobile";
import { P } from "@medbrains/types";
import {
  callQueue,
  completeQueueEntry,
  startConsultation,
} from "../../api/opd.js";
import type { QueueEntry } from "../../api/opd.js";
import { useHasPermission } from "../../lib/permissions.js";
import { useModuleRouter } from "../../components/module-router.js";
import { ScreenHeader } from "../../components/screen-header.js";

export interface QueueDetailScreenProps {
  entry: QueueEntry;
}

export function QueueDetailScreen({ entry: initial }: QueueDetailScreenProps): ReactNode {
  const router = useModuleRouter();
  const [entry, setEntry] = useState<QueueEntry>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canCall = useHasPermission(P.OPD.TOKEN_MANAGE);
  const canConsult = useHasPermission(P.OPD.VISIT_CREATE);
  const canComplete = useHasPermission(P.OPD.VISIT_UPDATE);

  const run = async (fn: (id: string) => Promise<QueueEntry>) => {
    setBusy(true);
    setError(null);
    try {
      const next = await fn(entry.id);
      setEntry(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="QUEUE"
        title={entry.patient_name}
        description={`UHID ${entry.uhid} · Token ${entry.token_number}`}
      />
      <View style={{ padding: SPACING.md }}>
        <Card eyebrow="STATUS" title={entry.status}>
          <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
            Last action: {entry.called_at ?? entry.queue_date}
          </Text>
          <View style={{ flexDirection: "row", gap: SPACING.xs, marginTop: SPACING.sm }}>
            <Badge label={`token ${entry.token_number}`} monospace />
            <Badge label={entry.queue_date} tone="info" monospace />
          </View>
        </Card>

        {error && (
          <Text
            variant="bodySmall"
            style={{ color: COLORS.red, marginTop: SPACING.sm }}
          >
            {error}
          </Text>
        )}

        <View style={{ gap: SPACING.sm, marginTop: SPACING.md }}>
          {entry.status === "waiting" && canCall && (
            <Button
              mode="contained"
              loading={busy}
              disabled={busy}
              onPress={() => run(callQueue)}
            >
              Call patient
            </Button>
          )}
          {entry.status === "called" && canConsult && (
            <Button
              mode="contained"
              loading={busy}
              disabled={busy}
              onPress={() => run(startConsultation)}
            >
              Start consultation
            </Button>
          )}
          {entry.status === "in_consultation" && canComplete && (
            <Button
              mode="contained"
              loading={busy}
              disabled={busy}
              onPress={() => run(completeQueueEntry)}
            >
              Mark complete
            </Button>
          )}
          <Button mode="outlined" onPress={router.pop} disabled={busy}>
            Back to queue
          </Button>
        </View>
      </View>
    </View>
  );
}

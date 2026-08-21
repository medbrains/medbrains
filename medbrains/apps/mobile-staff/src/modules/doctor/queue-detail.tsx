/**
 * Doctor → queue entry detail. Drives the call/serve/complete state machine for
 * a single token on the unified queue — the same row the waiting-room board is
 * showing, so calling the patient here moves the number on the wall.
 *
 * All three transitions are one act on one queue and take one permission,
 * `opd.token.manage`, which is what the server checks. The buttons used to be
 * gated on `opd.visit.create` and `opd.visit.update`: those are the clinical
 * record, not the queue position, and a control gated on a permission its call
 * does not require promises what the server will refuse.
 *
 * Permission-gated buttons; offline writes go through the AuthzCache
 * (online-required for state transitions per the cache policy).
 */

import { P } from "@medbrains/types";
import { Badge, Card, COLORS, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useState } from "react";
import { View } from "react-native";
import { Button, Text } from "react-native-paper";
import type { ModuleToken, WorklistToken } from "../../api/queue.js";
import { callToken, completeToken, serveToken } from "../../api/queue.js";
import { useModuleRouter } from "../../components/module-router.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { useHasPermission } from "../../lib/permissions.js";

export interface QueueDetailScreenProps {
  entry: WorklistToken;
}

export function QueueDetailScreen({ entry: initial }: QueueDetailScreenProps): ReactNode {
  const router = useModuleRouter();
  const [entry, setEntry] = useState<WorklistToken>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One permission for all three, because the server checks one permission for
  // all three.
  const canWorkQueue = useHasPermission(P.OPD.TOKEN_MANAGE);

  const run = async (fn: (id: string) => Promise<ModuleToken>) => {
    setBusy(true);
    setError(null);
    try {
      const next = await fn(entry.id);
      setEntry((current) => ({ ...current, ...next }));
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
        title={entry.patient_name ?? "Unnamed patient"}
        description={`UHID ${entry.uhid ?? "—"} · Token ${entry.number}`}
      />
      <View style={{ padding: SPACING.md }}>
        <Card eyebrow="STATUS" title={entry.status}>
          <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
            Last action: {entry.called_at ?? entry.created_at}
          </Text>
          <View style={{ flexDirection: "row", gap: SPACING.xs, marginTop: SPACING.sm }}>
            <Badge label={`token ${entry.number}`} monospace />
            <Badge label={entry.priority} tone="info" monospace />
          </View>
        </Card>

        {error && (
          <Text variant="bodySmall" style={{ color: COLORS.red, marginTop: SPACING.sm }}>
            {error}
          </Text>
        )}

        <View style={{ gap: SPACING.sm, marginTop: SPACING.md }}>
          {entry.status === "waiting" && canWorkQueue && (
            <Button
              testID="queue-call-patient"
              mode="contained"
              loading={busy}
              disabled={busy}
              onPress={() => run(callToken)}
            >
              Call patient
            </Button>
          )}
          {entry.status === "called" && canWorkQueue && (
            <Button
              testID="queue-patient-is-in"
              mode="contained"
              loading={busy}
              disabled={busy}
              onPress={() => run(serveToken)}
            >
              Patient is in
            </Button>
          )}
          {entry.status === "serving" && canWorkQueue && (
            <Button
              mode="contained"
              loading={busy}
              disabled={busy}
              onPress={() => run(completeToken)}
              testID="queue-mark-complete"
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

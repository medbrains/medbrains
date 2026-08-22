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
import { callToken, completeToken, noShowToken, serveToken } from "../../api/queue.js";
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
  const canRecordConsultation = useHasPermission(P.OPD.VISIT_UPDATE);

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
        testID="screen-queue-detail"
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
          {entry.status === "called" && canWorkQueue && (
            <>
              {/*
                Recall is the same call again: it restamps `called_at`, which is
                what the boards sort and announce on, so the number goes back to
                the top of the display for somebody who missed it the first
                time. There is no separate endpoint and there should not be —
                a recall IS a call.
              */}
              <Button
                testID="queue-recall-patient"
                accessibilityLabel="Call this token again"
                mode="contained-tonal"
                loading={busy}
                disabled={busy}
                onPress={() => run(callToken)}
              >
                Recall
              </Button>
              {/*
                Marking a no-show had no control on any surface, so the boards'
                missed lane — which exists, and which the OPD board renders —
                could never fill. The patient who stepped out came back to a
                screen that had forgotten them and no way for the desk to say
                what happened.
              */}
              <Button
                testID="queue-no-show"
                accessibilityLabel="Mark this patient as not present"
                mode="outlined"
                loading={busy}
                disabled={busy}
                onPress={() => run(noShowToken)}
              >
                No-show
              </Button>
            </>
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
          {/*
            The clinical record, which is what the queue exists to reach. It is
            deliberately not gated on the queue permission: writing a note and
            moving a token are different acts, and this one takes
            opd.visit.update -- the same code the server checks on the
            consultation endpoint. A control gated on anything else would
            promise what the server refuses.
          */}
          {canRecordConsultation && (
            <Button
              testID="queue-open-consultation"
              accessibilityLabel="Open the consultation for this patient"
              mode="contained-tonal"
              disabled={busy}
              onPress={() => router.push("consultation", entry)}
            >
              Consultation
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

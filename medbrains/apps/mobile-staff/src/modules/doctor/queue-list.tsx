/**
 * Doctor → OPD queue list. Fetches today's queue and lets the user
 * tap into a row for the consultation detail.
 *
 * Reads the unified `tokens` queue, which is the one the waiting-room board
 * shows. It used to read `opd_queues`, a separate table written by the same
 * check-in and advanced by nobody else — so the doctor and the board were
 * working different days.
 */

import { P } from "@medbrains/types";
import { COLORS, EcgLoader, Empty, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, HelperText, Snackbar, Text } from "react-native-paper";
import type { WorklistToken } from "../../api/queue.js";
import { callNextInQueue, listWorklist } from "../../api/queue.js";
import { EntityRow } from "../../components/entity-row.js";
import { useModuleRouter } from "../../components/module-router.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { useHasPermission } from "../../lib/permissions.js";
import { useFetch } from "../../lib/use-fetch.js";

const STATUS_TONE: Record<string, "info" | "warn" | "success" | "neutral"> = {
  waiting: "warn",
  called: "info",
  // The unified queue's word for what opd_queues called 'in_consultation'.
  serving: "info",
  completed: "success",
  no_show: "neutral",
};

export function QueueListScreen(): ReactNode {
  const router = useModuleRouter();
  const { data, loading, error, refetch } = useFetch(() => listWorklist({ module: "opd" }));
  const canWorkQueue = useHasPermission(P.OPD.TOKEN_MANAGE);
  const [calling, setCalling] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const waiting = data?.filter((token) => token.status === "waiting").length ?? 0;

  /**
   * The doctor's actual first act of every consultation, which until now lived
   * only on the reception console — a doctor had to open a row and call that
   * specific patient, which is not the same decision. Calling *next* is the
   * server picking by priority and sequence, so the board and the room agree
   * on who is being seen.
   */
  const callNext = async () => {
    setCalling(true);
    setCallError(null);
    try {
      const called = await callNextInQueue("opd");
      // Null is a real answer, not a failure: the queue is empty. Saying
      // "nobody waiting" beats a silent button.
      setToast(called ? `Called token ${called.number}` : "Nobody is waiting");
      refetch();
    } catch (err) {
      setCallError(err instanceof Error ? err.message : "Could not call the next patient");
    } finally {
      setCalling(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        testID="screen-doctor-queue"
        eyebrow="DOCTOR"
        title="OPD queue"
        description="Today's tokens — tap a row to begin a consult."
      />
      {canWorkQueue && (
        <View style={{ paddingHorizontal: SPACING.md, paddingTop: SPACING.sm }}>
          <Button
            testID="queue-call-next"
            accessibilityLabel={
              waiting > 0
                ? `Call the next patient, ${waiting} waiting`
                : "Call the next patient, nobody waiting"
            }
            mode="contained"
            loading={calling}
            disabled={calling}
            onPress={() => void callNext()}
          >
            {waiting > 0 ? `Call next (${waiting} waiting)` : "Call next"}
          </Button>
          {callError && (
            <HelperText type="error" visible accessibilityRole="alert">
              {callError}
            </HelperText>
          )}
        </View>
      )}
      {loading && (
        <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
          <EcgLoader />
        </View>
      )}
      {!loading && error && (
        <Empty
          title="Couldn't load the queue"
          description={error}
          actionLabel="Retry"
          onAction={refetch}
        />
      )}
      {!loading && !error && (data?.length ?? 0) === 0 && (
        <Empty title="Queue is empty" description="No tokens issued for today yet." />
      )}
      {!loading && !error && data && data.length > 0 && (
        <ScrollView
          testID="doctor-queue-list"
          // Bottom inset, not just padding: without it the last token sits
          // flush against the screen edge, half under the home indicator. The
          // patient who has waited longest is the one hardest to tap.
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: SPACING.xl * 2 }}
        >
          {data.map((entry) => (
            <QueueRow
              key={entry.id}
              entry={entry}
              onPress={() => router.push("queue-detail", entry)}
            />
          ))}
        </ScrollView>
      )}
      <Snackbar
        visible={toast !== null}
        onDismiss={() => setToast(null)}
        duration={2500}
        testID="queue-call-next-toast"
      >
        <Text style={{ color: COLORS.canvas }}>{toast}</Text>
      </Snackbar>
    </View>
  );
}

function QueueRow({ entry, onPress }: { entry: WorklistToken; onPress: () => void }): ReactNode {
  return (
    <View style={{ marginBottom: SPACING.sm }}>
      <EntityRow
        // Keyed by patient, not by position: a queue reorders as it advances,
        // so an index-based id matches a different person a moment later.
        testID={`queue-row-${entry.patient_id ?? entry.id}`}
        title={entry.patient_name ?? "Unnamed patient"}
        subtitle={`UHID ${entry.uhid ?? "—"} \u00b7 TOKEN ${entry.number}`}
        badge={{ label: entry.status, tone: STATUS_TONE[entry.status] ?? "neutral" }}
        onPress={onPress}
      />
    </View>
  );
}

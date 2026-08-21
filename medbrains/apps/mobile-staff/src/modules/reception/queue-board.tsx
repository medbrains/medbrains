/**
 * The OPD queue, worked from the floor.
 *
 * Reception is not always at the desk — someone is walking the waiting area,
 * and the person who notices that token 14 never came back is the one standing
 * in it. Calling the next patient from there saves a walk that, at a busy
 * clinic, is the reason the queue stalls.
 *
 * The call button acts on whoever the rule says is next rather than on a row
 * the user picked, so the queue cannot be jumped by mis-tapping.
 *
 * "Next" is the server's decision, not this screen's. It used to be computed
 * here as the lowest token number still waiting; the unified queue orders by
 * priority weight first, so an elderly or emergency-referral patient is called
 * ahead of a lower number. `call-next` picks under a lock, by the same rule it
 * used to order the list below, so the desk and the board cannot disagree and
 * two people pressing at once cannot call the same patient twice.
 */

import { Badge, COLORS, EcgLoader, Empty, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { Button, HelperText, Text } from "react-native-paper";
import type { WorklistToken } from "../../api/queue.js";
import { callNextInQueue, listWorklist } from "../../api/queue.js";
import { EntityRow } from "../../components/entity-row.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { countQueue, isWaiting, nextToCall } from "../../lib/queue-order.js";
import { useFetch } from "../../lib/use-fetch.js";

const MAX_ROWS = 100;

export function QueueBoardScreen(): ReactNode {
  const { data, loading, error, refetch } = useFetch(() => listWorklist({ module: "opd" }), []);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // Already in call order; re-sorting here is what got the wrong patient called.
  const entries = useMemo(() => (data ?? []).slice(0, MAX_ROWS), [data]);
  const next = useMemo(() => nextToCall(entries), [entries]);
  const counts = useMemo(() => countQueue(entries), [entries]);

  const callNext = useCallback(async () => {
    if (!next) {
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      await callNextInQueue("opd");
      refetch();
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Could not call that token.");
    } finally {
      setBusy(false);
    }
  }, [next, refetch]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        testID="screen-reception-queue"
        eyebrow="RECEPTION"
        title="OPD queue"
        description="Token order. Calling acts on whoever is next."
        trailing={
          counts.waiting > 0 ? <Badge tone="info" label={`${counts.waiting} waiting`} /> : undefined
        }
      />

      {failure && (
        <View style={{ paddingHorizontal: SPACING.md }}>
          <HelperText type="error" visible accessibilityRole="alert">
            {failure}
          </HelperText>
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

      {!loading && !error && entries.length === 0 && (
        <Empty title="No tokens today" description="Nothing has been issued yet." />
      )}

      {!loading && !error && entries.length > 0 && (
        <>
          <View style={{ padding: SPACING.md, gap: SPACING.xs }}>
            <Text variant="labelMedium" style={{ color: COLORS.brandDeep }}>
              {next ? "Next to call" : "Nobody waiting"}
            </Text>
            <Text variant="headlineSmall" style={{ color: COLORS.ink, fontWeight: "700" }}>
              {next
                ? `Token ${next.number} · ${next.patient_name ?? "Unnamed patient"}`
                : "Queue is clear"}
            </Text>
            <Button
              mode="contained"
              onPress={callNext}
              loading={busy}
              // No button when nobody is waiting: pressing it would call nobody.
              disabled={busy || !next}
              testID="reception-call-next"
              accessibilityLabel={
                next ? `Call token ${next.number}` : "Nobody is waiting to be called"
              }
            >
              {busy ? "Calling…" : "Call next"}
            </Button>
          </View>
          <FlatList
            data={entries}
            keyExtractor={(entry) => entry.id}
            renderItem={({ item }) => <QueueRow entry={item} />}
            contentContainerStyle={{ padding: SPACING.md }}
          />
        </>
      )}
    </View>
  );
}

function QueueRow({ entry }: { entry: WorklistToken }): ReactNode {
  const waiting = isWaiting(entry);

  return (
    <View style={{ marginBottom: SPACING.sm }}>
      <EntityRow
        title={`${entry.number} · ${entry.patient_name ?? "Unnamed patient"}`}
        subtitle={`UHID ${entry.uhid}`}
        badge={{
          label: entry.status.replace(/_/g, " "),
          tone: waiting ? "warn" : entry.status === "completed" ? "success" : "info",
        }}
      />
    </View>
  );
}

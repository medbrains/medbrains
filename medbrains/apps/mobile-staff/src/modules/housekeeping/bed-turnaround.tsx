/**
 * Bed turnaround worklist for a housekeeper standing in the room.
 *
 * A bed reads as unavailable until someone records the terminal clean. That
 * record used to require walking to a desktop, so the gap between a room
 * actually being ready and the system saying so was dead time a patient spent
 * waiting in Emergency for a bed that was already made. Marking it here closes
 * that gap to the length of one tap.
 *
 * The list is deliberately only what is still dirty. A housekeeper does not
 * need the day's history on a phone; they need the next room.
 */

import { Badge, COLORS, EcgLoader, Empty, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { Button, HelperText } from "react-native-paper";
import type { TurnaroundRow } from "../../api/housekeeping.js";
import { completeTurnaround, listTurnarounds } from "../../api/housekeeping.js";
import { EntityRow } from "../../components/entity-row.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { isOverdue, minutesWaiting, waitingLabel } from "../../lib/turnaround.js";
import { useFetch } from "../../lib/use-fetch.js";

/** Bounded like every other constrained-surface list in the app. */
const PAGE_SIZE = 50;

export function BedTurnaroundScreen(): ReactNode {
  const { data, loading, error, refetch } = useFetch(listTurnarounds, []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const pending = useMemo(
    () => (data ?? []).filter((row) => !row.cleaning_completed_at).slice(0, PAGE_SIZE),
    [data],
  );

  const complete = useCallback(
    async (row: TurnaroundRow) => {
      setBusyId(row.id);
      setFailure(null);
      try {
        await completeTurnaround(row.id);
        refetch();
      } catch (cause) {
        setFailure(
          cause instanceof Error ? cause.message : "Could not mark the bed ready. Try again.",
        );
      } finally {
        setBusyId(null);
      }
    },
    [refetch],
  );

  const renderItem = useCallback(
    ({ item }: { item: TurnaroundRow }) => (
      <TurnaroundCard row={item} busy={busyId === item.id} onComplete={() => complete(item)} />
    ),
    [busyId, complete],
  );

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="HOUSEKEEPING"
        title="Bed turnaround"
        description="Beds waiting on a terminal clean."
        trailing={
          pending.length > 0 ? <Badge tone="warn" label={`${pending.length}`} /> : undefined
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
          title="Couldn't load the worklist"
          description={error}
          actionLabel="Retry"
          onAction={refetch}
        />
      )}

      {!loading && !error && pending.length === 0 && (
        <Empty title="Every bed is ready" description="Nothing is waiting on a clean." />
      )}

      {!loading && !error && pending.length > 0 && (
        <FlatList
          data={pending}
          keyExtractor={(row) => row.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: SPACING.md }}
        />
      )}
    </View>
  );
}

function TurnaroundCard({
  row,
  busy,
  onComplete,
}: {
  row: TurnaroundRow;
  busy: boolean;
  onComplete: () => void;
}): ReactNode {
  const waiting = minutesWaiting(row);
  const overdue = isOverdue(waiting);

  return (
    <View style={{ marginBottom: SPACING.sm }}>
      <EntityRow
        title={row.location_id ?? "Unassigned bed"}
        subtitle={waitingLabel(waiting)}
        accent={overdue}
        badge={
          overdue
            ? { label: "overdue", tone: "alert" }
            : { label: row.cleaning_started_at ? "in progress" : "waiting", tone: "warn" }
        }
      />
      <Button
        mode="contained"
        onPress={onComplete}
        loading={busy}
        disabled={busy}
        accessibilityLabel={`Mark ${row.location_id ?? "this bed"} ready`}
        style={{ marginTop: SPACING.xs }}
      >
        {busy ? "Marking…" : "Mark ready"}
      </Button>
    </View>
  );
}

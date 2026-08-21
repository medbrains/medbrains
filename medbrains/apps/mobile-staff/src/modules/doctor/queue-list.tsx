/**
 * Doctor → OPD queue list. Fetches today's queue and lets the user
 * tap into a row for the consultation detail.
 *
 * Reads the unified `tokens` queue, which is the one the waiting-room board
 * shows. It used to read `opd_queues`, a separate table written by the same
 * check-in and advanced by nobody else — so the doctor and the board were
 * working different days.
 */

import { COLORS, EcgLoader, Empty, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import type { WorklistToken } from "../../api/queue.js";
import { listWorklist } from "../../api/queue.js";
import { EntityRow } from "../../components/entity-row.js";
import { useModuleRouter } from "../../components/module-router.js";
import { ScreenHeader } from "../../components/screen-header.js";
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

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="DOCTOR"
        title="OPD queue"
        description="Today's tokens — tap a row to begin a consult."
      />
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
        <ScrollView contentContainerStyle={{ padding: SPACING.md }}>
          {data.map((entry) => (
            <QueueRow
              key={entry.id}
              entry={entry}
              onPress={() => router.push("queue-detail", entry)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function QueueRow({ entry, onPress }: { entry: WorklistToken; onPress: () => void }): ReactNode {
  return (
    <View style={{ marginBottom: SPACING.sm }}>
      <EntityRow
        title={entry.patient_name ?? "Unnamed patient"}
        subtitle={`UHID ${entry.uhid ?? "—"} \u00b7 TOKEN ${entry.number}`}
        badge={{ label: entry.status, tone: STATUS_TONE[entry.status] ?? "neutral" }}
        onPress={onPress}
      />
    </View>
  );
}

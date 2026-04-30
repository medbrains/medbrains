/**
 * Doctor → OPD queue list. Fetches today's queue and lets the user
 * tap into a row for the consultation detail.
 */

import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Text } from "react-native-paper";
import { Badge, COLORS, EcgLoader, Empty, SPACING } from "@medbrains/ui-mobile";
import { listOpdQueue } from "../../api/opd.js";
import type { QueueEntry } from "../../api/opd.js";
import { useFetch } from "../../lib/use-fetch.js";
import { useModuleRouter } from "../../components/module-router.js";
import { ScreenHeader } from "../../components/screen-header.js";

const STATUS_TONE: Record<string, "info" | "warn" | "success" | "neutral"> = {
  waiting: "warn",
  called: "info",
  in_consultation: "info",
  completed: "success",
  no_show: "neutral",
};

export function QueueListScreen(): ReactNode {
  const router = useModuleRouter();
  const { data, loading, error, refetch } = useFetch(() => listOpdQueue());

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

function QueueRow({
  entry,
  onPress,
}: {
  entry: QueueEntry;
  onPress: () => void;
}): ReactNode {
  return (
    <View
      onTouchEnd={onPress}
      style={{
        backgroundColor: COLORS.canvas,
        borderWidth: 1,
        borderColor: COLORS.rule,
        padding: SPACING.md,
        borderRadius: 8,
        marginBottom: SPACING.sm,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <View style={{ flex: 1, paddingRight: SPACING.sm }}>
        <Text variant="titleMedium" style={{ color: COLORS.ink, fontWeight: "600" }}>
          {entry.patient_name}
        </Text>
        <Text
          variant="bodySmall"
          style={{
            color: COLORS.brandDeep,
            opacity: 0.7,
            fontFamily: "JetBrainsMono-Regular",
            marginTop: 2,
          }}
        >
          UHID {entry.uhid} · TOKEN {entry.token_number}
        </Text>
      </View>
      <Badge label={entry.status} tone={STATUS_TONE[entry.status] ?? "neutral"} />
    </View>
  );
}

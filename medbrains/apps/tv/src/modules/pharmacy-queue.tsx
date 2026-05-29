/**
 * TV → pharmacy dispensing queue. Tokens called for prescription
 * pickup; ready-for-collection blinks. Deep-link:
 *   medbrains://tv/pharmacy-queue
 */

import type { Module } from "@medbrains/mobile-shell";
import type { PharmacyQueueToken } from "@medbrains/types";
import { COLORS, SPACING } from "@medbrains/ui-mobile";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { TvBoard, TvSummaryRow } from "../components/tv-board.js";
import { tvQueueService } from "../services/tvQueue.service.js";

const REFRESH_INTERVAL_MS = 10_000;
const DISPLAY_TOKEN_LIMIT = 10;

function lastUpdatedLabel(updatedAt: number) {
  if (updatedAt <= 0) return "not synced";
  return new Date(updatedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function statusColor(status: string) {
  switch (status) {
    case "ready":
    case "dispensed":
      return COLORS.emerald;
    case "preparing":
    case "ordered":
    case "dispensing":
      return COLORS.copper;
    case "on_hold":
      return "#f59e0b";
    default:
      return COLORS.tint;
  }
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function PharmacyQueueScreen() {
  const queueQuery = useQuery({
    queryKey: ["tv", "queue", "pharmacy"],
    queryFn: tvQueueService.getPharmacyQueueDisplay,
    refetchInterval: REFRESH_INTERVAL_MS,
  });
  const queue = queueQuery.data;
  const board = useMemo(
    () => ({
      current: queue?.current_token ?? null,
      preparing: queue?.preparing.slice(0, DISPLAY_TOKEN_LIMIT) ?? [],
      ready: queue?.ready_for_pickup.slice(0, DISPLAY_TOKEN_LIMIT) ?? [],
      waiting: queue?.waiting.slice(0, DISPLAY_TOKEN_LIMIT) ?? [],
    }),
    [queue],
  );
  const syncLabel = lastUpdatedLabel(queueQuery.dataUpdatedAt);

  return (
    <TvBoard
      eyebrow="PHARMACY"
      title="Dispensing queue"
      subtitle="Please proceed to the counter when your token shows."
      legend={`Updates every 10 seconds · last sync ${syncLabel} · medbrains://tv/pharmacy-queue`}
      tags={["TV-Pharmacy", "pharmacy", "dispense", "queue"]}
    >
      <TvSummaryRow
        items={[
          { label: "NOW SERVING", value: board.current?.token_number ?? "—" },
          { label: "READY", value: String(queue?.stats.ready_count ?? "—") },
          { label: "WAITING", value: String(queue?.stats.waiting_count ?? "—") },
          { label: "AVG WAIT", value: `${queue?.stats.avg_wait_minutes ?? "—"} min` },
        ]}
      />
      {queueQuery.isLoading ? (
        <View style={styles.centerPanel}>
          <ActivityIndicator size="large" color={COLORS.emerald} />
          <Text style={styles.loadingText}>Loading pharmacy queue...</Text>
        </View>
      ) : queueQuery.isError ? (
        <View style={styles.centerPanel}>
          <Text style={styles.errorTitle}>Pharmacy feed unavailable</Text>
          <Text style={styles.errorText}>
            Check TV pairing, network, and pharmacy queue display permissions.
          </Text>
        </View>
      ) : (
        <View style={styles.boardGrid}>
          <TokenLane
            title="Now serving"
            emptyLabel="No token is currently being dispensed"
            tokens={board.current ? [board.current] : []}
            large
          />
          <TokenLane title="Ready pickup" emptyLabel="No ready tokens" tokens={board.ready} />
          <TokenLane
            title="Preparing"
            emptyLabel="No tokens in preparation"
            tokens={board.preparing}
          />
          <TokenLane title="Waiting" emptyLabel="No prescriptions waiting" tokens={board.waiting} />
        </View>
      )}
    </TvBoard>
  );
}

function TokenLane({
  emptyLabel,
  large = false,
  title,
  tokens,
}: {
  emptyLabel: string;
  large?: boolean;
  title: string;
  tokens: PharmacyQueueToken[];
}) {
  return (
    <View style={[styles.lane, large && styles.primaryLane]}>
      <Text style={styles.laneTitle}>{title}</Text>
      {tokens.length === 0 ? (
        <View style={styles.emptyToken}>
          <Text style={styles.emptyTokenText}>{emptyLabel}</Text>
        </View>
      ) : (
        <View style={styles.tokenGrid}>
          {tokens.map((token) => (
            <View
              key={`${token.token_number}-${token.status}`}
              style={[
                styles.tokenCard,
                large && styles.primaryTokenCard,
                { borderColor: statusColor(token.status) },
              ]}
            >
              <Text style={[styles.tokenNumber, large && styles.primaryTokenNumber]}>
                {token.token_number}
              </Text>
              <View style={styles.tokenMeta}>
                <Text style={styles.tokenStatus}>{statusLabel(token.status)}</Text>
                <Text style={styles.tokenMetaText}>
                  {token.prescription_count} item{token.prescription_count === 1 ? "" : "s"}
                </Text>
                {token.counter !== null && (
                  <Text style={styles.tokenMetaText}>Counter {token.counter}</Text>
                )}
                {token.estimated_wait_minutes !== null && (
                  <Text style={styles.tokenMetaText}>{token.estimated_wait_minutes} min wait</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export const pharmacyQueueModule: Module = {
  id: "pharmacy-queue",
  displayName: "Pharmacy queue",
  icon: () => null,
  requiredPermissions: [],
  navigator: PharmacyQueueScreen,
  appCodes: ["TV-Pharmacy"],
  tags: ["tv", "pharmacy", "dispensing", "queue"],
};

const styles = StyleSheet.create({
  boardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.lg,
  },
  centerPanel: {
    alignItems: "center",
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brandDeep,
    borderRadius: 12,
    borderWidth: 2,
    gap: SPACING.md,
    padding: SPACING.xl,
  },
  emptyToken: {
    alignItems: "center",
    borderColor: COLORS.brandDeep,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: "center",
    minHeight: 150,
    padding: SPACING.lg,
  },
  emptyTokenText: {
    color: COLORS.tint,
    fontSize: 24,
    textAlign: "center",
  },
  errorText: {
    color: COLORS.tint,
    fontSize: 24,
    opacity: 0.82,
    textAlign: "center",
  },
  errorTitle: {
    color: "#fca5a5",
    fontFamily: "Fraunces-Regular",
    fontSize: 42,
  },
  lane: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brandDeep,
    borderRadius: 12,
    borderWidth: 2,
    flex: 1,
    minWidth: 380,
    padding: SPACING.lg,
  },
  laneTitle: {
    color: COLORS.canvas,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 22,
    letterSpacing: 2,
    marginBottom: SPACING.md,
    textTransform: "uppercase",
  },
  loadingText: {
    color: COLORS.canvas,
    fontSize: 28,
  },
  primaryLane: {
    flexBasis: 480,
    flexGrow: 1,
  },
  primaryTokenCard: {
    minHeight: 250,
  },
  primaryTokenNumber: {
    fontSize: 108,
  },
  tokenCard: {
    backgroundColor: COLORS.brandDeep,
    borderRadius: 12,
    borderWidth: 3,
    flexGrow: 1,
    minHeight: 140,
    minWidth: 180,
    padding: SPACING.lg,
  },
  tokenGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
  },
  tokenMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  tokenMetaText: {
    color: COLORS.tint,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 16,
    textTransform: "uppercase",
  },
  tokenNumber: {
    color: COLORS.canvas,
    fontFamily: "Fraunces-Regular",
    fontSize: 58,
  },
  tokenStatus: {
    color: COLORS.emerald,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 18,
    textTransform: "uppercase",
  },
});

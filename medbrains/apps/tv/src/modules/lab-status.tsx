/**
 * TV -> lab collection queue. Token-only sample collection display.
 * Deep-link: medbrains://tv/lab-status
 */

import type { Module } from "@medbrains/mobile-shell";
import { type LabQueueToken, TOKEN_BOARD_SURFACES } from "@medbrains/types";
import { COLORS, SPACING } from "@medbrains/ui-mobile";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { TvBoard, TvSummaryRow } from "../components/tv-board.js";
import { TvFeedStatusBanner, tvLastUpdatedLabel } from "../components/tv-feed-status.js";
import { tvQueueService } from "../services/tvQueue.service.js";

const REFRESH_INTERVAL_MS = 10_000;
const DISPLAY_TOKEN_LIMIT = 10;
const LAB_BOARD = TOKEN_BOARD_SURFACES.lab;

function statusColor(status: string) {
  switch (status) {
    case "collected":
    case "completed":
      return COLORS.emerald;
    case "collection_in_progress":
    case "in_progress":
      return COLORS.copper;
    case "cancelled":
    case "rejected":
      return COLORS.red;
    default:
      return COLORS.tint;
  }
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function LabStatusScreen() {
  const queueQuery = useQuery({
    queryKey: ["tv", "queue", "lab"],
    queryFn: tvQueueService.getLabQueueDisplay,
    refetchInterval: REFRESH_INTERVAL_MS,
  });
  const queue = queueQuery.data;
  const board = useMemo(
    () => ({
      current: queue?.current_tokens.slice(0, DISPLAY_TOKEN_LIMIT) ?? [],
      inProgress: queue?.collection_in_progress.slice(0, DISPLAY_TOKEN_LIMIT) ?? [],
      waiting: queue?.waiting.slice(0, DISPLAY_TOKEN_LIMIT) ?? [],
    }),
    [queue],
  );
  const syncLabel = tvLastUpdatedLabel(queueQuery.dataUpdatedAt);

  return (
    <TvBoard
      eyebrow="LABORATORY"
      title={LAB_BOARD.title}
      subtitle="Please proceed to sample collection when your token shows."
      legend={`Updates every 10 seconds · last sync ${syncLabel} · ${LAB_BOARD.targets.tvDeepLink}`}
      privacyNotice={LAB_BOARD.privacyNotice}
      tags={[...LAB_BOARD.targets.tvAppCodes, "lab", "samples", "queue"]}
    >
      <TvSummaryRow
        items={[
          { label: "NOW", value: board.current[0]?.token_number ?? "—" },
          { label: "WAITING", value: String(queue?.stats.waiting_count ?? "—") },
          { label: "COLLECTED", value: String(queue?.stats.collected_today ?? "—") },
          { label: "AVG WAIT", value: `${queue?.stats.avg_wait_minutes ?? "—"} min` },
        ]}
      />
      <TvFeedStatusBanner
        errorLabel="Lab collection feed is unreachable. Continuing with the last available token state."
        isError={queueQuery.isError}
        lastUpdatedAt={queueQuery.dataUpdatedAt}
        refreshIntervalMs={REFRESH_INTERVAL_MS}
      />
      {queueQuery.isLoading ? (
        <View style={styles.centerPanel}>
          <ActivityIndicator size="large" color={COLORS.emerald} />
          <Text style={styles.loadingText}>Loading lab collection queue...</Text>
        </View>
      ) : queueQuery.isError ? (
        <View style={styles.centerPanel}>
          <Text style={styles.errorTitle}>Lab feed unavailable</Text>
          <Text style={styles.errorText}>Check TV pairing, network, and lab display access.</Text>
        </View>
      ) : (
        <View style={styles.boardGrid}>
          <TokenLane
            title="Collecting now"
            emptyLabel="No token is currently called"
            tokens={board.current}
            large
          />
          <TokenLane
            title="Waiting samples"
            emptyLabel="No sample tokens waiting"
            tokens={board.waiting}
          />
          <TokenLane
            title="In progress"
            emptyLabel="No collections in progress"
            tokens={board.inProgress}
          />
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
  tokens: LabQueueToken[];
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
              key={`${title}-${token.token_number}`}
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
                  {token.test_count} test{token.test_count === 1 ? "" : "s"}
                </Text>
                {token.counter !== null && (
                  <Text style={styles.tokenMetaText}>Counter {token.counter}</Text>
                )}
                {token.is_fasting && <Text style={styles.tokenFlag}>Fasting</Text>}
                {token.is_pediatric && <Text style={styles.tokenFlag}>Pediatric</Text>}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export const labStatusModule: Module = {
  id: "lab-status",
  displayName: LAB_BOARD.title,
  icon: () => null,
  requiredPermissions: [],
  requiredAnyPermissions: LAB_BOARD.requiredAnyPermissions,
  navigator: LabStatusScreen,
  appCodes: LAB_BOARD.targets.tvAppCodes,
  tags: ["tv", "lab", "queue", "samples", "tat"],
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
    color: COLORS.red,
    fontFamily: "Fraunces-Regular",
    fontSize: 36,
  },
  lane: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brandDeep,
    borderRadius: 14,
    borderWidth: 2,
    flex: 1,
    gap: SPACING.md,
    minWidth: 360,
    padding: SPACING.lg,
  },
  laneTitle: {
    color: COLORS.emerald,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 18,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  loadingText: {
    color: COLORS.tint,
    fontSize: 24,
  },
  primaryLane: {
    flexBasis: "100%",
  },
  primaryTokenCard: {
    minHeight: 180,
  },
  primaryTokenNumber: {
    fontSize: 86,
  },
  tokenCard: {
    backgroundColor: COLORS.brandDeep,
    borderRadius: 12,
    borderWidth: 3,
    flex: 1,
    minWidth: 220,
    padding: SPACING.lg,
  },
  tokenFlag: {
    color: COLORS.amber,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 18,
    textTransform: "uppercase",
  },
  tokenGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
  },
  tokenMeta: {
    gap: 4,
    marginTop: SPACING.sm,
  },
  tokenMetaText: {
    color: COLORS.tint,
    fontSize: 20,
  },
  tokenNumber: {
    color: COLORS.canvas,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 46,
  },
  tokenStatus: {
    color: COLORS.emerald,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 18,
    textTransform: "uppercase",
  },
});

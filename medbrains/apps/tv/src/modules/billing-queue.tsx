/**
 * TV -> billing counter queue. Public-facing display uses token-only
 * financial state from invoices and advances, never patient names.
 * Deep-link: medbrains://tv/billing-queue
 */

import type { Module } from "@medbrains/mobile-shell";
import {
  BILLING_QUEUE_LANES,
  type BillingQueueToken,
  TOKEN_BOARD_SURFACES,
  tokenBoardRefreshLabel,
} from "@medbrains/types";
import { COLORS, SPACING } from "@medbrains/ui-mobile";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { TvBoard, TvSummaryRow } from "../components/tv-board.js";
import {
  TvFeedStatusBanner,
  tvFeedReadiness,
  tvLastUpdatedLabel,
} from "../components/tv-feed-status.js";
import { tvQueueService } from "../services/tvQueue.service.js";

const DISPLAY_TOKEN_LIMIT = 10;
const BILLING_BOARD = TOKEN_BOARD_SURFACES.billing;
const REFRESH_INTERVAL_MS = BILLING_BOARD.refreshIntervalMs;

function statusColor(status: string) {
  switch (status) {
    case "issued":
    case "active":
      return COLORS.copper;
    case "partially_paid":
      return COLORS.amber;
    case "paid":
    case "settled":
      return COLORS.emerald;
    default:
      return COLORS.tint;
  }
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function BillingQueueScreen() {
  const queueQuery = useQuery({
    queryKey: ["tv", "queue", "billing"],
    queryFn: tvQueueService.getBillingQueueDisplay,
    refetchInterval: REFRESH_INTERVAL_MS,
  });
  const queue = queueQuery.data;
  const board = useMemo(
    () =>
      BILLING_QUEUE_LANES.map((lane) => ({
        ...lane,
        tokens: queue?.[lane.key].slice(0, DISPLAY_TOKEN_LIMIT) ?? [],
      })),
    [queue],
  );
  const syncLabel = tvLastUpdatedLabel(queueQuery.dataUpdatedAt);
  const nowServing = board.find((lane) => lane.tokens.length > 0)?.tokens[0] ?? null;
  const totalWaiting = board.reduce((count, lane) => count + lane.tokens.length, 0);

  return (
    <TvBoard
      eyebrow="BILLING"
      title={BILLING_BOARD.title}
      subtitle="Please proceed to the billing desk when your token shows."
      legend={`Updates every ${tokenBoardRefreshLabel(BILLING_BOARD)} · last sync ${syncLabel} · ${BILLING_BOARD.targets.tvDeepLink}`}
      privacyNotice={BILLING_BOARD.privacyNotice}
      readiness={[
        { label: "Privacy", tone: "success", value: BILLING_BOARD.readiness.privacy },
        tvFeedReadiness(queueQuery.isError, queueQuery.dataUpdatedAt, REFRESH_INTERVAL_MS),
        { label: "Refresh", tone: "info", value: tokenBoardRefreshLabel(BILLING_BOARD) },
        { label: "Flow", tone: "info", value: BILLING_BOARD.readiness.flow },
      ]}
      tags={[...BILLING_BOARD.targets.tvAppCodes, "billing", "cashier", "insurance"]}
    >
      <TvSummaryRow
        items={[
          { label: "NOW SERVING", value: nowServing?.token_number ?? "-" },
          { label: "WAITING", value: String(totalWaiting) },
          ...board.map((lane) => ({
            label: lane.summaryLabel.toUpperCase(),
            value: String(lane.tokens.length),
          })),
        ]}
      />
      <TvFeedStatusBanner
        errorLabel="Billing queue feed is unreachable. Continuing with the last available token state."
        isError={queueQuery.isError}
        lastUpdatedAt={queueQuery.dataUpdatedAt}
        refreshIntervalMs={REFRESH_INTERVAL_MS}
      />
      {queueQuery.isLoading ? (
        <View style={styles.centerPanel}>
          <ActivityIndicator size="large" color={COLORS.emerald} />
          <Text style={styles.loadingText}>Loading billing queue...</Text>
        </View>
      ) : queueQuery.isError ? (
        <View style={styles.centerPanel}>
          <Text style={styles.errorTitle}>Billing feed unavailable</Text>
          <Text style={styles.errorText}>
            Check TV pairing, network, and billing queue display permissions.
          </Text>
        </View>
      ) : (
        <View style={styles.boardGrid}>
          {board.map((lane) => (
            <TokenLane
              key={lane.key}
              title={lane.title}
              emptyLabel={lane.emptyLabel}
              tokens={lane.tokens}
            />
          ))}
        </View>
      )}
    </TvBoard>
  );
}

function TokenLane({
  emptyLabel,
  title,
  tokens,
}: {
  emptyLabel: string;
  title: string;
  tokens: BillingQueueToken[];
}) {
  return (
    <View style={styles.lane}>
      <Text style={styles.laneTitle}>{title}</Text>
      {tokens.length === 0 ? (
        <View style={styles.emptyToken}>
          <Text style={styles.emptyTokenText}>{emptyLabel}</Text>
        </View>
      ) : (
        <View style={styles.tokenGrid}>
          {tokens.map((token) => (
            <View
              key={`${token.token_number}-${token.queue_type}`}
              style={[styles.tokenCard, { borderColor: statusColor(token.status) }]}
            >
              <Text style={styles.tokenNumber}>{token.token_number}</Text>
              <View style={styles.tokenMeta}>
                <Text style={styles.tokenStatus}>{statusLabel(token.status)}</Text>
                <Text style={styles.tokenMetaText}>{token.queue_type}</Text>
                {token.counter !== null && (
                  <Text style={styles.tokenMetaText}>Counter {token.counter}</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export const billingQueueModule: Module = {
  id: "billing-queue",
  displayName: BILLING_BOARD.title,
  icon: () => null,
  requiredPermissions: [],
  requiredAnyPermissions: BILLING_BOARD.requiredAnyPermissions,
  navigator: BillingQueueScreen,
  appCodes: BILLING_BOARD.targets.tvAppCodes,
  tags: ["tv", "billing", "queue", "cashier", "insurance"],
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

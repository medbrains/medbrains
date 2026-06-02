/**
 * TV -> billing counter queue. Public-facing display uses token-only
 * financial state from invoices and advances, never patient names.
 * Deep-link: medbrains://tv/billing-queue
 */

import type { Module } from "@medbrains/mobile-shell";
import type { BillingQueueToken } from "@medbrains/types";
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
    () => ({
      opd: queue?.opd_billing.slice(0, DISPLAY_TOKEN_LIMIT) ?? [],
      ipd: queue?.ipd_discharge.slice(0, DISPLAY_TOKEN_LIMIT) ?? [],
      advances: queue?.advance_deposit.slice(0, DISPLAY_TOKEN_LIMIT) ?? [],
      insurance: queue?.insurance_desk.slice(0, DISPLAY_TOKEN_LIMIT) ?? [],
    }),
    [queue],
  );
  const syncLabel = lastUpdatedLabel(queueQuery.dataUpdatedAt);
  const nowServing =
    board.ipd[0] ?? board.insurance[0] ?? board.opd[0] ?? board.advances[0] ?? null;
  const totalWaiting =
    board.opd.length + board.ipd.length + board.advances.length + board.insurance.length;

  return (
    <TvBoard
      eyebrow="BILLING"
      title="Counter queue"
      subtitle="Please proceed to the billing desk when your token shows."
      legend={`Updates every 10 seconds · last sync ${syncLabel} · medbrains://tv/billing-queue`}
      tags={["TV-Billing", "billing", "cashier", "insurance"]}
    >
      <TvSummaryRow
        items={[
          { label: "NOW SERVING", value: nowServing?.token_number ?? "-" },
          { label: "WAITING", value: String(totalWaiting) },
          { label: "IPD", value: String(board.ipd.length) },
          { label: "INSURANCE", value: String(board.insurance.length) },
        ]}
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
          <TokenLane title="OPD billing" emptyLabel="No OPD bills waiting" tokens={board.opd} />
          <TokenLane title="IPD discharge" emptyLabel="No IPD discharge bills" tokens={board.ipd} />
          <TokenLane
            title="Advance deposit"
            emptyLabel="No advance deposit tokens"
            tokens={board.advances}
          />
          <TokenLane
            title="Insurance desk"
            emptyLabel="No insurance desk tokens"
            tokens={board.insurance}
          />
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
  displayName: "Billing queue",
  icon: () => null,
  requiredPermissions: [],
  navigator: BillingQueueScreen,
  appCodes: ["TV-Billing"],
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

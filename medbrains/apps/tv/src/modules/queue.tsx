/**
 * TV → OPD queue board. Auto-refresh per-department token list.
 * Per-display deep-link:
 *   medbrains://tv/queue?department=cardiology
 */

import type { Module } from "@medbrains/mobile-shell";
import {
  type QueuePriority,
  type QueueToken,
  type QueueTokenStatus,
  TOKEN_BOARD_SURFACES,
  tokenBoardRefreshLabel,
  tokenBoardStatusSignal,
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
import {
  TvTokenStatusShape,
  tvTokenStatusSignalColors,
  tvTokenStatusTextColor,
} from "../components/tv-token-status-shape.js";
import { tvQueueService } from "../services/tvQueue.service.js";

const DISPLAY_TOKEN_LIMIT = 12;
const OPD_BOARD = TOKEN_BOARD_SURFACES.opd;
const REFRESH_INTERVAL_MS = OPD_BOARD.refreshIntervalMs;

interface QueueScreenProps {
  route?: {
    params?: {
      departmentId?: string;
      department_id?: string;
    };
  };
}

function tokenStatusLabel(status: QueueTokenStatus | string) {
  return status.replace(/_/g, " ");
}

function priorityLabel(priority: QueuePriority | string) {
  return priority.replace(/_/g, " ");
}

function statusColor(status: QueueTokenStatus | string) {
  return tvTokenStatusSignalColors(tokenBoardStatusSignal(status).tone).border;
}

function QueueScreen({ route }: QueueScreenProps) {
  const departmentId = route?.params?.departmentId ?? route?.params?.department_id;
  const tokensQuery = useQuery({
    queryKey: ["tv", "queue", "tokens", departmentId ?? "all"],
    queryFn: () => tvQueueService.listQueueTokens({ department_id: departmentId }),
    refetchInterval: REFRESH_INTERVAL_MS,
  });
  const metricsQuery = useQuery({
    queryKey: ["tv", "queue", "metrics", departmentId],
    queryFn: () => tvQueueService.getQueueMetrics(departmentId ?? ""),
    enabled: Boolean(departmentId),
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const tokens = tokensQuery.data ?? [];
  const boardState = useMemo(() => {
    const current =
      tokens.find((token) => token.status === "called" || token.status === "in_progress") ?? null;
    const waiting = tokens.filter((token) => token.status === "waiting");
    const completed = tokens.filter((token) => token.status === "completed");
    return { completed, current, waiting };
  }, [tokens]);
  const syncLabel = tvLastUpdatedLabel(tokensQuery.dataUpdatedAt);

  return (
    <TvBoard
      eyebrow="OPD"
      title={OPD_BOARD.title}
      subtitle={
        departmentId
          ? "Live department token call. Please proceed when your token is called."
          : "Live hospital token call. Please proceed when your token is called."
      }
      legend={`Updates every ${tokenBoardRefreshLabel(OPD_BOARD)} · last sync ${syncLabel} · ${OPD_BOARD.targets.tvDeepLink}`}
      privacyNotice={OPD_BOARD.privacyNotice}
      readiness={[
        { label: "Privacy", tone: "success", value: OPD_BOARD.readiness.privacy },
        tvFeedReadiness(tokensQuery.isError, tokensQuery.dataUpdatedAt, REFRESH_INTERVAL_MS),
        { label: "Refresh", tone: "info", value: tokenBoardRefreshLabel(OPD_BOARD) },
        { label: "Scope", tone: "info", value: departmentId ? "Department" : "Hospital" },
      ]}
      tags={[...OPD_BOARD.targets.tvAppCodes, "OPD"]}
    >
      <TvSummaryRow
        items={[
          { label: "NOW SERVING", value: boardState.current?.token_number ?? "—" },
          {
            label: "WAITING",
            value: String(metricsQuery.data?.current_waiting ?? boardState.waiting.length),
          },
          {
            label: "AVG WAIT",
            value: `${metricsQuery.data?.avg_wait_minutes ?? "—"} min`,
          },
          { label: "COMPLETED", value: String(boardState.completed.length) },
        ]}
      />
      <TvFeedStatusBanner
        errorLabel="Queue feed is unreachable. Continuing with the last available token state."
        isError={tokensQuery.isError}
        lastUpdatedAt={tokensQuery.dataUpdatedAt}
        refreshIntervalMs={REFRESH_INTERVAL_MS}
      />
      {tokensQuery.isLoading ? (
        <View style={styles.centerPanel}>
          <ActivityIndicator size="large" color={COLORS.emerald} />
          <Text style={styles.loadingText}>Loading live queue...</Text>
        </View>
      ) : tokensQuery.isError ? (
        <View style={styles.centerPanel}>
          <Text style={styles.errorTitle}>Queue feed unavailable</Text>
          <Text style={styles.errorText}>
            Check TV pairing, network, and queue display permissions.
          </Text>
        </View>
      ) : (
        <View style={styles.boardGrid}>
          <TokenLane
            title="Called now"
            emptyLabel="No token is currently called"
            tokens={boardState.current ? [boardState.current] : []}
            large
          />
          <TokenLane
            title="Next tokens"
            emptyLabel="No waiting tokens"
            tokens={boardState.waiting.slice(0, DISPLAY_TOKEN_LIMIT)}
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
  tokens: QueueToken[];
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
          {tokens.map((token) => {
            const signal = tokenBoardStatusSignal(token.status);
            const statusText = tokenStatusLabel(token.status);

            return (
              <View
                key={token.id}
                style={[
                  styles.tokenCard,
                  large && styles.primaryTokenCard,
                  { borderColor: statusColor(token.status) },
                ]}
              >
                <View style={styles.tokenNumberRow}>
                  <TvTokenStatusShape label={statusText} signal={signal} />
                  <Text style={[styles.tokenNumber, large && styles.primaryTokenNumber]}>
                    {token.token_number}
                  </Text>
                </View>
                <View style={styles.tokenMeta}>
                  <Text
                    style={[styles.tokenStatus, { color: tvTokenStatusTextColor(signal.tone) }]}
                  >
                    {statusText}
                  </Text>
                  {token.priority !== "normal" && (
                    <Text style={styles.tokenPriority}>{priorityLabel(token.priority)}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export const queueModule: Module = {
  id: "queue",
  displayName: OPD_BOARD.title,
  icon: () => null,
  requiredPermissions: [],
  requiredAnyPermissions: OPD_BOARD.requiredAnyPermissions,
  navigator: QueueScreen,
  appCodes: OPD_BOARD.targets.tvAppCodes,
  tags: ["tv", "queue", "opd", "tokens", "kiosk"],
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
    minHeight: 160,
    justifyContent: "center",
    padding: SPACING.lg,
  },
  emptyTokenText: {
    color: COLORS.tint,
    fontSize: 26,
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
    minWidth: 420,
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
    minHeight: 260,
  },
  primaryTokenNumber: {
    fontSize: 112,
  },
  tokenCard: {
    backgroundColor: COLORS.brandDeep,
    borderRadius: 12,
    borderWidth: 3,
    flexGrow: 1,
    minHeight: 150,
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
  tokenNumber: {
    color: COLORS.canvas,
    fontFamily: "Fraunces-Regular",
    fontSize: 64,
  },
  tokenNumberRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
  },
  tokenPriority: {
    color: COLORS.copper,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 18,
    textTransform: "uppercase",
  },
  tokenStatus: {
    color: COLORS.emerald,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 18,
    textTransform: "uppercase",
  },
});

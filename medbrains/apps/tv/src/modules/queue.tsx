/**
 * TV → OPD queue board. Auto-refresh per-department token list.
 * Per-display deep-link:
 *   medbrains://tv/queue?department=cardiology
 *
 * Reads the unified `tokens` table, not `queue_tokens`.
 *
 * OPD check-in wrote three parallel queues and they advanced independently:
 * the doctor called the next patient in `opd_queues`, this board read
 * `queue_tokens`, and nothing advanced `queue_tokens` because the endpoints
 * that do are gated on a code no role holds. A waiting room watched a number
 * that could not change. `tokens` is the one the doctor now advances, so this
 * board and the consulting room finally agree.
 *
 * `include_finished` is on because a board is not a work queue: the number
 * just called stays up while the patient walks to the room, and a missed token
 * stays visible long enough for someone who stepped out to come back and find
 * out what happened.
 */

import type { Module } from "@medbrains/mobile-shell";
import {
  type ModuleToken,
  type QueuePriority,
  type QueueTokenStatus,
  recentlyMissedTokens,
  TOKEN_BOARD_SURFACES,
  tokenBoardStatusLabel,
  tokenBoardStatusSignal,
} from "@medbrains/types";
import { COLORS, SPACING } from "@medbrains/ui-mobile";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { TvBoard, TvSummaryRow } from "../components/tv-board.js";
import { TvFeedStatusBanner } from "../components/tv-feed-status.js";
import {
  tvTokenBoardFeedErrorLabel,
  tvTokenBoardLaneEmptyLabel,
  tvTokenBoardLaneTitle,
  tvTokenBoardLoadingLabel,
  tvTokenBoardSubtitle,
  tvTokenBoardSummaryLabel,
  tvTokenBoardUnavailableMessage,
  tvTokenBoardUnavailableTitle,
} from "../components/tv-i18n.js";
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
  return tokenBoardStatusLabel(status);
}

function priorityLabel(priority: QueuePriority | string) {
  return priority.replace(/_/g, " ");
}

function statusColor(status: QueueTokenStatus | string) {
  return tvTokenStatusSignalColors(tokenBoardStatusSignal(status).tone).border;
}

function QueueScreen({ route }: QueueScreenProps) {
  const departmentId = route?.params?.departmentId ?? route?.params?.department_id;
  // Absent department means the whole hospital, which is what omitting the
  // scope asks for — the same behaviour the department filter had.
  const scope = departmentId ? { scope: "department", scope_id: departmentId } : {};
  const tokensQuery = useQuery({
    queryKey: ["tv", "opd-board", "tokens", departmentId ?? "all"],
    queryFn: () => tvQueueService.listOpdBoard({ ...scope, include_finished: true, module: "opd" }),
    refetchInterval: REFRESH_INTERVAL_MS,
  });
  const metricsQuery = useQuery({
    queryKey: ["tv", "opd-board", "metrics", departmentId ?? "all"],
    queryFn: () => tvQueueService.opdBoardMetrics({ ...scope, module: "opd" }),
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const tokens = tokensQuery.data ?? [];
  const boardState = useMemo(() => {
    // 'serving' is the unified table's name for what queue_tokens called
    // 'in_progress'; both are on the board because the patient is in the room.
    const current =
      tokens.find((token) => token.status === "called" || token.status === "serving") ?? null;
    const waiting = tokens.filter((token) => token.status === "waiting");
    const completed = tokens.filter((token) => token.status === "completed");
    // A missed token used to match none of the three lanes above and so left
    // the board entirely. The patient who stepped out for five minutes came
    // back to a screen that had forgotten them, with nothing to say why.
    const missed = recentlyMissedTokens(tokens, tokensQuery.dataUpdatedAt || Date.now());
    return { completed, current, missed, waiting };
    // Recomputed on every refetch so the window closes on its own: the same
    // token list an hour later yields an empty lane without any timer here.
  }, [tokens, tokensQuery.dataUpdatedAt]);

  return (
    <TvBoard
      eyebrow="OPD"
      title={OPD_BOARD.title}
      subtitle={tvTokenBoardSubtitle(OPD_BOARD.id, {
        scope: departmentId ? "department" : "hospital",
      })}
      privacyNotice={OPD_BOARD.privacyNotice}
    >
      <TvSummaryRow
        items={[
          {
            label: tvTokenBoardSummaryLabel("nowServing"),
            value: boardState.current?.number ?? "—",
          },
          {
            label: tvTokenBoardSummaryLabel("waiting"),
            value: String(metricsQuery.data?.waiting ?? boardState.waiting.length),
          },
          {
            label: tvTokenBoardSummaryLabel("avgWait"),
            // Null until somebody has been called today. A waiting room told
            // the average wait is nought minutes at eight in the morning
            // learns something false about the day ahead.
            value:
              metricsQuery.data?.avg_wait_minutes == null
                ? "—"
                : `${Math.round(metricsQuery.data.avg_wait_minutes)} min`,
          },
        ]}
      />
      <TvFeedStatusBanner
        errorLabel={tvTokenBoardFeedErrorLabel(OPD_BOARD.id)}
        isError={tokensQuery.isError}
        lastUpdatedAt={tokensQuery.dataUpdatedAt}
        refreshIntervalMs={REFRESH_INTERVAL_MS}
      />
      {tokensQuery.isLoading ? (
        <View style={styles.centerPanel}>
          <ActivityIndicator size="large" color={COLORS.emerald} />
          <Text style={styles.loadingText}>{tvTokenBoardLoadingLabel(OPD_BOARD.id)}</Text>
        </View>
      ) : tokensQuery.isError && !tokensQuery.data ? (
        // Only when there is nothing to show at all. A board that has ever
        // loaded keeps its last known list up: a slightly stale queue is far
        // more use to a waiting room than an error page, and the banner above
        // already says the feed has gone quiet.
        <View style={styles.centerPanel}>
          <Text style={styles.errorTitle}>{tvTokenBoardUnavailableTitle(OPD_BOARD.id)}</Text>
          <Text style={styles.errorText}>{tvTokenBoardUnavailableMessage(OPD_BOARD.id)}</Text>
        </View>
      ) : (
        <View style={styles.boardGrid}>
          <TokenLane
            title={tvTokenBoardLaneTitle("calledNow")}
            emptyLabel={tvTokenBoardLaneEmptyLabel("calledNow")}
            tokens={boardState.current ? [boardState.current] : []}
            large
          />
          <TokenLane
            title={tvTokenBoardLaneTitle("nextTokens")}
            emptyLabel={tvTokenBoardLaneEmptyLabel("nextTokens")}
            tokens={boardState.waiting.slice(0, DISPLAY_TOKEN_LIMIT)}
          />
          {/* Only when somebody has actually been missed. An always-present
              "No missed tokens" lane spends board space on a reassurance
              nobody is waiting to read. */}
          {boardState.missed.length > 0 && (
            <TokenLane
              title={tvTokenBoardLaneTitle("missed")}
              emptyLabel={tvTokenBoardLaneEmptyLabel("missed")}
              tokens={boardState.missed.slice(0, DISPLAY_TOKEN_LIMIT)}
            />
          )}
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
  tokens: ModuleToken[];
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
                    {token.number}
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
    flex: 1,
    flexDirection: "row",
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

/**
 * TV → pharmacy dispensing queue. Tokens called for prescription
 * pickup; ready-for-collection blinks. Deep-link:
 *   medbrains://tv/pharmacy-queue
 */

import type { Module } from "@medbrains/mobile-shell";
import {
  type PharmacyQueueToken,
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
import { TvFeedStatusBanner, tvTokenBoardReadinessItems } from "../components/tv-feed-status.js";
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

const DISPLAY_TOKEN_LIMIT = 10;
const PHARMACY_BOARD = TOKEN_BOARD_SURFACES.pharmacy;
const REFRESH_INTERVAL_MS = PHARMACY_BOARD.refreshIntervalMs;

function statusColor(status: string) {
  return tvTokenStatusSignalColors(tokenBoardStatusSignal(status).tone).border;
}

function statusLabel(status: string) {
  return tokenBoardStatusLabel(status);
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

  return (
    <TvBoard
      eyebrow="PHARMACY"
      title={PHARMACY_BOARD.title}
      subtitle={tvTokenBoardSubtitle(PHARMACY_BOARD.id)}
      privacyNotice={PHARMACY_BOARD.privacyNotice}
      readiness={tvTokenBoardReadinessItems({
        isError: queueQuery.isError,
        surface: PHARMACY_BOARD,
        updatedAt: queueQuery.dataUpdatedAt,
      })}
    >
      <TvSummaryRow
        items={[
          {
            label: tvTokenBoardSummaryLabel("nowServing"),
            value: board.current?.token_number ?? "—",
          },
          {
            label: tvTokenBoardSummaryLabel("ready"),
            value: String(queue?.stats.ready_count ?? "—"),
          },
          {
            label: tvTokenBoardSummaryLabel("waiting"),
            value: String(queue?.stats.waiting_count ?? "—"),
          },
          {
            label: tvTokenBoardSummaryLabel("avgWait"),
            value: `${queue?.stats.avg_wait_minutes ?? "—"} min`,
          },
        ]}
      />
      <TvFeedStatusBanner
        errorLabel={tvTokenBoardFeedErrorLabel(PHARMACY_BOARD.id)}
        isError={queueQuery.isError}
        lastUpdatedAt={queueQuery.dataUpdatedAt}
        refreshIntervalMs={REFRESH_INTERVAL_MS}
      />
      {queueQuery.isLoading ? (
        <View style={styles.centerPanel}>
          <ActivityIndicator size="large" color={COLORS.emerald} />
          <Text style={styles.loadingText}>{tvTokenBoardLoadingLabel(PHARMACY_BOARD.id)}</Text>
        </View>
      ) : queueQuery.isError && !queueQuery.data ? (
        // Only when there is nothing to show at all. A board that has ever
        // loaded keeps its last known list up: a slightly stale queue is far
        // more use to a waiting room than an error page, and the banner above
        // already says the feed has gone quiet.
        <View style={styles.centerPanel}>
          <Text style={styles.errorTitle}>{tvTokenBoardUnavailableTitle(PHARMACY_BOARD.id)}</Text>
          <Text style={styles.errorText}>{tvTokenBoardUnavailableMessage(PHARMACY_BOARD.id)}</Text>
        </View>
      ) : (
        <View style={styles.boardGrid}>
          <TokenLane
            title={tvTokenBoardLaneTitle("nowServing")}
            emptyLabel={tvTokenBoardLaneEmptyLabel("nowServing")}
            tokens={board.current ? [board.current] : []}
            large
          />
          <TokenLane
            title={tvTokenBoardLaneTitle("readyPickup")}
            emptyLabel={tvTokenBoardLaneEmptyLabel("readyPickup")}
            tokens={board.ready}
          />
          <TokenLane
            title={tvTokenBoardLaneTitle("preparing")}
            emptyLabel={tvTokenBoardLaneEmptyLabel("preparing")}
            tokens={board.preparing}
          />
          <TokenLane
            title={tvTokenBoardLaneTitle("waiting")}
            emptyLabel={tvTokenBoardLaneEmptyLabel("waiting")}
            tokens={board.waiting}
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
          {tokens.map((token) => {
            const signal = tokenBoardStatusSignal(token.status);
            const statusText = statusLabel(token.status);

            return (
              <View
                key={`${token.token_number}-${token.status}`}
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
                  <Text style={styles.tokenMetaText}>
                    {token.prescription_count} item{token.prescription_count === 1 ? "" : "s"}
                  </Text>
                  {token.counter !== null && (
                    <Text style={styles.tokenMetaText}>Counter {token.counter}</Text>
                  )}
                  {token.estimated_wait_minutes !== null && (
                    <Text style={styles.tokenMetaText}>
                      {token.estimated_wait_minutes} min wait
                    </Text>
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

export const pharmacyQueueModule: Module = {
  id: "pharmacy-queue",
  displayName: PHARMACY_BOARD.title,
  icon: () => null,
  requiredPermissions: [],
  requiredAnyPermissions: PHARMACY_BOARD.requiredAnyPermissions,
  navigator: PharmacyQueueScreen,
  appCodes: PHARMACY_BOARD.targets.tvAppCodes,
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
  tokenNumberRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
  },
  tokenStatus: {
    color: COLORS.emerald,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 18,
    textTransform: "uppercase",
  },
});

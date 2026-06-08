/**
 * TV -> radiology modality queue. Public display stays token-only and
 * suppresses patient identity, indications, prep instructions, and reports.
 * Deep-link: medbrains://tv/radiology-queue?modality=xray
 */

import type { Module } from "@medbrains/mobile-shell";
import {
  type RadiologyQueueToken,
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
import {
  TvFeedStatusBanner,
  tvTokenBoardLegend,
  tvTokenBoardReadinessItems,
} from "../components/tv-feed-status.js";
import {
  TvTokenStatusShape,
  tvTokenStatusSignalColors,
  tvTokenStatusTextColor,
} from "../components/tv-token-status-shape.js";
import { tvQueueService } from "../services/tvQueue.service.js";

const DISPLAY_TOKEN_LIMIT = 12;
const DEFAULT_MODALITY = "xray";
const RADIOLOGY_BOARD = TOKEN_BOARD_SURFACES.radiology;
const REFRESH_INTERVAL_MS = RADIOLOGY_BOARD.refreshIntervalMs;
const MODALITY_LABELS: Record<string, string> = {
  ct: "CT",
  mri: "MRI",
  usg: "USG",
  xray: "X-ray",
};

interface RadiologyQueueScreenProps {
  route?: {
    params?: {
      modality?: string;
      modalityCode?: string;
      modality_code?: string;
    };
  };
}

function normaliseModality(value: string | null | undefined) {
  const cleaned = value?.trim().toLowerCase();
  if (!cleaned || !/^[a-z0-9_-]+$/.test(cleaned)) return DEFAULT_MODALITY;
  return cleaned;
}

function displayModality(value: string) {
  const key = value.toLowerCase();
  return MODALITY_LABELS[key] ?? value.toUpperCase();
}

function statusColor(status: string) {
  return tvTokenStatusSignalColors(tokenBoardStatusSignal(status).tone).border;
}

function statusLabel(status: string) {
  return tokenBoardStatusLabel(status);
}

function RadiologyQueueScreen({ route }: RadiologyQueueScreenProps) {
  const modality = normaliseModality(
    route?.params?.modality ?? route?.params?.modalityCode ?? route?.params?.modality_code,
  );
  const queueQuery = useQuery({
    queryKey: ["tv", "queue", "radiology", modality],
    queryFn: () => tvQueueService.getRadiologyQueueDisplay(modality),
    refetchInterval: REFRESH_INTERVAL_MS,
  });
  const queue = queueQuery.data;
  const board = useMemo(
    () => ({
      called: queue?.current_token ? [queue.current_token] : [],
      waiting: queue?.waiting.slice(0, DISPLAY_TOKEN_LIMIT) ?? [],
    }),
    [queue],
  );
  const modalityLabel = displayModality(queue?.modality ?? modality);
  const deepLink = `medbrains://tv/radiology-queue?modality=${encodeURIComponent(modality)}`;

  return (
    <TvBoard
      eyebrow="RADIOLOGY"
      title={`${modalityLabel} imaging`}
      subtitle="Please proceed to the imaging room when your token shows."
      legend={tvTokenBoardLegend(RADIOLOGY_BOARD, queueQuery.dataUpdatedAt, deepLink)}
      privacyNotice={RADIOLOGY_BOARD.privacyNotice}
      readiness={[
        ...tvTokenBoardReadinessItems({
          isError: queueQuery.isError,
          surface: RADIOLOGY_BOARD,
          updatedAt: queueQuery.dataUpdatedAt,
        }),
        { label: "Modality", tone: "info", value: modalityLabel },
      ]}
      tags={[...RADIOLOGY_BOARD.targets.tvAppCodes, "radiology", modalityLabel]}
    >
      <TvSummaryRow
        items={[
          { label: "NOW", value: queue?.current_token?.token_number ?? "—" },
          { label: "WAITING", value: String(queue?.stats.waiting_count ?? "—") },
          { label: "COMPLETED", value: String(queue?.stats.completed_today ?? "—") },
          { label: "AVG SCAN", value: `${queue?.stats.avg_scan_minutes ?? "—"} min` },
        ]}
      />
      <TvFeedStatusBanner
        errorLabel="Radiology queue feed is unreachable. Continuing with the last available token state."
        isError={queueQuery.isError}
        lastUpdatedAt={queueQuery.dataUpdatedAt}
        refreshIntervalMs={REFRESH_INTERVAL_MS}
      />
      {queueQuery.isLoading ? (
        <View style={styles.centerPanel}>
          <ActivityIndicator size="large" color={COLORS.emerald} />
          <Text style={styles.loadingText}>Loading radiology queue...</Text>
        </View>
      ) : queueQuery.isError ? (
        <View style={styles.centerPanel}>
          <Text style={styles.errorTitle}>Radiology feed unavailable</Text>
          <Text style={styles.errorText}>
            Check TV pairing, network, and radiology display access.
          </Text>
        </View>
      ) : (
        <View style={styles.boardGrid}>
          <TokenLane
            title="Called now"
            emptyLabel="No radiology token is currently called"
            tokens={board.called}
            large
          />
          <TokenLane
            title="Waiting scans"
            emptyLabel="No radiology tokens waiting"
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
  tokens: RadiologyQueueToken[];
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
                key={`${token.token_number}-${token.room_number}-${token.status}`}
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
                  <Text style={styles.tokenMetaText}>{displayModality(token.modality)}</Text>
                  <Text style={styles.tokenMetaText}>Room {token.room_number}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export const radiologyQueueModule: Module = {
  id: "radiology-queue",
  displayName: RADIOLOGY_BOARD.title,
  icon: () => null,
  requiredPermissions: [],
  requiredAnyPermissions: RADIOLOGY_BOARD.requiredAnyPermissions,
  navigator: RadiologyQueueScreen,
  appCodes: RADIOLOGY_BOARD.targets.tvAppCodes,
  tags: ["tv", "radiology", "queue", "modality", "dicom"],
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
    minHeight: 160,
    padding: SPACING.lg,
  },
  emptyTokenText: {
    color: COLORS.tint,
    fontSize: 26,
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
    borderRadius: 14,
    borderWidth: 2,
    flex: 1,
    gap: SPACING.md,
    minWidth: 380,
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
    minHeight: 190,
  },
  primaryTokenNumber: {
    fontSize: 86,
  },
  tokenCard: {
    backgroundColor: COLORS.brandDeep,
    borderRadius: 12,
    borderWidth: 3,
    flex: 1,
    minWidth: 240,
    padding: SPACING.lg,
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
    fontSize: 48,
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

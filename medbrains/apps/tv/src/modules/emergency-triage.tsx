import type { Module } from "@medbrains/mobile-shell";
import {
  type ErQueueDisplay,
  type ErTriageToken,
  TOKEN_BOARD_SURFACES,
  type TriageLevelColor,
} from "@medbrains/types";
import { COLORS, SPACING } from "@medbrains/ui-mobile";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { TvBoard, TvSummaryRow } from "../components/tv-board.js";
import { TvFeedStatusBanner, tvLastUpdatedLabel } from "../components/tv-feed-status.js";
import { tvQueueService } from "../services/tvQueue.service.js";

const REFRESH_INTERVAL_MS = 5_000;
const DISPLAY_TOKEN_LIMIT = 8;
const EMERGENCY_BOARD = TOKEN_BOARD_SURFACES.emergency;

const TRIAGE_LANES: ReadonlyArray<{
  color: string;
  emptyLabel: string;
  key: TriageLevelColor;
  targetLabel: string;
  title: string;
}> = [
  {
    color: COLORS.red,
    emptyLabel: "No red triage tokens",
    key: "red",
    targetLabel: "Immediate",
    title: "Red",
  },
  {
    color: COLORS.copper,
    emptyLabel: "No orange triage tokens",
    key: "orange",
    targetLabel: "Very urgent",
    title: "Orange",
  },
  {
    color: COLORS.amber,
    emptyLabel: "No yellow triage tokens",
    key: "yellow",
    targetLabel: "Urgent",
    title: "Yellow",
  },
  {
    color: COLORS.emerald,
    emptyLabel: "No green triage tokens",
    key: "green",
    targetLabel: "Standard",
    title: "Green",
  },
  {
    color: COLORS.brand,
    emptyLabel: "No blue triage tokens",
    key: "blue",
    targetLabel: "Non-urgent",
    title: "Blue",
  },
];

function tokenCount(queue: ErQueueDisplay | undefined, key: TriageLevelColor) {
  return queue?.[key].length ?? 0;
}

function EmergencyTriageScreen() {
  const queueQuery = useQuery({
    queryKey: ["tv", "queue", "emergency-triage"],
    queryFn: tvQueueService.getErQueueDisplay,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const queue = queueQuery.data;
  const lanes = useMemo(
    () =>
      TRIAGE_LANES.map((lane) => ({
        ...lane,
        tokens: (queue?.[lane.key] ?? []).slice(0, DISPLAY_TOKEN_LIMIT),
      })),
    [queue],
  );
  const overdueCount = lanes.reduce(
    (count, lane) => count + lane.tokens.filter((token) => token.is_overdue).length,
    0,
  );
  const syncLabel = tvLastUpdatedLabel(queueQuery.dataUpdatedAt);

  return (
    <TvBoard
      eyebrow="EMERGENCY"
      title={EMERGENCY_BOARD.title}
      subtitle="Live triage queue with token-only public display."
      legend={`Updates every 5 seconds · last sync ${syncLabel} · ${EMERGENCY_BOARD.targets.tvDeepLink}`}
      privacyNotice={EMERGENCY_BOARD.privacyNotice}
      tags={[...EMERGENCY_BOARD.targets.tvAppCodes, "triage", "token-only", "staff-display"]}
    >
      <TvSummaryRow
        items={[
          { label: "RED", value: String(tokenCount(queue, "red")) },
          { label: "ORANGE", value: String(tokenCount(queue, "orange")) },
          { label: "TOTAL", value: String(queue?.total_waiting ?? "—") },
          { label: "BAYS", value: String(queue?.resuscitation_bays_available ?? "—") },
        ]}
      />
      <TvFeedStatusBanner
        errorLabel="Emergency triage feed is unreachable. Continuing with the last available token state."
        isError={queueQuery.isError}
        lastUpdatedAt={queueQuery.dataUpdatedAt}
        refreshIntervalMs={REFRESH_INTERVAL_MS}
      />
      {queueQuery.isLoading ? (
        <View style={styles.centerPanel}>
          <ActivityIndicator size="large" color={COLORS.emerald} />
          <Text style={styles.loadingText}>Loading emergency triage...</Text>
        </View>
      ) : queueQuery.isError ? (
        <View style={styles.centerPanel}>
          <Text style={styles.errorTitle}>Triage feed unavailable</Text>
          <Text style={styles.errorText}>
            Check TV pairing, network, and emergency display permissions.
          </Text>
        </View>
      ) : (
        <View style={styles.boardGrid}>
          <View style={styles.alertStrip}>
            <Text style={styles.alertLabel}>Overdue targets</Text>
            <Text style={[styles.alertValue, overdueCount > 0 && styles.alertValueHot]}>
              {overdueCount}
            </Text>
          </View>
          {lanes.map((lane) => (
            <TriageLane
              key={lane.key}
              color={lane.color}
              emptyLabel={lane.emptyLabel}
              targetLabel={lane.targetLabel}
              title={lane.title}
              tokens={lane.tokens}
            />
          ))}
        </View>
      )}
    </TvBoard>
  );
}

function TriageLane({
  color,
  emptyLabel,
  targetLabel,
  title,
  tokens,
}: {
  color: string;
  emptyLabel: string;
  targetLabel: string;
  title: string;
  tokens: ErTriageToken[];
}) {
  return (
    <View style={[styles.lane, { borderColor: color }]}>
      <View style={styles.laneHeader}>
        <Text style={styles.laneTitle}>{title}</Text>
        <Text style={styles.targetLabel}>{targetLabel}</Text>
      </View>
      {tokens.length === 0 ? (
        <View style={styles.emptyToken}>
          <Text style={styles.emptyTokenText}>{emptyLabel}</Text>
        </View>
      ) : (
        <View style={styles.tokenGrid}>
          {tokens.map((token) => (
            <View
              key={`${token.triage_level}-${token.token_number}`}
              style={[
                styles.tokenCard,
                { borderColor: color },
                token.is_overdue && styles.overdueTokenCard,
              ]}
            >
              <Text style={styles.tokenNumber}>{token.token_number}</Text>
              <View style={styles.tokenMeta}>
                <Text style={styles.tokenMetaText}>{token.waiting_minutes} min waiting</Text>
                <Text style={styles.tokenMetaText}>Target {token.target_wait_minutes} min</Text>
                {token.is_overdue && <Text style={styles.overdueLabel}>Overdue</Text>}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export const emergencyTriageModule: Module = {
  id: "emergency-triage",
  displayName: EMERGENCY_BOARD.title,
  icon: () => null,
  requiredPermissions: [],
  requiredAnyPermissions: EMERGENCY_BOARD.requiredAnyPermissions,
  navigator: EmergencyTriageScreen,
  appCodes: EMERGENCY_BOARD.targets.tvAppCodes,
  tags: ["tv", "emergency", "triage", "code-alert"],
};

const styles = StyleSheet.create({
  alertLabel: {
    color: COLORS.tint,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 18,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  alertStrip: {
    alignItems: "center",
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brandDeep,
    borderRadius: 12,
    borderWidth: 2,
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
    padding: SPACING.lg,
    width: "100%",
  },
  alertValue: {
    color: COLORS.canvas,
    fontFamily: "Fraunces-Regular",
    fontSize: 56,
  },
  alertValueHot: {
    color: COLORS.red,
  },
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
    borderRadius: 12,
    borderWidth: 3,
    flex: 1,
    minWidth: 340,
    padding: SPACING.lg,
  },
  laneHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },
  laneTitle: {
    color: COLORS.canvas,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 22,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  loadingText: {
    color: COLORS.canvas,
    fontSize: 28,
  },
  overdueLabel: {
    color: COLORS.red,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 18,
    textTransform: "uppercase",
  },
  overdueTokenCard: {
    borderWidth: 4,
  },
  targetLabel: {
    color: COLORS.tint,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 16,
    textTransform: "uppercase",
  },
  tokenCard: {
    backgroundColor: COLORS.brandDeep,
    borderRadius: 12,
    borderWidth: 3,
    flexGrow: 1,
    minHeight: 140,
    minWidth: 170,
    padding: SPACING.lg,
  },
  tokenGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
  },
  tokenMeta: {
    gap: SPACING.xs,
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
});

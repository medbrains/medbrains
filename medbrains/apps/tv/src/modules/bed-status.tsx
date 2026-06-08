import type { Module } from "@medbrains/mobile-shell";
import {
  type BedAvailabilityDisplay,
  type BedBoardStatusSignal,
  type BedWaitingEntry,
  bedBoardStatusLabel,
  bedBoardStatusSignal,
  P,
} from "@medbrains/types";
import { COLORS, SPACING, WorkflowSignalMarker } from "@medbrains/ui-mobile";
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

const REFRESH_INTERVAL_MS = 10_000;
const WAITING_LIST_LIMIT = 8;
const DEFAULT_WARD_TYPE = "general";

interface BedStatusScreenProps {
  route?: {
    params?: {
      ward?: string;
      wardType?: string;
      ward_type?: string;
    };
  };
}

function normaliseWardType(value: string | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, "_") || DEFAULT_WARD_TYPE;
}

function displayWardType(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function occupancyPercent(data: BedAvailabilityDisplay | undefined) {
  if (!data || data.total_beds <= 0) return 0;
  return Math.round((data.occupied / data.total_beds) * 100);
}

function priorityColor(priority: string) {
  switch (priority.toLowerCase()) {
    case "critical":
    case "emergency":
    case "stat":
      return COLORS.red;
    case "high":
    case "urgent":
      return COLORS.amber;
    case "routine":
    case "normal":
      return COLORS.emerald;
    default:
      return COLORS.tint;
  }
}

function statusLabel(status: string) {
  return bedBoardStatusLabel(status);
}

function BedStatusShape({ label, signal }: { label: string; signal: BedBoardStatusSignal }) {
  return (
    <WorkflowSignalMarker
      accessibilityLabel={label}
      emphasis="high"
      pillExtension={12}
      shape={signal.shape}
      size={22}
      style={[
        styles.statusMarker,
        signal.shape === "bed" ? styles.statusMarkerBed : styles.statusMarkerDefault,
      ]}
      tone={signal.tone}
    />
  );
}

function waitingEntryKey(token: BedWaitingEntry) {
  const source = `${token.ward_type}|${token.priority}|${token.wait_time_minutes}|${token.status}`;
  let hash = 0;
  for (const char of source) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1_000_000_007;
  }
  return `${token.ward_type}-${hash}`;
}

function BedStatusScreen({ route }: BedStatusScreenProps) {
  const wardType = normaliseWardType(
    route?.params?.wardType ?? route?.params?.ward_type ?? route?.params?.ward,
  );
  const bedQuery = useQuery({
    queryKey: ["tv", "beds", wardType],
    queryFn: () => tvQueueService.getBedAvailabilityDisplay(wardType),
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const bedState = bedQuery.data;
  const waitingList = useMemo(
    () => (bedState?.waiting_list ?? []).slice(0, WAITING_LIST_LIMIT),
    [bedState],
  );
  const occupied = bedState?.occupied ?? 0;
  const available = bedState?.available ?? 0;
  const totalBeds = bedState?.total_beds ?? 0;
  const percentOccupied = occupancyPercent(bedState);
  const syncLabel = tvLastUpdatedLabel(bedQuery.dataUpdatedAt);

  return (
    <TvBoard
      eyebrow="WARD"
      title={`${displayWardType(wardType)} beds`}
      subtitle="Live ward occupancy and masked waiting-list state."
      legend={`Updates every 10 seconds · last sync ${syncLabel} · medbrains://tv/bed-status?ward=${wardType}`}
      privacyNotice="Waiting list stays masked; names, UHIDs, diagnoses, and bed-transfer notes stay off the ward display."
      readiness={[
        { label: "Privacy", tone: "success", value: "Masked list" },
        tvFeedReadiness(bedQuery.isError, bedQuery.dataUpdatedAt, REFRESH_INTERVAL_MS),
        { label: "Refresh", tone: "info", value: "10s" },
        { label: "Ward", tone: "info", value: displayWardType(wardType) },
      ]}
      tags={["TV-Ward", "TV-ICU", "IPD", "beds"]}
    >
      <TvSummaryRow
        items={[
          { label: "OCCUPIED", value: bedState ? String(occupied) : "—" },
          { label: "AVAILABLE", value: bedState ? String(available) : "—" },
          { label: "TOTAL", value: bedState ? String(totalBeds) : "—" },
          { label: "WAITING", value: String(bedState?.waiting_list.length ?? "—") },
        ]}
      />
      <TvFeedStatusBanner
        errorLabel="Bed status feed is unreachable. Continuing with the last available occupancy state."
        isError={bedQuery.isError}
        lastUpdatedAt={bedQuery.dataUpdatedAt}
        refreshIntervalMs={REFRESH_INTERVAL_MS}
      />
      {bedQuery.isLoading ? (
        <View style={styles.centerPanel}>
          <ActivityIndicator size="large" color={COLORS.emerald} />
          <Text style={styles.loadingText}>Loading bed state...</Text>
        </View>
      ) : bedQuery.isError ? (
        <View style={styles.centerPanel}>
          <Text style={styles.errorTitle}>Bed feed unavailable</Text>
          <Text style={styles.errorText}>Check TV pairing, network, and ward display access.</Text>
        </View>
      ) : (
        <View style={styles.boardGrid}>
          <View style={styles.occupancyPanel}>
            <View style={styles.occupancyHeader}>
              <Text style={styles.panelLabel}>Occupancy</Text>
              <Text style={styles.occupancyValue}>{percentOccupied}%</Text>
            </View>
            <View style={styles.occupancyBar}>
              <View style={[styles.occupiedSegment, { flex: occupied }]} />
              <View style={[styles.availableSegment, { flex: available }]} />
            </View>
            <View style={styles.occupancyLegend}>
              <Text style={styles.legendText}>{occupied} occupied</Text>
              <Text style={styles.legendText}>{available} available</Text>
            </View>
          </View>

          <WaitingListLane tokens={waitingList} />
        </View>
      )}
    </TvBoard>
  );
}

function WaitingListLane({ tokens }: { tokens: BedWaitingEntry[] }) {
  return (
    <View style={styles.waitingLane}>
      <Text style={styles.panelLabel}>Waiting list</Text>
      {tokens.length === 0 ? (
        <View style={styles.emptyToken}>
          <Text style={styles.emptyTokenText}>No waiting patients for this ward type</Text>
        </View>
      ) : (
        <View style={styles.waitingGrid}>
          {tokens.map((token) => {
            const statusText = statusLabel(token.status);
            const signal = bedBoardStatusSignal(token.status);

            return (
              <View
                key={waitingEntryKey(token)}
                style={[styles.waitingCard, { borderColor: priorityColor(token.priority) }]}
              >
                <Text style={styles.waitingCase}>Waiting case</Text>
                <View style={styles.waitingMeta}>
                  <Text style={styles.metaText}>{token.priority}</Text>
                  <View style={styles.statusMeta}>
                    <BedStatusShape label={statusText} signal={signal} />
                    <Text style={styles.metaText}>{statusText}</Text>
                  </View>
                  <Text style={styles.metaText}>{token.wait_time_minutes} min</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export const bedStatusModule: Module = {
  id: "bed-status",
  displayName: "Bed occupancy",
  icon: () => null,
  requiredPermissions: [],
  requiredAnyPermissions: [P.IPD.BED_DASHBOARD_VIEW],
  navigator: BedStatusScreen,
  appCodes: ["TV-Ward", "TV-ICU"],
  tags: ["tv", "ipd", "bed-status", "ward", "icu"],
};

const styles = StyleSheet.create({
  availableSegment: {
    backgroundColor: COLORS.emerald,
  },
  boardGrid: {
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
  legendText: {
    color: COLORS.tint,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 18,
    textTransform: "uppercase",
  },
  loadingText: {
    color: COLORS.canvas,
    fontSize: 28,
  },
  metaText: {
    color: COLORS.tint,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 16,
    textTransform: "uppercase",
  },
  occupancyBar: {
    backgroundColor: COLORS.brandDeep,
    borderColor: COLORS.brandDeep,
    borderRadius: 12,
    borderWidth: 2,
    flexDirection: "row",
    height: 56,
    overflow: "hidden",
  },
  occupancyHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  occupancyLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.lg,
  },
  occupancyPanel: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brandDeep,
    borderRadius: 12,
    borderWidth: 2,
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  occupancyValue: {
    color: COLORS.canvas,
    fontFamily: "Fraunces-Regular",
    fontSize: 64,
  },
  occupiedSegment: {
    backgroundColor: COLORS.copper,
  },
  panelLabel: {
    color: COLORS.canvas,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 22,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  statusMeta: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.xs,
  },
  statusMarker: {
    borderWidth: 4,
  },
  statusMarkerBed: {
    borderRadius: 5,
    height: 18,
    width: 34,
  },
  statusMarkerDefault: {
    height: 22,
    width: 22,
  },
  waitingCard: {
    backgroundColor: COLORS.brandDeep,
    borderRadius: 12,
    borderWidth: 3,
    flexGrow: 1,
    minHeight: 128,
    minWidth: 240,
    padding: SPACING.lg,
  },
  waitingCase: {
    color: COLORS.canvas,
    fontFamily: "Fraunces-Regular",
    fontSize: 34,
  },
  waitingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
  },
  waitingLane: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brandDeep,
    borderRadius: 12,
    borderWidth: 2,
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  waitingMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
});

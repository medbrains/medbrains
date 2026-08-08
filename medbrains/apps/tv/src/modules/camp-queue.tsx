/**
 * TV → outreach camp board. Every consultation room and service counter for
 * one camp, with who is on duty and what each is serving. Deep-link:
 *   medbrains://tv/camp-queue
 *
 * Unlike the hospital boards this is one card per station rather than a list of
 * tokens: at a camp one patient walks between stations in a single visit, so a
 * waiting area needs "which room is serving what", not one long queue.
 */

import type { Module } from "@medbrains/mobile-shell";
import { type CampBoardRow, TOKEN_BOARD_SURFACES } from "@medbrains/types";
import { COLORS, SPACING } from "@medbrains/ui-mobile";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { TvBoard, TvSummaryRow } from "../components/tv-board.js";
import { TvFeedStatusBanner, tvTokenBoardReadinessItems } from "../components/tv-feed-status.js";
import {
  tvTokenBoardFeedErrorLabel,
  tvTokenBoardLoadingLabel,
  tvTokenBoardSubtitle,
  tvTokenBoardUnavailableMessage,
  tvTokenBoardUnavailableTitle,
} from "../components/tv-i18n.js";
import { tvQueueService } from "../services/tvQueue.service.js";

const CAMP_BOARD = TOKEN_BOARD_SURFACES.camp;
const REFRESH_INTERVAL_MS = CAMP_BOARD.refreshIntervalMs;

/** The camp this display is showing, set when the device is paired to a camp. */
function campIdForDevice(): string | null {
  return process.env.EXPO_PUBLIC_CAMP_ID ?? null;
}

function StationCard({ station }: { station: CampBoardRow }) {
  const serving = station.serving.length > 0 ? station.serving.join("  ") : "—";
  const place = [station.counter_name, station.location_label].filter(Boolean).join(" · ");

  return (
    <View style={styles.card}>
      <Text numberOfLines={1} style={styles.department}>
        {station.department}
      </Text>
      {place.length > 0 && (
        <Text numberOfLines={1} style={styles.place}>
          {place}
        </Text>
      )}

      <Text
        numberOfLines={1}
        style={[styles.serving, station.serving.length === 0 && styles.servingIdle]}
      >
        {serving}
      </Text>

      {station.staff.length > 0 && (
        <Text numberOfLines={2} style={styles.staff}>
          {station.staff.join(", ")}
        </Text>
      )}

      <View style={styles.counts}>
        <Text style={styles.count}>{station.waiting} waiting</Text>
        <Text style={styles.count}>{station.completed} seen</Text>
      </View>
    </View>
  );
}

function CampQueueScreen() {
  const campId = campIdForDevice();

  const { data, isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ["tv", "camp-board", campId],
    queryFn: () => tvQueueService.getCampBoard(campId as string),
    enabled: Boolean(campId),
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  // Paired to no camp: say so rather than showing an empty board that looks
  // like a quiet day.
  if (!campId) {
    return (
      <TvBoard
        eyebrow="CAMP"
        privacyNotice={CAMP_BOARD.privacyNotice}
        subtitle={tvTokenBoardSubtitle(CAMP_BOARD.id)}
        title={tvTokenBoardUnavailableTitle(CAMP_BOARD.id)}
      >
        <Text style={styles.notice}>{tvTokenBoardUnavailableMessage(CAMP_BOARD.id)}</Text>
      </TvBoard>
    );
  }

  const stations: ReadonlyArray<CampBoardRow> = data ?? [];
  const total = (key: "completed" | "waiting") =>
    stations.reduce((sum, station) => sum + station[key], 0);

  return (
    <TvBoard
      eyebrow="CAMP"
      privacyNotice={CAMP_BOARD.privacyNotice}
      readiness={tvTokenBoardReadinessItems({
        isError,
        surface: CAMP_BOARD,
        updatedAt: dataUpdatedAt,
      })}
      subtitle={tvTokenBoardSubtitle(CAMP_BOARD.id)}
      title={CAMP_BOARD.title}
    >
      <TvFeedStatusBanner
        errorLabel={tvTokenBoardFeedErrorLabel(CAMP_BOARD.id)}
        isError={isError}
        lastUpdatedAt={dataUpdatedAt}
        refreshIntervalMs={REFRESH_INTERVAL_MS}
      />

      {isLoading && (
        <View style={styles.loading}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>{tvTokenBoardLoadingLabel(CAMP_BOARD.id)}</Text>
        </View>
      )}

      <TvSummaryRow
        items={[
          { label: "Waiting", value: String(total("waiting")) },
          { label: "Seen", value: String(total("completed")) },
          { label: "Stations", value: String(stations.length) },
        ]}
      />

      <View style={styles.grid}>
        {stations.map((station) => (
          <StationCard key={station.department_id} station={station} />
        ))}
      </View>
    </TvBoard>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.brand,
    flexBasis: "31%",
    flexGrow: 1,
    gap: SPACING.xs,
    padding: SPACING.md,
  },
  count: {
    color: COLORS.tint,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 16,
    textTransform: "uppercase",
  },
  counts: {
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
    marginTop: SPACING.xs,
  },
  department: {
    color: COLORS.canvas,
    fontFamily: "Fraunces-Regular",
    fontSize: 26,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
  },
  loading: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  loadingText: {
    color: COLORS.tint,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 18,
  },
  notice: {
    color: COLORS.tint,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 20,
  },
  place: {
    color: COLORS.tint,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 15,
    textTransform: "uppercase",
  },
  serving: {
    color: COLORS.emerald,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 52,
  },
  servingIdle: {
    color: COLORS.tint,
  },
  staff: {
    color: COLORS.canvas,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 16,
  },
});

export const campQueueModule: Module = {
  id: "camp-queue",
  displayName: CAMP_BOARD.title,
  icon: () => null,
  requiredPermissions: [],
  requiredAnyPermissions: CAMP_BOARD.requiredAnyPermissions,
  navigator: CampQueueScreen,
  appCodes: CAMP_BOARD.targets.tvAppCodes,
  tags: ["tv", "camp", "outreach", "queue"],
};

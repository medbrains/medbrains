/**
 * TV -> nursing-station call board.
 *
 * The bedside tablet could always raise a call; until this board the only way
 * to read one back was per-admission, which means already knowing who is
 * calling. This is the screen that makes the button worth pressing.
 *
 * Deep-link: medbrains://tv/nurse-calls
 *
 * # What is on it, and what is not
 *
 * Bed, request type and how long. No name, no UHID, and not the free text the
 * patient typed — "pain, left side, since 2am" is a clinical note, and a
 * nursing station is a corridor with a screen in it. The nurse's phone shows
 * the note; the wall does not.
 *
 * Escalation is a colour AND a word. At ten feet, on a panel nobody
 * calibrated, colour alone is not a signal (WCAG 2.2 1.4.1).
 */

import type { Module } from "@medbrains/mobile-shell";
import { type ActiveNurseCall, overdueNurseCalls, P } from "@medbrains/types";
import { COLORS, OVERSCAN, SPACING } from "@medbrains/ui-mobile";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { TvBoard, TvSummaryRow } from "../components/tv-board.js";
import { TvFeedStatusBanner, tvFeedReadiness } from "../components/tv-feed-status.js";
import {
  tvNurseCallEscalationLabel,
  tvNurseCallSummaryLabel,
  tvNurseCallsText,
  tvNurseCallWaiting,
} from "../components/tv-i18n.js";
import { tvQueueService } from "../services/tvQueue.service.js";

/**
 * Ten seconds. A call board is the one screen where the refresh interval is a
 * clinical number: it is the floor on how long a patient waits between
 * pressing the button and anyone seeing it.
 */
const REFRESH_INTERVAL_MS = 10_000;

/**
 * A wall fits twelve cards before they stop being readable across a corridor.
 * The server already caps at 200; this is the display's own limit, and the
 * summary row above keeps the true count visible so twelve never reads as
 * "that's all of them".
 */
const DISPLAY_LIMIT = 12;

const ESCALATION_COLOR = {
  charge_nurse: COLORS.amber,
  normal: COLORS.emerald,
  supervisor: COLORS.red,
} as const;

const REQUEST_TYPE_LABEL: Readonly<Record<string, string>> = {
  bathroom_assist: "Bathroom",
  blanket_pillow: "Blanket / pillow",
  nurse_call: "Nurse call",
  other: "Assistance",
  pain_management: "Pain",
  position_change: "Reposition",
  water_food: "Water / food",
};

function requestTypeLabel(requestType: string): string {
  return REQUEST_TYPE_LABEL[requestType] ?? "Assistance";
}

interface NurseCallsScreenProps {
  route?: { params?: { ward?: string; wardId?: string; ward_id?: string } };
}

function NurseCallsScreen({ route }: NurseCallsScreenProps) {
  const wardId = route?.params?.wardId ?? route?.params?.ward_id ?? route?.params?.ward;

  const boardQuery = useQuery({
    queryKey: ["tv", "nurse-calls", wardId ?? "all"],
    queryFn: () => tvQueueService.getNurseCallBoard(wardId),
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const board = boardQuery.data;

  // Rows arrive oldest-first from the server, so the longest wait is the head
  // and "overdue" is a count, not a scan. No sorting on the device.
  const summary = useMemo(() => {
    const calls = board?.calls ?? [];
    return {
      longestWait: calls[0]?.waiting_seconds ?? 0,
      open: calls.length,
      overdue: overdueNurseCalls(calls).length,
      shown: calls.slice(0, DISPLAY_LIMIT),
    };
  }, [board]);

  return (
    <TvBoard
      eyebrow={tvNurseCallsText("eyebrow")}
      title={tvNurseCallsText("title")}
      subtitle={tvNurseCallsText("subtitle")}
      privacyNotice={tvNurseCallsText("privacyNotice")}
      readiness={[
        tvFeedReadiness(boardQuery.isError, boardQuery.dataUpdatedAt, REFRESH_INTERVAL_MS),
      ]}
    >
      <TvSummaryRow
        items={[
          { label: tvNurseCallSummaryLabel("open"), value: String(summary.open) },
          { label: tvNurseCallSummaryLabel("overdue"), value: String(summary.overdue) },
          {
            label: tvNurseCallSummaryLabel("longestWait"),
            value: summary.open === 0 ? "—" : tvNurseCallWaiting(summary.longestWait),
          },
        ]}
      />
      <TvFeedStatusBanner
        errorLabel={tvNurseCallsText("feedError")}
        isError={boardQuery.isError}
        lastUpdatedAt={boardQuery.dataUpdatedAt}
        refreshIntervalMs={REFRESH_INTERVAL_MS}
      />
      {boardQuery.isLoading ? (
        <View style={styles.centerPanel}>
          <ActivityIndicator size="large" color={COLORS.emerald} />
          <Text style={styles.loadingText}>{tvNurseCallsText("loading")}</Text>
        </View>
      ) : boardQuery.isError && !board ? (
        // Only when nothing has ever loaded. A board that has shown calls keeps
        // showing them: an unanswered call that has gone stale still means
        // somebody pressed a button, and an error page means nobody goes.
        <View style={styles.centerPanel}>
          <Text style={styles.errorTitle}>{tvNurseCallsText("unavailableTitle")}</Text>
          <Text style={styles.errorText}>{tvNurseCallsText("unavailableMessage")}</Text>
        </View>
      ) : summary.open === 0 ? (
        <View style={styles.centerPanel}>
          <Text style={styles.quietText}>{tvNurseCallsText("empty")}</Text>
        </View>
      ) : (
        <View style={styles.callGrid}>
          {summary.shown.map((call) => (
            <CallCard call={call} key={call.id} />
          ))}
        </View>
      )}
    </TvBoard>
  );
}

function CallCard({ call }: { call: ActiveNurseCall }) {
  const accent = ESCALATION_COLOR[call.escalation];

  return (
    <View style={[styles.callCard, { borderColor: accent }]}>
      <View style={styles.callHeader}>
        <Text style={styles.bedNumber}>{call.bed_number ?? tvNurseCallsText("unassignedBed")}</Text>
        <Text style={[styles.escalation, { color: accent }]}>
          {tvNurseCallEscalationLabel(call.escalation)}
        </Text>
      </View>
      <Text style={styles.requestType}>{requestTypeLabel(call.request_type)}</Text>
      <Text style={[styles.waiting, { color: accent }]}>
        {tvNurseCallWaiting(call.waiting_seconds)}
      </Text>
      <Text style={styles.wardName}>
        {call.ward_name ?? ""}
        {/* Acknowledged is not answered. The clock keeps running and the card
            keeps its escalation colour; "Seen" only says somebody looked. */}
        {call.acknowledged_at ? `  ·  ${tvNurseCallsText("seen")}` : ""}
      </Text>
    </View>
  );
}

export const nurseCallsModule: Module = {
  id: "nurse-calls",
  displayName: tvNurseCallsText("displayName"),
  icon: () => null,
  requiredPermissions: [],
  requiredAnyPermissions: [P.BEDSIDE.CALLS_BOARD],
  navigator: NurseCallsScreen,
  appCodes: ["TV-Ward", "TV-ICU"],
  tags: ["tv", "ipd", "nursing", "nurse-call", "ward"],
};

const styles = StyleSheet.create({
  bedNumber: {
    color: COLORS.canvas,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 44,
  },
  callCard: {
    borderLeftWidth: 8,
    borderWidth: 2,
    minWidth: 300,
    padding: SPACING.lg,
  },
  callGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.lg,
  },
  callHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
    justifyContent: "space-between",
  },
  centerPanel: {
    alignItems: "center",
    flex: 1,
    gap: SPACING.md,
    justifyContent: "center",
    paddingVertical: OVERSCAN.vertical,
  },
  errorText: {
    color: COLORS.tint,
    fontSize: 24,
  },
  errorTitle: {
    color: COLORS.canvas,
    fontSize: 40,
  },
  escalation: {
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 20,
    letterSpacing: 2,
  },
  loadingText: {
    color: COLORS.tint,
    fontSize: 26,
  },
  quietText: {
    color: COLORS.tint,
    fontSize: 34,
  },
  requestType: {
    color: COLORS.canvas,
    fontSize: 28,
    marginTop: SPACING.sm,
  },
  waiting: {
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 34,
    marginTop: SPACING.sm,
  },
  wardName: {
    color: COLORS.tint,
    fontSize: 20,
    marginTop: SPACING.sm,
  },
});

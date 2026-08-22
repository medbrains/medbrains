/**
 * TV → consulting-room door display.
 *
 * Per-display deep link:
 *   medbrains://tv/doctor-room?department=<uuid>&room=Room%203
 *
 * A corridor screen answering one question — may I go in? — so it shows one
 * number the size of the door and nothing else. Everything a waiting-hall board
 * needs (next tokens, averages, missed lane) is noise here: the patient reading
 * this is standing three feet away, deciding whether to knock.
 *
 * ## Why this could not be built before
 *
 * OPD check-in used to write three parallel queues that advanced independently.
 * A door display had to pick one, and whichever it picked disagreed with either
 * the doctor or the waiting room. Now that the doctor advances the same
 * `tokens` rows the hall board reads, a door can be built that agrees with
 * both. See `medbrains-tokens` and the OPD board module next door.
 *
 * ## Token only, deliberately
 *
 * The backlog row asks for `Current Token | Patient Name | "Please Enter"`. A
 * corridor is a public place and the OPD surface is declared
 * `token_only_public`, so the name is withheld and the row ships Partial. A
 * display that reads out who is with the doctor tells everyone waiting who is
 * being seen for what, which is the thing the privacy notice exists to prevent.
 *
 * ## Rooms
 *
 * `room` matches `counter_label` — the room a token was called to. Where a
 * department has one consulting room, omit it and the department's current
 * token is the room's. Where it has several, the doctor's call must carry the
 * room, or this door has nothing to match and correctly shows "please wait"
 * rather than a neighbour's number.
 */

import type { Module } from "@medbrains/mobile-shell";
import { currentRoomToken, TOKEN_BOARD_SURFACES } from "@medbrains/types";
import { COLORS, OVERSCAN, SPACING } from "@medbrains/ui-mobile";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { TvFeedStatusBanner } from "../components/tv-feed-status.js";
import { tvTokenBoardFeedErrorLabel } from "../components/tv-i18n.js";
import { tvQueueService } from "../services/tvQueue.service.js";

const OPD_BOARD = TOKEN_BOARD_SURFACES.opd;
const REFRESH_INTERVAL_MS = OPD_BOARD.refreshIntervalMs;
/** Enough to place yourself in the queue, few enough to read at a glance. */
const NEXT_TOKEN_LIMIT = 3;

interface DoctorRoomScreenProps {
  route?: {
    params?: {
      departmentId?: string;
      department_id?: string;
      department?: string;
      room?: string;
      doctorName?: string;
      doctor_name?: string;
    };
  };
}

function DoctorRoomScreen({ route }: DoctorRoomScreenProps) {
  const params = route?.params;
  const departmentId = params?.departmentId ?? params?.department_id ?? params?.department;
  const room = params?.room;
  const doctorName = params?.doctorName ?? params?.doctor_name;

  const scope = departmentId ? { scope: "department", scope_id: departmentId } : {};
  const tokensQuery = useQuery({
    queryKey: ["tv", "doctor-room", departmentId ?? "all", room ?? "any"],
    // `include_finished` stays off: a door shows who is in the room now, and a
    // completed token is somebody who has already left.
    queryFn: () => tvQueueService.listOpdBoard({ ...scope, module: "opd" }),
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  // Last-good on purpose. If the feed drops, the door keeps the number it had
  // and the banner says the feed is quiet; blanking it would send the patient
  // in the room back to the desk to ask whether they had been called.
  const current = currentRoomToken(tokensQuery.data ?? [], room);
  const inRoom = current !== null;

  // The next few, so somebody in the corridor can tell whether they are about
  // to be called or have time to sit down. Department-wide rather than
  // room-filtered on purpose: a waiting token has not been called anywhere yet,
  // so it has no room to match against.
  const upNext = (tokensQuery.data ?? [])
    .filter((token) => token.status === "waiting")
    .slice(0, NEXT_TOKEN_LIMIT);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{room ?? OPD_BOARD.title}</Text>
        {doctorName ? <Text style={styles.doctor}>{doctorName}</Text> : null}
      </View>

      <View style={styles.stage}>
        {inRoom ? (
          <>
            <Text style={styles.tokenLabel}>TOKEN</Text>
            <Text
              // Announced as a sentence rather than a bare number: a screen
              // reader saying "418" outside a door means nothing on its own.
              accessibilityLabel={`Token ${current.number}, please enter${room ? `, ${room}` : ""}`}
              style={styles.tokenNumber}
            >
              {current.number}
            </Text>
            <Text style={styles.callToAction}>PLEASE ENTER</Text>
          </>
        ) : (
          <>
            <Text
              accessibilityLabel="No patient has been called. Please wait to be called."
              style={styles.waitingHeadline}
            >
              PLEASE WAIT
            </Text>
            <Text style={styles.waitingSubtitle}>You will be called by token number.</Text>
          </>
        )}
      </View>

      {upNext.length > 0 ? (
        <View style={styles.nextStrip}>
          <Text style={styles.nextLabel}>NEXT</Text>
          <View
            accessibilityLabel={`Next tokens: ${upNext.map((token) => token.number).join(", ")}`}
            style={styles.nextTokens}
          >
            {upNext.map((token) => (
              <Text key={token.id} style={styles.nextToken}>
                {token.number}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.footer}>
        <TvFeedStatusBanner
          errorLabel={tvTokenBoardFeedErrorLabel(OPD_BOARD.id)}
          isError={tokensQuery.isError}
          lastUpdatedAt={tokensQuery.dataUpdatedAt}
          refreshIntervalMs={REFRESH_INTERVAL_MS}
        />
        <Text style={styles.privacy}>{OPD_BOARD.privacyNotice}</Text>
      </View>
    </View>
  );
}

export const doctorRoomModule: Module = {
  id: "doctor-room",
  displayName: "Doctor room door",
  icon: () => null,
  requiredPermissions: [],
  requiredAnyPermissions: OPD_BOARD.requiredAnyPermissions,
  navigator: DoctorRoomScreen,
  // Already declared on the OPD surface as a target before any screen existed.
  appCodes: ["TV-DoctorRoom"],
  tags: ["tv", "opd", "door", "tokens", "token-only"],
};

const styles = StyleSheet.create({
  callToAction: {
    color: COLORS.emerald,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 40,
    letterSpacing: 6,
    marginTop: SPACING.md,
  },
  doctor: {
    color: COLORS.canvas,
    fontFamily: "Fraunces-Regular",
    fontSize: 40,
  },
  eyebrow: {
    color: COLORS.copper,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 28,
    letterSpacing: 4,
    textTransform: "uppercase",
  },
  footer: {
    gap: SPACING.sm,
  },
  header: {
    gap: SPACING.xs,
  },
  nextLabel: {
    color: COLORS.copper,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 24,
    letterSpacing: 6,
  },
  nextStrip: {
    alignItems: "center",
    borderTopColor: COLORS.brand,
    borderTopWidth: 2,
    gap: SPACING.sm,
    // Clear of the call-to-action above: at a tighter spacing "PLEASE ENTER"
    // sat across the rule, which reads as struck through.
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
  },
  nextToken: {
    color: COLORS.canvas,
    fontFamily: "Fraunces-Regular",
    fontSize: 44,
  },
  nextTokens: {
    flexDirection: "row",
    gap: SPACING.lg,
  },
  privacy: {
    color: COLORS.muted,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 16,
  },
  screen: {
    backgroundColor: COLORS.brandDeep,
    flex: 1,
    gap: SPACING.sm,
    justifyContent: "center",
    // Overscan safe area: a TV crops the edges, and a number half off the
    // panel is the one thing this screen exists to show.
    paddingHorizontal: OVERSCAN.horizontal,
    paddingVertical: OVERSCAN.vertical,
  },
  stage: {
    alignItems: "center",
    // Neither grow nor shrink. `flex: 1` let the stage claim the strip's space
    // and draw over it; `flexShrink: 1` then compressed the stage below its own
    // content height, so the call-to-action spilled past its bounds and the
    // strip's rule was drawn straight through the middle of "PLEASE ENTER".
    flexShrink: 0,
    justifyContent: "center",
    paddingVertical: SPACING.xs,
  },
  tokenLabel: {
    color: COLORS.copper,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 32,
    letterSpacing: 8,
  },
  tokenNumber: {
    color: COLORS.canvas,
    fontFamily: "Fraunces-Regular",
    // Read from across a corridor, which is what a 10-foot UI means here.
    // Sized to leave room for the next-token strip: at 260 the number ran off
    // the top of a 1080p panel and printed over the strip below it.
    fontSize: 128,
    lineHeight: 140,
  },
  waitingHeadline: {
    color: COLORS.canvas,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 96,
    letterSpacing: 8,
  },
  waitingSubtitle: {
    color: COLORS.muted,
    fontFamily: "Inter-Regular",
    fontSize: 32,
    marginTop: SPACING.md,
  },
});

// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  currentRoomToken,
  MISSED_TOKEN_BOARD_WINDOW_MINUTES,
  type MissableToken,
  recentlyMissedTokens,
} from "./token-board-surfaces";

/**
 * Which tokens a board announces as missed — GitHub #1531.
 *
 * Marking a no-show worked all along, but the board bucketed tokens into
 * called / waiting / completed, so a missed number matched nothing and simply
 * disappeared. The patient who stepped out for five minutes came back to a
 * screen that had forgotten them.
 *
 * The judgement here is what *not* to show: a cancelled token is not a missed
 * one, and a list carrying the whole day's no-shows says nothing at all.
 */

const NOW = Date.parse("2026-07-29T10:00:00Z");

const token = (over: Partial<MissableToken> = {}): MissableToken => ({
  status: "no_show",
  completed_at: "2026-07-29T09:58:00Z",
  ...over,
});

const minutesAgo = (n: number) => new Date(NOW - n * 60_000).toISOString();

describe("recentlyMissedTokens", () => {
  it("shows a token missed moments ago", () => {
    expect(recentlyMissedTokens([token()], NOW)).toHaveLength(1);
  });

  it("drops one missed longer ago than the window", () => {
    const stale = token({
      completed_at: minutesAgo(MISSED_TOKEN_BOARD_WINDOW_MINUTES + 1),
    });
    expect(recentlyMissedTokens([stale], NOW)).toEqual([]);
  });

  it("keeps one missed right at the edge of the window", () => {
    const edge = token({ completed_at: minutesAgo(MISSED_TOKEN_BOARD_WINDOW_MINUTES) });
    expect(recentlyMissedTokens([edge], NOW)).toHaveLength(1);
  });

  // A cancellation is somebody's deliberate act. Announcing it as missed sends
  // a patient to the desk to ask about a token that was withdrawn on purpose.
  it("never announces a cancelled token as missed", () => {
    const cancelled = token({ status: "cancelled" });
    expect(recentlyMissedTokens([cancelled], NOW)).toEqual([]);
  });

  it("ignores tokens still in the queue", () => {
    const live = [token({ status: "waiting" }), token({ status: "called" })];
    expect(recentlyMissedTokens(live, NOW)).toEqual([]);
  });

  // Without a time there is no telling a call missed a minute ago from one
  // missed at eight this morning.
  it("skips a no-show carrying no timestamp", () => {
    expect(recentlyMissedTokens([token({ completed_at: null })], NOW)).toEqual([]);
  });

  // The board DTO omits the field rather than sending null, so `undefined` is
  // the shape this actually meets in production.
  it("skips a no-show whose timestamp is absent rather than null", () => {
    expect(recentlyMissedTokens([token({ completed_at: undefined })], NOW)).toEqual([]);
  });

  it("skips a no-show whose timestamp will not parse", () => {
    expect(recentlyMissedTokens([token({ completed_at: "not a date" })], NOW)).toEqual([]);
  });

  it("returns nothing when nobody has been missed", () => {
    expect(recentlyMissedTokens([], NOW)).toEqual([]);
  });

  it("keeps the caller's own token fields intact", () => {
    const rows = [{ ...token(), token_number: "CARD-014" }];
    expect(recentlyMissedTokens(rows, NOW)[0]?.token_number).toBe("CARD-014");
  });
});

describe("currentRoomToken", () => {
  const called = (counter_label: string | null, called_at: string, status = "called") => ({
    called_at,
    counter_label,
    status,
  });

  it("shows the token called to this room", () => {
    const token = currentRoomToken(
      [called("Room 2", "2026-08-22T09:00:00Z"), called("Room 3", "2026-08-22T09:05:00Z")],
      "Room 3",
    );
    expect(token?.counter_label).toBe("Room 3");
  });

  it("shows nothing rather than a neighbouring room's token", () => {
    // The failure that matters: a door showing the next room's number sends
    // the patient into the wrong consultation.
    expect(currentRoomToken([called("Room 2", "2026-08-22T09:00:00Z")], "Room 3")).toBeNull();
  });

  it("treats a missing room as the whole department, for single-room clinics", () => {
    expect(currentRoomToken([called("Room 2", "2026-08-22T09:00:00Z")], undefined)).not.toBeNull();
    expect(currentRoomToken([called(null, "2026-08-22T09:00:00Z")], "  ")).not.toBeNull();
  });

  it("matches a room name however it was typed", () => {
    expect(currentRoomToken([called(" room 3 ", "2026-08-22T09:00:00Z")], "Room 3")).not.toBeNull();
  });

  it("counts serving as in the room, and nothing else", () => {
    expect(
      currentRoomToken([called("Room 3", "2026-08-22T09:00:00Z", "serving")], "Room 3"),
    ).not.toBeNull();
    for (const status of ["waiting", "completed", "no_show", "cancelled"]) {
      expect(
        currentRoomToken([called("Room 3", "2026-08-22T09:00:00Z", status)], "Room 3"),
        status,
      ).toBeNull();
    }
  });

  it("shows the most recent call, so the door does not lag a patient behind", () => {
    const token = currentRoomToken(
      [
        called("Room 3", "2026-08-22T09:00:00Z"),
        called("Room 3", "2026-08-22T09:30:00Z"),
        called("Room 3", "2026-08-22T09:15:00Z"),
      ],
      "Room 3",
    );
    expect(token?.called_at).toBe("2026-08-22T09:30:00Z");
  });

  it("never lets an undated call take the door from a dated one", () => {
    const token = currentRoomToken(
      [
        { called_at: null, counter_label: "Room 3", status: "called" },
        called("Room 3", "2026-08-22T09:00:00Z"),
      ],
      "Room 3",
    );
    expect(token?.called_at).toBe("2026-08-22T09:00:00Z");
  });

  it("says nothing is in the room when the queue is empty", () => {
    expect(currentRoomToken([], "Room 3")).toBeNull();
  });
});

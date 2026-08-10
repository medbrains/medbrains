// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
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

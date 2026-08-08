import { describe, expect, it } from "vitest";
import { byToken, countQueue, isOpen, isWaiting, nextToCall } from "./queue-order.js";

const entry = (token_number: number, status = "waiting", called_at: string | null = null) => ({
  id: `t${token_number}`,
  token_number,
  status,
  called_at,
});

describe("byToken", () => {
  it("orders by the number on the slip", () => {
    expect(byToken([entry(12), entry(3), entry(7)]).map((e) => e.token_number)).toEqual([3, 7, 12]);
  });

  it("does not mutate the caller's array", () => {
    const input = [entry(9), entry(2)];
    byToken(input);
    expect(input.map((e) => e.token_number)).toEqual([9, 2]);
  });
});

describe("nextToCall", () => {
  it("is the lowest token still waiting", () => {
    expect(nextToCall([entry(5), entry(2), entry(9)])?.token_number).toBe(2);
  });

  it("skips someone already called, even on a lower token", () => {
    // They are in the room, or they did not answer. Calling them again would
    // put them in front of the queue a second time.
    const next = nextToCall([entry(2, "called", "2026-08-08T09:00:00Z"), entry(5)]);
    expect(next?.token_number).toBe(5);
  });

  it("skips completed, cancelled and no-show", () => {
    const next = nextToCall([
      entry(1, "completed"),
      entry(2, "cancelled"),
      entry(3, "no_show"),
      entry(4),
    ]);
    expect(next?.token_number).toBe(4);
  });

  it("is null when nobody is waiting", () => {
    // So the screen says the queue is clear rather than offering a button that
    // would call nobody.
    expect(nextToCall([entry(1, "completed"), entry(2, "in_progress")])).toBeNull();
  });
});

describe("isOpen", () => {
  it("counts someone called or in progress as still open", () => {
    expect(isOpen(entry(1, "called"))).toBe(true);
    expect(isOpen(entry(1, "in_progress"))).toBe(true);
  });

  it("excludes finished and absent patients", () => {
    expect(isOpen(entry(1, "completed"))).toBe(false);
    expect(isOpen(entry(1, "no_show"))).toBe(false);
  });
});

describe("countQueue", () => {
  it("separates waiting from still-open", () => {
    // 'Open' includes people already in a room; 'waiting' is who still needs
    // calling. Conflating them overstates the work left at the desk.
    const counts = countQueue([
      entry(1, "waiting"),
      entry(2, "called"),
      entry(3, "in_progress"),
      entry(4, "completed"),
    ]);
    expect(counts).toEqual({ waiting: 1, open: 3 });
  });

  it("is all zeros for an empty queue", () => {
    expect(countQueue([])).toEqual({ waiting: 0, open: 0 });
  });
});

describe("isWaiting", () => {
  it("is true only for the waiting status", () => {
    expect(isWaiting(entry(1, "waiting"))).toBe(true);
    expect(isWaiting(entry(1, "called"))).toBe(false);
  });
});

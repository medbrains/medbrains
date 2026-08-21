import { describe, expect, it } from "vitest";
import { countQueue, isOpen, isWaiting, nextToCall } from "./queue-order.js";

const entry = (id: string, status = "waiting") => ({ id, status });

describe("nextToCall", () => {
  it("takes the first still waiting, in the order given", () => {
    // The order is the server's, by priority weight then position. Sorting
    // here by the number on the slip is what this used to do, and it would now
    // call a routine patient ahead of an elderly or emergency-referral one.
    expect(nextToCall([entry("a"), entry("b"), entry("c")])?.id).toBe("a");
  });

  it("does not reorder what it was given", () => {
    // A high token first is a priority patient the server put there. Preferring
    // a lower one would undo the decision.
    expect(nextToCall([entry("t99"), entry("t02")])?.id).toBe("t99");
  });

  it("skips someone already called, even though they are first", () => {
    // They are in the room, or they did not answer. Calling them again would
    // put them in front of the queue a second time.
    expect(nextToCall([entry("a", "called"), entry("b")])?.id).toBe("b");
  });

  it("skips completed, cancelled and no-show", () => {
    const next = nextToCall([
      entry("a", "completed"),
      entry("b", "cancelled"),
      entry("c", "no_show"),
      entry("d"),
    ]);
    expect(next?.id).toBe("d");
  });

  it("is null when nobody is waiting", () => {
    // So the screen says the queue is clear rather than offering a button that
    // would call nobody.
    expect(nextToCall([entry("a", "completed"), entry("b", "serving")])).toBeNull();
  });
});

describe("isOpen", () => {
  it("counts someone called or in progress as still open", () => {
    expect(isOpen(entry("t1", "called"))).toBe(true);
    expect(isOpen(entry("t1", "serving"))).toBe(true);
  });

  it("excludes finished and absent patients", () => {
    expect(isOpen(entry("t1", "completed"))).toBe(false);
    expect(isOpen(entry("t1", "no_show"))).toBe(false);
  });
});

describe("countQueue", () => {
  it("separates waiting from still-open", () => {
    // 'Open' includes people already in a room; 'waiting' is who still needs
    // calling. Conflating them overstates the work left at the desk.
    const counts = countQueue([
      entry("t1", "waiting"),
      entry("t2", "called"),
      entry("t3", "serving"),
      entry("t4", "completed"),
    ]);
    expect(counts).toEqual({ waiting: 1, open: 3 });
  });

  it("is all zeros for an empty queue", () => {
    expect(countQueue([])).toEqual({ waiting: 0, open: 0 });
  });
});

describe("isWaiting", () => {
  it("is true only for the waiting status", () => {
    expect(isWaiting(entry("t1", "waiting"))).toBe(true);
    expect(isWaiting(entry("t1", "called"))).toBe(false);
  });
});

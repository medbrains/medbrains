import { describe, expect, it } from "vitest";
import { queueStage, queueWaitLabel } from "./queue-status-model";

describe("queueStage", () => {
  it("maps the statuses a patient can be in", () => {
    expect(queueStage("waiting")).toBe("waiting");
    expect(queueStage("called")).toBe("called");
    expect(queueStage("in_consultation")).toBe("in_consultation");
    expect(queueStage("completed")).toBe("finished");
    expect(queueStage("no_show")).toBe("missed");
  });

  /**
   * The safe direction. A status added to the enum later and not taught to
   * this page must not read as "finished" and send somebody home mid-visit.
   * Being told to keep waiting is wrong in a way a person notices and can
   * correct at the desk.
   */
  it("treats an unknown status as still waiting", () => {
    expect(queueStage("some_future_status")).toBe("waiting");
    expect(queueStage("")).toBe("waiting");
  });
});

describe("queueWaitLabel", () => {
  /**
   * The server sends no estimate when it has no basis for one. Rendering
   * "about 0 minutes" would be a promise the hospital did not make.
   */
  it("says so when there is no estimate", () => {
    const nothing = "We cannot estimate the wait right now";
    expect(queueWaitLabel(null)).toBe(nothing);
    expect(queueWaitLabel(undefined)).toBe(nothing);
    expect(queueWaitLabel(0)).toBe(nothing);
    expect(queueWaitLabel(-5)).toBe(nothing);
  });

  it("reads naturally under an hour", () => {
    expect(queueWaitLabel(1)).toBe("About 1 minute");
    expect(queueWaitLabel(25)).toBe("About 25 minutes");
    expect(queueWaitLabel(59)).toBe("About 59 minutes");
  });

  it("switches to hours rather than showing three digits of minutes", () => {
    expect(queueWaitLabel(60)).toBe("About 1 hour");
    expect(queueWaitLabel(90)).toBe("About 1 hour 30 min");
    expect(queueWaitLabel(120)).toBe("About 2 hours");
    expect(queueWaitLabel(135)).toBe("About 2 hours 15 min");
  });
});

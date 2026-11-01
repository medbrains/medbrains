import type { PostureReport, SecurityCheckStatus } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { ago, checkView, emptyFindingsMessage, postureState, severityView } from "./intel-status";

const NOW = new Date("2026-11-01T12:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

function check(
  every_secs: number,
  last?: { minutes: number; outcome: "ok" | "error" | "not_applicable" },
): SecurityCheckStatus {
  return {
    key: "k",
    label: "Posture",
    every_secs,
    last: last
      ? {
          check_key: "k",
          started_at: minutesAgo(last.minutes),
          finished_at: minutesAgo(last.minutes),
          findings_count: 0,
          outcome: last.outcome,
          error: last.outcome === "error" ? "boom" : null,
          recent_errors: last.outcome === "error" ? 1 : 0,
        }
      : null,
  };
}

describe("severityView", () => {
  it("names severity in words, critical as danger", () => {
    expect(severityView("critical")).toMatchObject({ label: "Critical", tone: "danger" });
    expect(severityView("low").label).toBe("Low");
  });
});

describe("checkView", () => {
  it("is ok within its interval and dates the next run", () => {
    const v = checkView(check(3600, { minutes: 10, outcome: "ok" }), NOW);
    expect(v.state).toBe("ok");
    expect(v.nextDue?.toISOString()).toBe(minutesAgo(10 - 60));
  });

  it("is overdue past twice its interval, even if the last run succeeded", () => {
    expect(checkView(check(3600, { minutes: 121, outcome: "ok" }), NOW).state).toBe("overdue");
    expect(checkView(check(3600, { minutes: 119, outcome: "ok" }), NOW).state).toBe("ok");
  });

  it("reports a failed run as could not run, never as ran", () => {
    expect(checkView(check(300, { minutes: 1, outcome: "error" }), NOW)).toMatchObject({
      state: "failed",
      tone: "danger",
    });
  });

  it("flags a check that never reported", () => {
    expect(checkView(check(60), NOW).state).toBe("never");
  });
});

describe("emptyFindingsMessage", () => {
  it("says nothing found only when every check ran on schedule", () => {
    const fine = [
      check(60, { minutes: 0, outcome: "ok" }),
      check(86400, { minutes: 5, outcome: "not_applicable" }),
    ];
    expect(emptyFindingsMessage(fine, NOW).proven).toBe(true);
  });

  it("does not call an outage all clear", () => {
    const msg = emptyFindingsMessage([check(60, { minutes: 0, outcome: "error" })], NOW);
    expect(msg.proven).toBe(false);
    expect(msg.title).not.toMatch(/^Nothing found/);
  });
});

describe("postureState", () => {
  const report = (minutes: number, outcome: PostureReport["outcome"]): PostureReport => ({
    started_at: minutesAgo(minutes),
    finished_at: minutesAgo(minutes),
    outcome,
    error: null,
    detail: { items: [] },
  });

  it("dates a posture older than two hours as stale", () => {
    expect(postureState(report(30, "ok"), NOW)).toBe("fresh");
    expect(postureState(report(180, "ok"), NOW)).toBe("stale");
    expect(postureState(report(1, "error"), NOW)).toBe("error");
    expect(postureState(null, NOW)).toBe("never");
  });
});

describe("ago", () => {
  it("speaks in minutes, hours and days", () => {
    expect(ago(minutesAgo(12), NOW)).toBe("12 min ago");
    expect(ago(minutesAgo(180), NOW)).toBe("3 h ago");
    expect(ago(minutesAgo(3 * 24 * 60), NOW)).toBe("3 days ago");
  });
});

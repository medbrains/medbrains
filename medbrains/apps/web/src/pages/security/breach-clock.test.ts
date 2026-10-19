import { describe, expect, it } from "vitest";
import { clockState } from "./breach-clock";

const due = "2026-10-12T12:00:00Z";
const at = (iso: string) => Date.parse(iso);

describe("clockState", () => {
  it("does not apply without a deadline", () => {
    expect(clockState("CERT-In", null, null, at(due))).toBeNull();
  });

  it("counts down, and turns red in the last hour", () => {
    expect(clockState("CERT-In", due, null, at("2026-10-12T09:30:00Z"))).toEqual({
      label: "CERT-In",
      text: "2 h 30 min left",
      tone: "warning",
    });
    expect(clockState("CERT-In", due, null, at("2026-10-12T11:15:00Z"))?.tone).toBe("danger");
  });

  it("says how overdue an unfiled clock is", () => {
    expect(clockState("CERT-In", due, null, at("2026-10-12T13:05:00Z"))?.text).toBe(
      "overdue by 1 h 5 min",
    );
  });

  it("a filing stops the clock, and a late one says so", () => {
    expect(clockState("CERT-In", due, "2026-10-12T11:00:00Z", at("2026-10-13T00:00:00Z"))).toEqual({
      label: "CERT-In",
      text: "filed",
      tone: "success",
    });
    expect(clockState("CERT-In", due, "2026-10-12T14:00:00Z", at(due))?.text).toBe(
      "filed 2 h 0 min late",
    );
  });
});

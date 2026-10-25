import { usePermissionStore } from "@medbrains/stores";
import { type ErrorTrackingSummary, P } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { ErrorTrackingSettings } from "./ErrorTrackingSettings";

const getSummary = vi.fn<() => Promise<ErrorTrackingSummary>>();
vi.mock("@/services/errorTracking.service", () => ({
  errorTrackingService: { getSummary: () => getSummary() },
}));

describe("ErrorTrackingSettings", () => {
  beforeEach(() => {
    getSummary.mockReset();
    usePermissionStore.getState().setPermissions("it_admin", [P.ADMIN.ERROR_TRACKING.VIEW]);
  });

  it("shows an outage as unknown counts, never as zero errors", async () => {
    getSummary.mockResolvedValue({
      status: "unavailable",
      reason: "Rustrak did not answer",
      dashboard_url: "https://errors.hims.example.in",
    });
    render(<ErrorTrackingSettings />);
    expect(await screen.findByText(/error counts are unknown/)).toBeInTheDocument();
    expect(screen.queryByText("New issues, last 24 h")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open error tracker/ })).toHaveAttribute(
      "href",
      "https://errors.hims.example.in",
    );
  });

  it("shows our own server not answering as unavailable too", async () => {
    getSummary.mockRejectedValue(new Error("502"));
    render(<ErrorTrackingSettings />);
    expect(await screen.findByText(/error counts are unknown/)).toBeInTheDocument();
  });

  it("shows new issues and the release's crash-free share", async () => {
    getSummary.mockResolvedValue({
      status: "available",
      release: "4f2a9c1d0b3e",
      environment: "prod",
      new_issues_24h: 3,
      events_24h: 40,
      open_issues: 7,
      sessions_24h: 1200,
      crash_free_rate: 0.9975,
      recent_issues: [
        {
          short_id: "MEDBRAINS-9",
          title: "TypeError: x is undefined",
          level: "error",
          event_count: 12,
          last_seen: "2026-10-25T07:00:00Z",
        },
      ],
      dashboard_url: "https://errors.hims.example.in",
    });
    render(<ErrorTrackingSettings />);
    expect(await screen.findByText("99.75%")).toBeInTheDocument();
    expect(screen.getByText("MEDBRAINS-9")).toBeInTheDocument();
    expect(screen.getByText(/Crash-free sessions · 4f2a9c1d0b3e/)).toBeInTheDocument();
  });

  it("says when a release has no sessions rather than claiming 100%", async () => {
    getSummary.mockResolvedValue({
      status: "available",
      release: "4f2a9c1d0b3e",
      environment: "prod",
      new_issues_24h: 0,
      events_24h: 0,
      open_issues: 0,
      sessions_24h: 0,
      crash_free_rate: null,
      recent_issues: [],
      dashboard_url: null,
    });
    render(<ErrorTrackingSettings />);
    expect(await screen.findByText("No sessions yet")).toBeInTheDocument();
  });

  it("does not ask the server without the permission", () => {
    usePermissionStore.getState().setPermissions("it_admin", []);
    render(<ErrorTrackingSettings />);
    expect(getSummary).not.toHaveBeenCalled();
  });
});

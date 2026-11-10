import { ApiError } from "@medbrains/api";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { ReportTile } from "./report-tile";
import type { ReportDefinition } from "./types";

const report: ReportDefinition = {
  id: "opd-registration-arrivals",
  title: "OPD arrivals",
  purpose: "Arrivals by day",
  sourceTables: ["encounters"],
  permissions: ["analytics.view"],
  priority: "P1",
  readiness: "live_api",
  chartTypes: ["line"],
  visualKind: "line",
  refresh: "hourly",
  exports: ["CSV"],
  exportMode: "standard",
  drilldowns: [],
  dataEndpoint: "/api/reports/opd-registration-arrivals/data",
};

const runtimeData = { opdFootfall: [], bedOccupancy: [], noShows: [] };
const loadingState = { opdFootfall: false, bedOccupancy: false, noShows: false };

/** The tile as the reports screen renders it when the report's load failed. */
function renderFailed(error: unknown, retry = vi.fn()) {
  render(
    <ReportTile
      report={report}
      runtimeData={runtimeData}
      loadingState={loadingState}
      failure={{ error, retry }}
      onDetails={vi.fn()}
    />,
  );
  return retry;
}

describe("a report that did not load", () => {
  it("says the report took too long and to narrow the range, never an empty chart", async () => {
    const timeout = new ApiError(
      "This report took too long and was stopped so it cannot slow the wards. Narrow the date range and try again.",
      503,
      { error: "report_timeout" },
    );
    const retry = renderFailed(timeout);
    expect(await screen.findByText("This report didn't load")).toBeInTheDocument();
    expect(screen.getByText(/Narrow the date range/)).toBeInTheDocument();
    expect(screen.queryByText("No data in the last 30 days.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("says the hospital has too many reports running when the server answers 429", async () => {
    renderFailed(
      new ApiError("Too many reports are running for this hospital right now.", 429, {
        error: "too many requests",
      }),
    );
    expect(await screen.findByText(/Too many reports are running/)).toBeInTheDocument();
  });

  it("shows an outage as an outage", async () => {
    renderFailed(new ApiError("database error", 500));
    expect(await screen.findByText(/The server ran into a problem/)).toBeInTheDocument();
  });
});

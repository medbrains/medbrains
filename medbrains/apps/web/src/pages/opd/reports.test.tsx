import type { OpdReportResponse } from "@medbrains/types";
import { P } from "@medbrains/types";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";
import { presetRange } from "./reports-range";

const REPORT: OpdReportResponse = {
  data: {
    totals: { visits: 7, registrations: 3, new_patients: 2, repeat_patients: 5 },
    by_day: [
      { date: "2026-11-16", visits: 4, registrations: 2, new: 1, repeat: 3 },
      { date: "2026-11-17", visits: 3, registrations: 1, new: 1, repeat: 2 },
    ],
    by_doctor: [
      { doctor_id: "6f0c1f2e-8d1a-4c55-9a4e-2b9d1c0e7a11", doctor_name: "Dr Meera", visits: 7 },
    ],
  },
};

let summary: () => Promise<OpdReportResponse> = async () => REPORT;
const summaryCalls = vi.fn();
let allowed = true;
const requirePermission = vi.fn();

vi.mock("@/services/opd.service", () => ({
  opdService: {
    opdReportSummary: (from: string, to: string) => {
      summaryCalls(from, to);
      return summary();
    },
  },
}));
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => allowed,
}));
vi.mock("@/hooks/useRequirePermission", () => ({
  useRequirePermission: (code: string) => requirePermission(code),
}));

const { default: OpdReportsPage } = await import("./reports");

const client = () =>
  new QueryClient({
    queryCache: new QueryCache({ onError: () => {} }),
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

describe("OPD reports", () => {
  beforeEach(() => {
    summary = async () => REPORT;
    allowed = true;
    summaryCalls.mockClear();
    requirePermission.mockClear();
  });

  it("shows the four tiles and both tables from the report", async () => {
    render(<OpdReportsPage />, { queryClient: client() });
    await waitFor(() => expect(screen.getByText("Dr Meera")).toBeInTheDocument());
    expect(screen.getByText("2026-11-16")).toBeInTheDocument();
    expect(screen.getAllByText("7").length).toBeGreaterThan(0);
    expect(screen.getByText("Repeat patients", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download CSV/ })).toBeInTheDocument();
  });

  it("says it couldn't load, and shows no zeros, when the read fails", async () => {
    summary = async () => {
      throw new Error("503 upstream");
    };
    render(<OpdReportsPage />, { queryClient: client() });
    await waitFor(() => expect(screen.getByText("Couldn't load OPD reports")).toBeInTheDocument());
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/ })).toBeInTheDocument();
  });

  it("says so when the range has no visits", async () => {
    summary = async () => ({
      data: {
        totals: { visits: 0, registrations: 0, new_patients: 0, repeat_patients: 0 },
        by_day: [{ date: "2026-11-17", visits: 0, registrations: 0, new: 0, repeat: 0 }],
        by_doctor: [],
      },
    });
    render(<OpdReportsPage />, { queryClient: client() });
    await waitFor(() =>
      expect(screen.getByText("No OPD visits in this range.")).toBeInTheDocument(),
    );
  });

  it("guards the page and never fetches without the permission", async () => {
    allowed = false;
    render(<OpdReportsPage />, { queryClient: client() });
    expect(requirePermission).toHaveBeenCalledWith(P.OPD.REPORTS_VIEW);
    await new Promise((r) => setTimeout(r, 20));
    expect(summaryCalls).not.toHaveBeenCalled();
  });
});

describe("presetRange", () => {
  it("starts the week on Monday and the month on the 1st", () => {
    const tue = new Date(2026, 10, 17);
    expect(presetRange("today", tue)).toEqual({ from: "2026-11-17", to: "2026-11-17" });
    expect(presetRange("week", tue)).toEqual({ from: "2026-11-16", to: "2026-11-17" });
    expect(presetRange("month", tue)).toEqual({ from: "2026-11-01", to: "2026-11-17" });
    expect(presetRange("week", new Date(2026, 10, 22))).toEqual({
      from: "2026-11-16",
      to: "2026-11-22",
    });
  });
});

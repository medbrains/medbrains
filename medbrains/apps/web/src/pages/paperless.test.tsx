import type { PaperlessReport } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { PaperlessPage } from "./paperless";

const api = vi.hoisted(() => ({ getPaperless: vi.fn(), refreshPaperless: vi.fn() }));
vi.mock("@medbrains/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/api")>()),
  api,
}));
vi.mock("@/hooks/useRequirePermission", () => ({ useRequirePermission: () => {} }));

const held = vi.hoisted(() => new Set<string>());
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: (code: string) => held.has(code),
}));

const VIEW = "analytics.paperless.view";
const REFRESH = "analytics.paperless.refresh";

const counts = (created: number, signed: number, scanned = 0) => ({
  created,
  signed,
  scanned,
  printed: 0,
});

const report: PaperlessReport = {
  from: "2026-11-02",
  to: "2026-11-03",
  days: 2,
  measured_days: 1,
  last_counted_at: "2026-11-03T02:00:00Z",
  totals: counts(3, 2, 1),
  digital_pct: 75,
  signed_pct: 200 / 3,
  legal: {
    signed: 0,
    pct: 0,
    provider_connected: false,
    note: "No IT Act signing provider (DSC or Aadhaar eSign) is connected yet.",
  },
  summary:
    "2 of 3 clinical documents made in the system on the days counted were signed digitally (67%).",
  series: [
    { date: "2026-11-02", measured: false, counts: null, digital_pct: null, signed_pct: null },
    {
      date: "2026-11-03",
      measured: true,
      counts: counts(3, 2, 1),
      digital_pct: 75,
      signed_pct: 200 / 3,
    },
  ],
  departments: [
    {
      department_id: "d1",
      name: "Cardiology",
      counts: counts(3, 2, 1),
      digital_pct: 75,
      signed_pct: 200 / 3,
    },
    {
      department_id: "d2",
      name: "Surgery",
      counts: counts(0, 0),
      digital_pct: null,
      signed_pct: null,
    },
  ],
  doc_types: [],
  not_counted: ["MRD physical file requests are not counted yet."],
  could_not_count: [],
};

describe("Analytics → Paperless meter", () => {
  beforeEach(() => {
    held.clear();
    api.getPaperless.mockReset();
    api.refreshPaperless.mockReset();
  });

  it("does not fetch, and offers no recount, without the permissions", () => {
    render(<PaperlessPage />);
    expect(api.getPaperless).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /recount/i })).not.toBeInTheDocument();
  });

  it("shows an outage as unknown, never as 0%", async () => {
    held.add(VIEW);
    api.getPaperless.mockRejectedValue(new Error("down"));
    render(<PaperlessPage />);
    expect(await screen.findByTestId("paperless-error")).toHaveTextContent(/unknown/i);
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("shows the three shares, legal at 0% with its reason, and a department with no documents as none", async () => {
    held.add(VIEW);
    api.getPaperless.mockResolvedValue(report);
    render(<PaperlessPage />);
    expect(await screen.findByTestId("paperless-digital-value")).toHaveTextContent("75%");
    expect(screen.getByTestId("paperless-signed-value")).toHaveTextContent("67%");
    expect(screen.getByTestId("paperless-legal-value")).toHaveTextContent("0%");
    expect(screen.getByTestId("paperless-legal")).toHaveTextContent(/eSign/);
    expect(screen.getByTestId("paperless-summary")).toHaveTextContent(/2 of 3/);
    const surgery = screen.getAllByTestId("paperless-department-row")[1];
    expect(surgery).toHaveTextContent("Surgery");
    expect(surgery).toHaveTextContent("No documents");
    expect(surgery).not.toHaveTextContent("0%");
  });

  it("offers the trend as a table where a day not counted says so", async () => {
    held.add(VIEW);
    api.getPaperless.mockResolvedValue(report);
    render(<PaperlessPage />);
    await userEvent.click(await screen.findByText("Table"));
    const table = screen.getByTestId("paperless-trend-table");
    expect(table).toHaveTextContent("Not counted");
    expect(table).toHaveTextContent("67%");
  });

  it("reads a range never counted as not counted yet, not 0%", async () => {
    held.add(VIEW);
    api.getPaperless.mockResolvedValue({
      ...report,
      measured_days: 0,
      last_counted_at: null,
      totals: counts(0, 0),
      digital_pct: null,
      signed_pct: null,
      legal: { ...report.legal, pct: null },
    });
    render(<PaperlessPage />);
    expect(await screen.findByTestId("paperless-signed-value")).toHaveTextContent(
      "Not counted yet",
    );
    expect(screen.getByTestId("paperless-legal-value")).toHaveTextContent("Not counted yet");
    const surgery = screen.getAllByTestId("paperless-department-row")[1];
    expect(surgery).toHaveTextContent("Not counted");
    expect(surgery).not.toHaveTextContent("No documents");
  });

  it("names a source a recount could not count, rather than reading it as zero", async () => {
    held.add(VIEW);
    api.getPaperless.mockResolvedValue({
      ...report,
      could_not_count: [
        "Vitals entry: could not count (the count failed or ran out of time), on 2 of the days counted; the shares leave it out.",
      ],
    });
    render(<PaperlessPage />);
    expect(await screen.findByTestId("paperless-could-not-count")).toHaveTextContent(
      /Vitals entry: could not count/,
    );
  });

  it("recounts on demand for a holder of the refresh permission", async () => {
    held.add(VIEW);
    held.add(REFRESH);
    api.getPaperless.mockResolvedValue(report);
    api.refreshPaperless.mockResolvedValue({ from: "a", to: "b", rows: 3, skipped: [] });
    render(<PaperlessPage />);
    await userEvent.click(await screen.findByRole("button", { name: /recount last 7 days/i }));
    await waitFor(() => expect(api.refreshPaperless).toHaveBeenCalledTimes(1));
  });
});

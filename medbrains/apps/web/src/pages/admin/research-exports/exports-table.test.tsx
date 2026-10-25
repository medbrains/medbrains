import type { ResearchExport } from "@medbrains/types";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { ExportsTable } from "./exports-table";

const base: ResearchExport = {
  id: "e1",
  dataset: "diagnoses",
  period_from: "2025-04-01",
  period_to: "2026-03-31",
  purpose: "Prevalence of type 2 diabetes among OPD attendees",
  iec_reference: "IEC/2026/041",
  status: "requested",
  requested_by: "maker",
  requested_by_name: "Dr Maker",
  requested_via: "screen",
  decided_by: null,
  decided_by_name: null,
  decided_at: null,
  decision_note: null,
  row_count: null,
  suppressed_rows: null,
  suppression_report: null,
  data_sha256: null,
  ready_at: null,
  expires_at: null,
  created_at: "2026-10-25T10:00:00Z",
};

function show(row: ResearchExport, userId: string) {
  const onDecide = vi.fn();
  const onDownload = vi.fn();
  render(
    <ExportsTable
      exports={[row]}
      isLoading={false}
      error={null}
      userId={userId}
      busy={false}
      onDecide={onDecide}
      onDownload={onDownload}
    />,
  );
  return { onDecide, onDownload };
}

describe("research exports follow maker-checker", () => {
  it("does not let the requester approve their own request", () => {
    show(base, "maker");
    expect(screen.getByText("Needs a second approver")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
  });

  it("lets a second holder approve or reject", async () => {
    const { onDecide } = show(base, "checker");
    await userEvent.click(screen.getByRole("button", { name: /approve/i }));
    expect(onDecide).toHaveBeenCalledWith(base, "approve");
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
  });

  it("offers a ready export's files only to its requester and approver", async () => {
    const ready = {
      ...base,
      status: "ready" as const,
      decided_by: "checker",
      row_count: 1200,
      suppressed_rows: 14,
    };
    const { onDownload } = show(ready, "maker");
    expect(screen.getByText("1,200 (14 suppressed)")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^data$/i }));
    expect(onDownload).toHaveBeenCalledWith(ready, "data");
  });

  it("offers nothing to download to anyone else, or after expiry", () => {
    show({ ...base, status: "ready", decided_by: "checker" }, "someone-else");
    expect(screen.queryByRole("button", { name: /data/i })).not.toBeInTheDocument();
  });

  it("shows an expired export as expired with no download", () => {
    show({ ...base, status: "expired", decided_by: "checker" }, "maker");
    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /data/i })).not.toBeInTheDocument();
  });
});

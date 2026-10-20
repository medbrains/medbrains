import type { DueBill, UpiQrResponse } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { displayLines, useDisplayFeed } from "./customer-display";

const publish = vi.fn();
vi.mock("@medbrains/api", () => ({
  api: { publishCounterDisplayEvent: (...args: unknown[]) => publish(...args) },
}));

const bill = (lanes: DueBill["lanes"], balance: string): DueBill => ({
  invoice_id: crypto.randomUUID(),
  invoice_number: "INV-1",
  status: "issued",
  legal_entity_id: null,
  entity_name: null,
  bill_group_id: null,
  encounter_id: null,
  admission_id: null,
  total_amount: balance,
  paid_amount: "0",
  balance,
  lanes,
  can_collect: true,
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("customer display feed", () => {
  beforeEach(() => {
    publish.mockReset();
    publish.mockResolvedValue({ seq: 1, connected: true });
    useDisplayFeed.setState({ stationId: null, session: null, showQr: true, failed: false });
  });

  it("shows departments and amounts, never bill numbers or items", () => {
    const lines = displayLines([
      bill(["pharmacy"], "400"),
      bill(["pharmacy"], "200.50"),
      bill(["opd", "lab"], "300"),
    ]);
    expect(lines).toEqual([
      { label: "Pharmacy", amount_paise: 60_050 },
      { label: "OPD + Lab", amount_paise: 30_000 },
    ]);
    expect(JSON.stringify(lines)).not.toContain("INV-1");
  });

  it("sends nothing without a counter session, then sends in order with the session", async () => {
    const feed = useDisplayFeed.getState();
    feed.send({ type: "cleared" });
    await flush();
    expect(publish).not.toHaveBeenCalled();

    feed.begin("station-1", "s1");
    feed.send({ type: "session_start", patient_name: "Ravi Kumar" });
    feed.send({ type: "items", lines: [], total_due_paise: 100 });
    await flush();
    await flush();
    expect(publish.mock.calls.map((c) => [c[0], c[1].type, c[1].session])).toEqual([
      ["station-1", "session_start", "s1"],
      ["station-1", "items", "s1"],
    ]);
  });

  it("puts the QR on the display only while the cashier allows it", async () => {
    const qr = { upi_uri: "upi://pay?pa=x@y", image_url: null, close_by: 9 } as UpiQrResponse;
    const feed = useDisplayFeed.getState();
    feed.begin("station-1", "s1");
    feed.setShowQr(false);
    useDisplayFeed.getState().showUpiQr(qr, 600);
    await flush();
    expect(publish).not.toHaveBeenCalled();
    useDisplayFeed.getState().setShowQr(true);
    useDisplayFeed.getState().showUpiQr(qr, 600);
    await flush();
    expect(publish).toHaveBeenCalledWith(
      "station-1",
      expect.objectContaining({ type: "qr_shown", amount_paise: 60_000, close_by: 9 }),
    );
  });

  it("clears only its own session, and says when the display could not be reached", async () => {
    const feed = useDisplayFeed.getState();
    feed.begin("station-1", "s2");
    feed.end("s1");
    await flush();
    expect(publish).not.toHaveBeenCalled();
    publish.mockRejectedValueOnce(new Error("offline"));
    feed.end("s2");
    await flush();
    await flush();
    expect(publish).toHaveBeenCalledWith("station-1", { type: "cleared", session: "s2" });
    expect(useDisplayFeed.getState().failed).toBe(true);
  });
});

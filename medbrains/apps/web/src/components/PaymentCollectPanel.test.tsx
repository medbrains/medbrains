import type { CollectResult } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { buildCollectRequest, makeLine, PaymentCollectPanel } from "./PaymentCollectPanel";

const billing = vi.hoisted(() => ({ collectPayment: vi.fn(), recordPayment: vi.fn() }));
vi.mock("@/services/billing.service", () => ({ billingService: billing }));
vi.mock("./payments/CardTerminalPanel", () => ({ CardTerminalPanel: () => null }));

const DONE: CollectResult = {
  collection_id: "col-1",
  replayed: false,
  total_amount: "500.00",
  station_id: null,
  shift_id: null,
  issued_invoice_ids: [],
  payments: [],
  receipts: [
    {
      id: "r1",
      receipt_number: "RCT/26-27/000001",
      legal_entity_id: "e1",
      entity_name: "Hospital",
      amount: "500.00",
      payment_id: "p1",
      invoice_id: "inv-1",
    },
  ],
};

function renderPanel() {
  const onRecorded = vi.fn();
  const onPrint = vi.fn();
  render(
    <PaymentCollectPanel
      patientId="pat-1"
      invoiceId="inv-1"
      balance={500}
      onRecorded={onRecorded}
      onPrint={onPrint}
    />,
  );
  return { onRecorded, onPrint };
}

async function splitCashAndUpi() {
  const amounts = screen.getAllByLabelText("Amount");
  await userEvent.clear(amounts[0] as HTMLElement);
  await userEvent.type(amounts[0] as HTMLElement, "300");
  await userEvent.click(screen.getByRole("button", { name: "Split payment" }));
  await userEvent.type(screen.getByLabelText("Reference no."), "UTR123");
}

beforeEach(() => vi.clearAllMocks());

describe("PaymentCollectPanel (#4885)", () => {
  it("posts a split as one collection, not one request per line", async () => {
    billing.collectPayment.mockResolvedValue(DONE);
    const { onRecorded, onPrint } = renderPanel();
    await splitCashAndUpi();
    await userEvent.click(screen.getByRole("button", { name: /Record ₹500\.00/ }));

    await waitFor(() => expect(onRecorded).toHaveBeenCalledWith(DONE));
    expect(billing.recordPayment).not.toHaveBeenCalled();
    expect(billing.collectPayment).toHaveBeenCalledTimes(1);
    const sent = billing.collectPayment.mock.calls[0]?.[0];
    expect(sent.invoice_ids).toEqual(["inv-1"]);
    expect(sent.tenders).toEqual([
      { mode: "cash", amount: 300, reference: undefined },
      { mode: "upi", amount: 200, reference: "UTR123" },
    ]);
    // One receipt covering both legs is what prints — not the last leg.
    expect(onPrint).toHaveBeenCalledWith(DONE.receipts);
  });

  it("retries a failed collection under the same key, so it can never post twice", async () => {
    billing.collectPayment.mockRejectedValueOnce(new Error("network")).mockResolvedValue(DONE);
    const { onRecorded } = renderPanel();
    await splitCashAndUpi();
    const record = screen.getByRole("button", { name: /Record ₹500\.00/ });
    await userEvent.click(record);
    await waitFor(() => expect(billing.collectPayment).toHaveBeenCalledTimes(1));
    await userEvent.click(record);
    await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(1));
    const [first, second] = billing.collectPayment.mock.calls.map((c) => c[0].idempotency_key);
    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });

  it("hands a card-machine line over as the approved payment, not a second charge", () => {
    const card = { ...makeLine(500), mode: "card" as const, machineTxnId: "txn-9" };
    const request = buildCollectRequest({ patientId: "p", invoiceId: "i" }, [card], "key-12345");
    expect(request.tenders).toEqual([{ mode: "card", gateway_transaction_id: "txn-9" }]);
  });
});

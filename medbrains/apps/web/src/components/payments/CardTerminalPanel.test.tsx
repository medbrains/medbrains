import type { PaymentTerminal, PosSaleView } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { CardSaleStatus } from "./CardSaleStatus";
import { CardTerminalPanel } from "./CardTerminalPanel";
import { cardSaleSteps } from "./cardSale";

const service = vi.hoisted(() => ({
  listPaymentTerminals: vi.fn(),
  posSale: vi.fn(),
  getCardSale: vi.fn(),
  cancelCardSale: vi.fn(),
}));
vi.mock("@/services/payments.service", () => ({ paymentsService: service }));

const held = vi.hoisted(() => new Set<string>(["billing.payments.create"]));
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasAnyPermission: (codes: string[]) => codes.some((c) => held.has(c)),
}));

vi.mock("@/lib/razorpay-checkout", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/razorpay-checkout")>();
  return {
    ...real,
    pollUntil: <T,>(read: () => Promise<T>, done: (v: T) => boolean) =>
      real.pollUntil(read, done, { sleep: async () => {} }),
  };
});

function machine(over: Partial<PaymentTerminal> = {}): PaymentTerminal {
  return {
    id: "t1",
    tenant_id: "h",
    provider: "simulator",
    kind: "pos",
    station_id: "s1",
    station_name: "Counter 1",
    label: "Counter 1 card machine",
    mode: "sandbox",
    connection: "cloud",
    status: "online",
    is_active: true,
    created_at: "",
    updated_at: "",
    ...over,
  };
}

function sale(over: Partial<PosSaleView>): PosSaleView {
  return {
    transaction_id: "txn-1",
    terminal_id: "t1",
    terminal_label: "Counter 1 card machine",
    invoice_id: "inv-1",
    amount: "500.00",
    approved_amount: null,
    stage: "waiting",
    message: "Waiting for the card — ask the patient to tap, insert or swipe",
    is_final: false,
    reference: null,
    card_last4: null,
    auth_code: null,
    held_for_finance: false,
    created_at: "",
    ...over,
  };
}

const APPROVED = sale({
  stage: "approved",
  is_final: true,
  message: "Approved — ₹500.00 paid by card",
  approved_amount: "500.00",
  reference: "SIM-TXN1",
  card_last4: "4242",
  auth_code: "SIM0K1",
});

function renderPanel() {
  const onApproved = vi.fn();
  const onUseOtherMode = vi.fn();
  render(
    <CardTerminalPanel
      amount={500}
      invoiceId="inv-1"
      onApproved={onApproved}
      onUseOtherMode={onUseOtherMode}
    />,
  );
  return { onApproved, onUseOtherMode };
}

const send = async () =>
  userEvent.click(await screen.findByRole("button", { name: /Send ₹500.00 to Counter 1/ }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("card sale steps", () => {
  it("marks sent, waiting and the result as the machine moves", () => {
    expect(cardSaleSteps("sent").map((s) => s.state)).toEqual(["current", "todo", "todo"]);
    expect(cardSaleSteps("waiting").map((s) => s.state)).toEqual(["done", "current", "todo"]);
    expect(cardSaleSteps("approved").map((s) => s.state)).toEqual(["done", "done", "done"]);
    const declined = cardSaleSteps("declined");
    expect(declined[2]).toEqual({ label: "Declined", state: "failed" });
    expect(cardSaleSteps("timed_out")[2]?.label).toBe("Timed out");
  });
});

describe("CardSaleStatus", () => {
  it("offers cancel while waiting and retry once declined, in plain words", async () => {
    const onCancel = vi.fn();
    const onRetry = vi.fn();
    const { rerender } = render(
      <CardSaleStatus sale={sale({})} onCancel={onCancel} onRetry={onRetry} cancelling={false} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Waiting for the card");
    await userEvent.click(screen.getByRole("button", { name: "Cancel on machine" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Try the card again" })).toBeNull();

    rerender(
      <CardSaleStatus
        sale={sale({ stage: "declined", is_final: true, message: "Declined — no money was taken" })}
        onCancel={onCancel}
        onRetry={onRetry}
        cancelling={false}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Declined — no money was taken");
    expect(screen.queryByRole("button", { name: "Cancel on machine" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Try the card again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("names the card and the approval once approved", () => {
    render(
      <CardSaleStatus sale={APPROVED} onCancel={vi.fn()} onRetry={vi.fn()} cancelling={false} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("card ending 4242 · approval SIM0K1");
  });
});

describe("CardTerminalPanel", () => {
  it("sends the amount to the counter's machine and hands back the approval once", async () => {
    service.listPaymentTerminals.mockResolvedValue([machine()]);
    service.posSale.mockResolvedValue(sale({ stage: "sent", message: "Sending…" }));
    service.getCardSale.mockResolvedValueOnce(sale({})).mockResolvedValueOnce(APPROVED);
    const { onApproved } = renderPanel();
    await send();
    await waitFor(() => expect(onApproved).toHaveBeenCalledTimes(1));
    expect(onApproved).toHaveBeenCalledWith(APPROVED);
    expect(service.posSale).toHaveBeenCalledWith({
      terminal_id: "t1",
      invoice_id: "inv-1",
      amount: 500,
    });
  });

  it("refuses an offline machine up front and offers another way", async () => {
    service.listPaymentTerminals.mockResolvedValue([
      machine({ status: "offline", last_error: "Unplugged (simulator)" }),
    ]);
    const { onUseOtherMode } = renderPanel();
    expect(await screen.findByText("Counter 1 card machine is offline")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Send ₹/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Take it another way" }));
    expect(onUseOtherMode).toHaveBeenCalledTimes(1);
    expect(service.posSale).not.toHaveBeenCalled();
  });

  it("does not call money on the bill that finance is holding", async () => {
    service.listPaymentTerminals.mockResolvedValue([machine()]);
    service.posSale.mockResolvedValue({ ...APPROVED, held_for_finance: true });
    const { onApproved } = renderPanel();
    await send();
    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(onApproved).not.toHaveBeenCalled();
  });

  it("asks which machine when the counter has two", async () => {
    service.listPaymentTerminals.mockResolvedValue([
      machine(),
      machine({ id: "t2", label: "Counter 1 spare machine" }),
    ]);
    renderPanel();
    expect((await screen.findAllByLabelText("Card machine")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Send ₹/ })).toBeNull();
  });

  it("says when the machines could not be loaded rather than showing none", async () => {
    service.listPaymentTerminals.mockRejectedValue(new Error("503"));
    renderPanel();
    expect(await screen.findByText("Card machines could not be loaded")).toBeInTheDocument();
  });
});

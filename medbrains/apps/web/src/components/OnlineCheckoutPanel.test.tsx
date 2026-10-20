import type { PaymentGatewayTransaction } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { OnlineCheckoutPanel } from "./OnlineCheckoutPanel";

const service = vi.hoisted(() => ({
  createPaymentOrder: vi.fn(),
  verifyPayment: vi.fn(),
  getPaymentStatus: vi.fn(),
}));
vi.mock("@/services/payments.service", () => ({ paymentsService: service }));

const checkout = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/lib/razorpay-checkout", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/razorpay-checkout")>();
  return {
    ...real,
    loadRazorpayCheckout: checkout.load,
    // The real backoff, without the real waiting.
    pollUntil: <T,>(read: () => Promise<T>, done: (v: T) => boolean) =>
      real.pollUntil(read, done, { sleep: async () => {} }),
  };
});

const ORDER = {
  transaction_id: "txn-1",
  order_id: "order_TEST1",
  amount: 500,
  currency: "INR",
  key_id: "rzp_test_key",
  status: "created",
};

function txn(status: string): PaymentGatewayTransaction {
  return {
    id: "txn-1",
    status,
    payment_method: "card",
    gateway_payment_id: "pay_1",
  } as PaymentGatewayTransaction;
}

/** A stand-in checkout that either pays at once or is closed by the patient. */
function fakeCheckout(outcome: "pay" | "close") {
  const opened: Record<string, unknown>[] = [];
  const ctor = class {
    constructor(private readonly options: Record<string, unknown>) {
      opened.push(options);
    }
    open() {
      if (outcome === "pay") {
        (this.options.handler as (r: unknown) => void)({
          razorpay_order_id: this.options.order_id,
          razorpay_payment_id: "pay_1",
          razorpay_signature: "sig",
        });
      } else {
        (this.options.modal as { ondismiss: () => void }).ondismiss();
      }
    }
  };
  checkout.load.mockResolvedValue(ctor);
  return opened;
}

function renderPanel() {
  const onCaptured = vi.fn();
  const onUseOtherMode = vi.fn();
  render(
    <OnlineCheckoutPanel
      amount={500}
      formatAmount={(v) => `₹${v.toFixed(2)}`}
      invoiceId="inv-1"
      disabled={false}
      fallbacks={["upi_qr", "cash"]}
      onCaptured={onCaptured}
      onUseOtherMode={onUseOtherMode}
    />,
  );
  return { onCaptured, onUseOtherMode };
}

const pay = () => userEvent.click(screen.getByRole("button", { name: "Pay ₹500.00 Online" }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OnlineCheckoutPanel", () => {
  it("opens checkout on the order the server made and finishes once it is captured", async () => {
    service.createPaymentOrder.mockResolvedValue(ORDER);
    service.verifyPayment.mockResolvedValue(txn("captured"));
    const opened = fakeCheckout("pay");
    const { onCaptured } = renderPanel();
    await pay();
    await waitFor(() => expect(onCaptured).toHaveBeenCalledWith(txn("captured")));
    expect(opened[0]).toMatchObject({
      key: "rzp_test_key",
      order_id: "order_TEST1",
      amount: 50000,
    });
    expect(service.verifyPayment).toHaveBeenCalledWith({
      razorpay_order_id: "order_TEST1",
      razorpay_payment_id: "pay_1",
      razorpay_signature: "sig",
    });
  });

  it("waits on the payment's status when verify cannot confirm it yet", async () => {
    service.createPaymentOrder.mockResolvedValue(ORDER);
    service.verifyPayment.mockResolvedValue(txn("authorized"));
    service.getPaymentStatus
      .mockResolvedValueOnce({ transaction: txn("authorized") })
      .mockResolvedValueOnce({ transaction: txn("captured") });
    fakeCheckout("pay");
    const { onCaptured } = renderPanel();
    await pay();
    await waitFor(() => expect(onCaptured).toHaveBeenCalledTimes(1));
    expect(service.getPaymentStatus).toHaveBeenCalledWith("txn-1");
    expect(service.getPaymentStatus).toHaveBeenCalledTimes(2);
  });

  it("says the money is in but unconfirmed when the status never settles", async () => {
    service.createPaymentOrder.mockResolvedValue(ORDER);
    service.verifyPayment.mockRejectedValue(new Error("Razorpay did not answer"));
    service.getPaymentStatus.mockResolvedValue({ transaction: txn("authorized") });
    fakeCheckout("pay");
    const { onCaptured } = renderPanel();
    await pay();
    expect(await screen.findByText(/has not confirmed it yet/)).toBeInTheDocument();
    expect(onCaptured).not.toHaveBeenCalled();
  });

  it("shows why the order failed and offers the other modes, opening no checkout", async () => {
    service.createPaymentOrder.mockRejectedValue(new Error("Razorpay refused the order: bad key"));
    const opened = fakeCheckout("pay");
    const { onUseOtherMode } = renderPanel();
    await pay();
    expect(await screen.findByText(/Razorpay refused the order: bad key/)).toBeInTheDocument();
    expect(opened).toHaveLength(0);
    expect(service.verifyPayment).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Use UPI QR instead" }));
    expect(onUseOtherMode).toHaveBeenCalledWith("upi_qr");
    await userEvent.click(screen.getByRole("button", { name: "Take cash instead" }));
    expect(onUseOtherMode).toHaveBeenCalledWith("cash");
  });

  it("says so when checkout.js will not load, and posts nothing", async () => {
    service.createPaymentOrder.mockResolvedValue(ORDER);
    checkout.load.mockRejectedValue(new Error("Razorpay checkout could not be loaded"));
    renderPanel();
    await pay();
    expect(await screen.findByText("Razorpay checkout could not be loaded")).toBeInTheDocument();
    expect(service.verifyPayment).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Use UPI QR instead" })).toBeInTheDocument();
  });

  it("takes part of the bill online when the cashier lowers the amount", async () => {
    service.createPaymentOrder.mockResolvedValue({ ...ORDER, amount: 200 });
    service.verifyPayment.mockResolvedValue(txn("captured"));
    const opened = fakeCheckout("pay");
    const { onCaptured } = renderPanel();
    const field = screen.getByLabelText("Amount to collect online");
    await userEvent.clear(field);
    await userEvent.type(field, "200");
    await userEvent.click(screen.getByRole("button", { name: "Pay ₹200.00 Online" }));
    await waitFor(() => expect(onCaptured).toHaveBeenCalledTimes(1));
    expect(service.createPaymentOrder).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 200 }),
    );
    expect(opened[0]).toMatchObject({ amount: 20000 });
  });

  it("refuses more than is due before asking for an order", async () => {
    renderPanel();
    const field = screen.getByLabelText("Amount to collect online");
    await userEvent.clear(field);
    await userEvent.type(field, "600");
    expect(screen.getByText("More than is due on the bill")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay ₹600.00 Online" })).toBeDisabled();
    expect(service.createPaymentOrder).not.toHaveBeenCalled();
  });

  it("tells the cashier when the money is held for finance instead of posted", async () => {
    service.createPaymentOrder.mockResolvedValue(ORDER);
    service.verifyPayment.mockResolvedValue({
      ...txn("captured"),
      notes: { held_for_finance: true },
    });
    fakeCheckout("pay");
    const { onCaptured } = renderPanel();
    await pay();
    expect(await screen.findByText("Payment received, not posted")).toBeInTheDocument();
    expect(onCaptured).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Pay ₹500.00 Online" })).toBeDisabled();
  });

  it("treats a closed checkout as not paid, not as a failure", async () => {
    service.createPaymentOrder.mockResolvedValue(ORDER);
    fakeCheckout("close");
    const { onCaptured } = renderPanel();
    await pay();
    expect(await screen.findByText("Payment not completed")).toBeInTheDocument();
    expect(screen.getByText(/Nothing was charged/)).toBeInTheDocument();
    expect(onCaptured).not.toHaveBeenCalled();
  });
});

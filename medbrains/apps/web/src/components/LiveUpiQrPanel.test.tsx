import type { PaymentGatewayTransaction, UpiQrResponse } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { LiveUpiQrPanel, qrClosed } from "./LiveUpiQrPanel";

const service = vi.hoisted(() => ({ getPaymentStatus: vi.fn() }));
vi.mock("@/services/payments.service", () => ({ paymentsService: service }));

const QR: UpiQrResponse = {
  source: "razorpay",
  upi_uri: null,
  vpa: null,
  amount: 600,
  transaction_ref: "qr_1",
  transaction_id: "txn-1",
  image_url: "https://rzp.io/i/qr_1",
  close_by: 2_000,
  fallback_reason: null,
};

function txn(status: string, notes: Record<string, unknown> = {}) {
  return { id: "txn-1", status, notes, gateway_payment_id: "pay_1" } as PaymentGatewayTransaction;
}

function renderPanel(now: number) {
  const onCaptured = vi.fn();
  const onRenew = vi.fn();
  render(
    <LiveUpiQrPanel
      qr={QR}
      amountText="₹600.00"
      onCaptured={onCaptured}
      onRenew={onRenew}
      now={() => now}
    />,
  );
  return { onCaptured, onRenew };
}

beforeEach(() => vi.clearAllMocks());

describe("LiveUpiQrPanel", () => {
  it("shows Razorpay's QR and finishes once Razorpay confirms it", async () => {
    service.getPaymentStatus.mockResolvedValue({ transaction: txn("captured") });
    const { onCaptured } = renderPanel(1_000);
    expect(screen.getByRole("img", { name: "UPI QR for ₹600.00" })).toHaveAttribute(
      "src",
      "https://rzp.io/i/qr_1",
    );
    await waitFor(() => expect(onCaptured).toHaveBeenCalledWith(txn("captured")));
  });

  it("keeps waiting, without a UTR field, until it is paid", async () => {
    service.getPaymentStatus.mockResolvedValue({ transaction: txn("created") });
    const { onCaptured } = renderPanel(1_000);
    expect(await screen.findByTestId("text-qr-waiting")).toBeInTheDocument();
    expect(screen.queryByLabelText(/UTR/)).not.toBeInTheDocument();
    expect(onCaptured).not.toHaveBeenCalled();
  });

  it("says the money is with finance when it could not post", async () => {
    service.getPaymentStatus.mockResolvedValue({
      transaction: txn("captured", { held_for_finance: true }),
    });
    const { onCaptured } = renderPanel(1_000);
    expect(await screen.findByText("Payment received, not posted")).toBeInTheDocument();
    expect(onCaptured).not.toHaveBeenCalled();
  });

  it("offers a new QR once this one has closed unpaid", async () => {
    service.getPaymentStatus.mockResolvedValue({ transaction: txn("created") });
    const { onRenew } = renderPanel(2_001);
    await userEvent.click(await screen.findByRole("button", { name: "New UPI QR" }));
    expect(onRenew).toHaveBeenCalledTimes(1);
  });

  it("knows when a QR has closed", () => {
    expect(qrClosed(2_000, 1_999)).toBe(false);
    expect(qrClosed(2_000, 2_000)).toBe(true);
    expect(qrClosed(null, 9_999)).toBe(false);
  });
});

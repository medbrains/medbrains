/**
 * Open an online payment in its provider's own way (#4884) and hand back
 * what the server needs to check it. The server decides what was paid —
 * from the provider's own record — never this code.
 *
 * - `razorpay_js`: Razorpay Standard Checkout; its signed result.
 * - `cashfree_js`: Cashfree's JS SDK v3 on the order's payment session.
 * - `redirect`: a hosted page (PhonePe) opened in a new tab.
 * - `form_post`: a signed form (PayU) posted to the provider in a new tab.
 */
import type {
  CreatePaymentOrderResponse,
  OnlineCheckout,
  VerifyPaymentRequest,
} from "@medbrains/types";
import { loadRazorpayCheckout } from "@/lib/razorpay-checkout";

export const CASHFREE_SDK_SRC = "https://sdk.cashfree.com/js/v3/cashfree.js";

/** The patient closed checkout: nothing was charged. */
export class CheckoutClosed extends Error {}

interface CashfreeResult {
  error?: { message?: string };
}
type CashfreeFactory = (options: { mode: string }) => {
  checkout: (options: {
    paymentSessionId: string;
    redirectTarget: string;
  }) => Promise<CashfreeResult>;
};

declare global {
  interface Window {
    Cashfree?: CashfreeFactory;
  }
}

let cashfreeLoading: Promise<CashfreeFactory> | null = null;

/** Load Cashfree's SDK once and hand back its factory. */
export function loadCashfree(doc: Document = document): Promise<CashfreeFactory> {
  const ready = doc.defaultView?.Cashfree;
  if (ready) return Promise.resolve(ready);
  if (cashfreeLoading) return cashfreeLoading;
  cashfreeLoading = new Promise<CashfreeFactory>((resolve, reject) => {
    const script = doc.createElement("script");
    script.src = CASHFREE_SDK_SRC;
    script.async = true;
    script.onload = () => {
      const factory = doc.defaultView?.Cashfree;
      if (factory) resolve(factory);
      else reject(new Error("Cashfree checkout loaded but did not start"));
    };
    script.onerror = () => reject(new Error("Cashfree checkout could not be loaded"));
    doc.head.appendChild(script);
  }).catch((error: unknown) => {
    cashfreeLoading = null;
    throw error;
  });
  return cashfreeLoading;
}

export interface CheckoutParty {
  amount: number;
  currency: string;
  patientName?: string;
}

async function payWithRazorpay(
  keyId: string,
  orderId: string,
  party: CheckoutParty,
): Promise<VerifyPaymentRequest> {
  const Razorpay = await loadRazorpayCheckout();
  return new Promise((resolve, reject) => {
    const checkout = new Razorpay({
      key: keyId,
      order_id: orderId,
      amount: Math.round(party.amount * 100),
      currency: party.currency,
      name: "MedBrains HMS",
      description: party.patientName ? `Payment for ${party.patientName}` : "Hospital payment",
      prefill: { name: party.patientName ?? "" },
      handler: resolve,
      modal: { ondismiss: () => reject(new CheckoutClosed("Checkout was closed")) },
    });
    checkout.open();
  });
}

/** A signed form posted to the provider's page, in a new tab. */
function postForm(action: string, fields: Record<string, string>, doc: Document = document) {
  const form = doc.createElement("form");
  form.method = "POST";
  form.action = action;
  form.target = "_blank";
  for (const [name, value] of Object.entries(fields)) {
    const input = doc.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  doc.body.appendChild(form);
  form.submit();
  form.remove();
}

/** The checkout a server answer describes (older answers carry only Razorpay's key). */
export function checkoutOf(order: CreatePaymentOrderResponse): OnlineCheckout | null {
  if (order.checkout) return order.checkout;
  if (order.key_id && order.order_id) {
    return { kind: "razorpay_js", key_id: order.key_id, order_id: order.order_id };
  }
  return null;
}

/** Whether the patient pays in another tab (the counter waits for the provider). */
export function paysElsewhere(checkout: OnlineCheckout): boolean {
  return checkout.kind === "redirect" || checkout.kind === "form_post";
}

/** Open the payment; resolves with what to verify once the patient is done. */
export async function openCheckout(
  order: CreatePaymentOrderResponse,
  party: CheckoutParty,
): Promise<VerifyPaymentRequest> {
  const checkout = checkoutOf(order);
  const row = { transaction_id: order.transaction_id };
  switch (checkout?.kind) {
    case "razorpay_js":
      return payWithRazorpay(checkout.key_id, checkout.order_id, party);
    case "cashfree_js": {
      const cashfree = (await loadCashfree())({ mode: checkout.mode });
      const result = await cashfree.checkout({
        paymentSessionId: checkout.session_id,
        redirectTarget: "_modal",
      });
      if (result.error) throw new CheckoutClosed(result.error.message ?? "Checkout was closed");
      return row;
    }
    case "redirect":
      window.open(checkout.url, "_blank", "noopener");
      return row;
    case "form_post":
      postForm(checkout.action, checkout.fields);
      return row;
    default:
      throw new Error("This provider gave no way to pay online. Take the payment another way.");
  }
}

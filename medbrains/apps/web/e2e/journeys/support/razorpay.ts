/**
 * Razorpay, mocked only at its boundary, for the payments journeys.
 *
 * - The server under test is started with
 *   `RAZORPAY_API_BASE_OVERRIDE=http://127.0.0.1:$E2E_RAZORPAY_MOCK_PORT/v1`,
 *   so its own orders, payment look-ups and refunds reach the stand-in API
 *   below — our server is never mocked.
 * - The browser gets a stand-in `checkout.js` (served with `page.route`)
 *   that "pays" the order it is opened on, signing the result with the test
 *   key secret exactly as Razorpay's checkout does.
 * - Webhooks are posted to the real `/api/webhooks/razorpay`, signed with
 *   the webhook secret.
 */
import { createHmac, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { APIRequestContext, Page } from "@playwright/test";
import { E2E_BACKEND_URL } from "../../helpers/api";

export const MOCK_PORT = Number(process.env.E2E_RAZORPAY_MOCK_PORT ?? 0);
export const KEY_ID = "rzp_test_e2ejourney";
export const KEY_SECRET = "e2e-journey-key-secret";
export const WEBHOOK_SECRET = "e2e-journey-webhook-secret";
export const CHECKOUT_URL = "https://checkout.razorpay.com/v1/checkout.js";

/** Why a payments journey cannot run here, or `null` when it can. */
export const mockUnavailable = MOCK_PORT
  ? null
  : "Set E2E_RAZORPAY_MOCK_PORT and start the server with RAZORPAY_API_BASE_OVERRIDE pointing at it";

interface Order {
  id: string;
  amount: number;
  receipt: string;
}

export interface RazorpayMock {
  orders: Map<string, Order>;
  refunds: Array<{ paymentId: string; amount: number; id: string }>;
  /** The method every payment reports. */
  method: string;
  /** Paise added to what an order asked for when it is captured (over-capture). */
  extraCaptured: number;
  /** Refuse every order, as Razorpay does for a bad key. */
  refuseOrders: boolean;
}

const state: RazorpayMock = {
  orders: new Map(),
  refunds: [],
  method: "card",
  extraCaptured: 0,
  refuseOrders: false,
};
let server: Server | null = null;

/** The id the stand-in checkout gives the payment of an order. */
export const paymentIdFor = (orderId: string) => `pay_${orderId.slice("order_".length)}`;

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {}));
  });
}

async function answer(req: IncomingMessage): Promise<[number, unknown]> {
  const path = new URL(req.url ?? "/", "http://mock").pathname;
  if (req.method === "POST" && path === "/v1/orders") {
    const body = await readJson(req);
    if (state.refuseOrders) {
      return [400, { error: { description: "The api key provided is invalid" } }];
    }
    const id = `order_${randomUUID().replaceAll("-", "").slice(0, 14)}`;
    const order = { id, amount: Number(body.amount), receipt: String(body.receipt) };
    state.orders.set(id, order);
    return [200, { ...order, status: "created" }];
  }
  const refund = path.match(/^\/v1\/payments\/([^/]+)\/refund$/);
  if (req.method === "POST" && refund?.[1]) {
    const body = await readJson(req);
    const made = { paymentId: refund[1], amount: Number(body.amount), id: `rfnd_${randomUUID().slice(0, 12)}` };
    state.refunds.push(made);
    return [200, { id: made.id, payment_id: made.paymentId, amount: made.amount, status: "processed" }];
  }
  const payment = path.match(/^\/v1\/payments\/([^/]+)$/);
  if (req.method === "GET" && payment?.[1]) {
    const order = [...state.orders.values()].find((o) => paymentIdFor(o.id) === payment[1]);
    if (!order) return [400, { error: { description: "The id provided does not exist" } }];
    return [
      200,
      {
        id: payment[1],
        order_id: order.id,
        amount: order.amount + state.extraCaptured,
        currency: "INR",
        status: "captured",
        method: state.method,
      },
    ];
  }
  return [404, { error: { description: `no stand-in for ${req.method} ${path}` } }];
}

/** The stand-in Razorpay API, started once per worker; reset for each test. */
export async function razorpayMock(): Promise<RazorpayMock> {
  state.method = "card";
  state.extraCaptured = 0;
  state.refuseOrders = false;
  if (server) return state;
  server = createServer((req, res) => {
    void answer(req).then(([status, body]) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    });
  });
  await new Promise<void>((resolve) => server?.listen(MOCK_PORT, "127.0.0.1", resolve));
  return state;
}

/** The hospital's Razorpay keys for this test (restored afterwards by `setting`). */
export async function useTestKeys(
  setting: (category: string, key: string, value: unknown) => Promise<void>,
): Promise<void> {
  await setting("payments", "active_provider", "razorpay");
  await setting("payments", "razorpay_config", {
    key_id: KEY_ID,
    key_secret: KEY_SECRET,
    webhook_secret: WEBHOOK_SECRET,
  });
}

/**
 * A stand-in checkout.js. `open()` pays the order at once — or, when the
 * page has set `window.__holdCheckout`, waits for `window.__releaseCheckout()`
 * so a test can deliver the webhook first. `window.__lastCheckout` names
 * what it was opened on.
 */
const FAKE_CHECKOUT = `
(() => {
  const SECRET = ${JSON.stringify(KEY_SECRET)};
  async function sign(message) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(SECRET),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", key, enc.encode(message));
    return Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  function Razorpay(options) { this.options = options; }
  Razorpay.prototype.open = async function () {
    const o = this.options;
    const paymentId = "pay_" + o.order_id.slice("order_".length);
    const signature = await sign(o.order_id + "|" + paymentId);
    window.__lastCheckout = { key: o.key, order_id: o.order_id, payment_id: paymentId, amount: o.amount };
    const pay = () => o.handler({ razorpay_order_id: o.order_id,
      razorpay_payment_id: paymentId, razorpay_signature: signature });
    if (window.__holdCheckout) window.__releaseCheckout = pay; else pay();
  };
  window.Razorpay = Razorpay;
})();
`;

/** Serve the stand-in checkout.js to this page — or fail to, like a blocked CDN. */
export async function serveCheckout(page: Page, outcome: "loads" | "fails" = "loads"): Promise<void> {
  await page.route(CHECKOUT_URL, (route) =>
    outcome === "loads"
      ? route.fulfill({ status: 200, contentType: "application/javascript", body: FAKE_CHECKOUT })
      : route.abort("connectionrefused"),
  );
}

export interface CheckoutOpened {
  key: string;
  order_id: string;
  payment_id: string;
  amount: number;
}

/** What the stand-in checkout was opened on, once it has been. */
export async function checkoutOpened(page: Page): Promise<CheckoutOpened> {
  const handle = await page.waitForFunction(
    () => (window as unknown as { __lastCheckout?: unknown }).__lastCheckout,
  );
  return (await handle.jsonValue()) as CheckoutOpened;
}

/** Post a Razorpay webhook to the real server, signed as Razorpay signs it. */
export async function postWebhook(
  request: APIRequestContext,
  body: unknown,
  secret = WEBHOOK_SECRET,
): Promise<number> {
  const raw = JSON.stringify(body);
  const resp = await request.post(`${E2E_BACKEND_URL}/api/webhooks/razorpay`, {
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": createHmac("sha256", secret).update(raw).digest("hex"),
      "x-razorpay-event-id": `evt_${randomUUID()}`,
    },
    data: raw,
  });
  return resp.status();
}

/** Razorpay's `payment.captured` for the payment the stand-in checkout made. */
export function capturedEvent(opened: CheckoutOpened, method = "card"): unknown {
  return {
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: opened.payment_id,
          order_id: opened.order_id,
          amount: opened.amount,
          method,
          status: "captured",
        },
      },
    },
  };
}

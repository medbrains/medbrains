/**
 * Cashfree, mocked only at its boundary, for the provider-switch journey (#4884).
 *
 * - The server under test is started with
 *   `CASHFREE_API_BASE_OVERRIDE=http://127.0.0.1:$E2E_CASHFREE_MOCK_PORT/pg`,
 *   so its orders and payment look-ups reach the stand-in below.
 * - The browser gets a stand-in `cashfree.js` (served with `page.route`) whose
 *   `checkout()` completes at once, as the real modal does once the patient pays.
 * - Webhooks are posted to the real `/api/webhooks/cashfree`, signed as Cashfree
 *   signs: base64 HMAC-SHA256 of timestamp + raw body under the secret key.
 */
import { createHmac } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { APIRequestContext, Page } from "@playwright/test";
import { E2E_BACKEND_URL } from "../../helpers/api";

export const MOCK_PORT = Number(process.env.E2E_CASHFREE_MOCK_PORT ?? 0);
export const CLIENT_ID = "cf-e2e-app";
export const CLIENT_SECRET = "cf-e2e-secret";
export const SDK_URL = "https://sdk.cashfree.com/js/v3/cashfree.js";

export const mockUnavailable = MOCK_PORT
  ? null
  : "Set E2E_CASHFREE_MOCK_PORT and start the server with CASHFREE_API_BASE_OVERRIDE pointing at it";

export interface CashfreeMock {
  /** Orders made: order id → paise asked. */
  orders: Map<string, number>;
  /** The payment group every payment reports. */
  method: string;
}

const state: CashfreeMock = { orders: new Map(), method: "credit_card" };
let server: Server | null = null;

/** Cashfree's payment id for the payment of an order. */
export const paymentIdFor = (orderId: string) => `cf${orderId.replaceAll("-", "").slice(0, 12)}`;

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
  if (req.method === "POST" && path === "/pg/orders") {
    const body = await readJson(req);
    const id = String(body.order_id);
    state.orders.set(id, Math.round(Number(body.order_amount) * 100));
    return [200, { order_id: id, payment_session_id: `session_${id}`, order_status: "ACTIVE" }];
  }
  const payments = path.match(/^\/pg\/orders\/([^/]+)\/payments$/);
  if (req.method === "GET" && payments?.[1]) {
    const paise = state.orders.get(payments[1]);
    if (paise === undefined) return [200, []];
    return [
      200,
      [
        {
          cf_payment_id: paymentIdFor(payments[1]),
          order_id: payments[1],
          payment_status: "SUCCESS",
          payment_amount: paise / 100,
          payment_group: state.method,
        },
      ],
    ];
  }
  if (req.method === "GET" && path.startsWith("/pg/orders/")) {
    return [404, { message: "order not found" }];
  }
  return [404, { message: `no stand-in for ${req.method} ${path}` }];
}

/** The stand-in Cashfree API, started once per worker; reset for each test. */
export async function cashfreeMock(): Promise<CashfreeMock> {
  state.method = "credit_card";
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

/** A stand-in cashfree.js: `checkout()` resolves as Cashfree's modal does once paid. */
const FAKE_SDK = `
(() => {
  window.Cashfree = (options) => ({
    checkout: async (o) => {
      window.__lastCashfree = { mode: options.mode, session: o.paymentSessionId };
      return {};
    },
  });
})();
`;

export async function serveSdk(page: Page): Promise<void> {
  await page.route(SDK_URL, (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: FAKE_SDK }),
  );
}

/** What the stand-in SDK was opened on. */
export async function sdkOpened(page: Page): Promise<{ mode: string; session: string }> {
  const handle = await page.waitForFunction(
    () => (window as unknown as { __lastCashfree?: unknown }).__lastCashfree,
  );
  return (await handle.jsonValue()) as { mode: string; session: string };
}

/** Cashfree's `PAYMENT_SUCCESS_WEBHOOK` for an order, posted signed to the real server. */
export async function postPaymentSuccess(
  request: APIRequestContext,
  orderId: string,
  paise: number,
): Promise<number> {
  const raw = JSON.stringify({
    type: "PAYMENT_SUCCESS_WEBHOOK",
    data: {
      order: { order_id: orderId },
      payment: {
        cf_payment_id: paymentIdFor(orderId),
        payment_status: "SUCCESS",
        payment_amount: paise / 100,
        payment_group: state.method,
      },
    },
  });
  const timestamp = String(Date.now());
  const signature = createHmac("sha256", CLIENT_SECRET).update(timestamp + raw).digest("base64");
  const resp = await request.post(`${E2E_BACKEND_URL}/api/webhooks/cashfree`, {
    headers: {
      "content-type": "application/json",
      "x-webhook-timestamp": timestamp,
      "x-webhook-signature": signature,
    },
    data: raw,
  });
  return resp.status();
}

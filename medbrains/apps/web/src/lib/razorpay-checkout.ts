/**
 * Razorpay Standard Checkout, loaded only when someone pays online.
 *
 * The script is fetched on demand, once per page (a second call reuses the
 * first load; a failed load can be retried). The CSP already allows
 * `checkout.razorpay.com`.
 */

export const RAZORPAY_CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export interface RazorpayCheckoutResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayInstance {
  open: () => void;
}

export type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let loading: Promise<RazorpayConstructor> | null = null;

/** Load checkout.js once and hand back the `Razorpay` constructor. */
export function loadRazorpayCheckout(doc: Document = document): Promise<RazorpayConstructor> {
  const ready = doc.defaultView?.Razorpay;
  if (ready) return Promise.resolve(ready);
  if (loading) return loading;
  loading = new Promise<RazorpayConstructor>((resolve, reject) => {
    const script = doc.createElement("script");
    script.src = RAZORPAY_CHECKOUT_SRC;
    script.async = true;
    script.onload = () => {
      const ctor = doc.defaultView?.Razorpay;
      if (ctor) resolve(ctor);
      else reject(new Error("Razorpay checkout loaded but did not start"));
    };
    script.onerror = () => reject(new Error("Razorpay checkout could not be loaded"));
    doc.head.appendChild(script);
  }).catch((error: unknown) => {
    loading = null; // let the next attempt try again
    throw error;
  });
  return loading;
}

/** Test seam: forget a previous load. */
export function resetRazorpayCheckout(): void {
  loading = null;
}

export interface PollOptions {
  /** First wait, doubled each time up to `maxDelayMs`. */
  initialDelayMs?: number;
  maxDelayMs?: number;
  /** Give up after this many checks. */
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_POLL: Required<Omit<PollOptions, "sleep">> = {
  initialDelayMs: 1_000,
  maxDelayMs: 8_000,
  maxAttempts: 8,
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Check `read` with backoff until `done` says the value is final. Returns
 * the final value, or `null` when it never got there within the bound —
 * the caller says so; it never waits forever.
 */
export async function pollUntil<T>(
  read: () => Promise<T>,
  done: (value: T) => boolean,
  options: PollOptions = {},
): Promise<T | null> {
  const { initialDelayMs, maxDelayMs, maxAttempts } = { ...DEFAULT_POLL, ...options };
  const sleep = options.sleep ?? wait;
  let delay = initialDelayMs;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await sleep(delay);
    const value = await read();
    if (done(value)) return value;
    delay = Math.min(delay * 2, maxDelayMs);
  }
  return null;
}

/** Statuses after which a payment row will not change on its own. */
export const SETTLED_STATUSES: ReadonlySet<string> = new Set(["captured", "failed", "refunded"]);

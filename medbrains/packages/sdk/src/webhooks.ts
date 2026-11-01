import { createHmac, timingSafeEqual } from "node:crypto";

/** Five minutes either side, as in PROTOCOL.md §5. Older deliveries are replays. */
export const DEFAULT_TOLERANCE_SECONDS = 300;

export interface VerifyOptions {
  /** The app's webhook signing secret (`whsec_…`), shown once at registration. */
  secret: string;
  /** The `X-MedBrains-Signature` header: `t=<unix seconds>,v1=<hex>`. */
  header: string | null | undefined;
  /** The raw request body, exactly as received — not re-serialised JSON. */
  body: string;
  toleranceSeconds?: number;
  /** For tests. Unix seconds. */
  now?: number;
}

export type VerifyResult = { ok: true; timestamp: number } | { ok: false; reason: string };

/** HMAC-SHA256 over `"<t>.<body>"`, hex — what MedBrains signs. */
export function sign(secret: string, timestamp: number, body: string): string {
  const mac = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${mac}`;
}

/**
 * Check a delivery came from the hospital and is fresh. Constant-time compare;
 * a missing, malformed, stale or wrong signature is refused with a reason.
 */
export function verifySignature(opts: VerifyOptions): VerifyResult {
  const parts = new Map(
    (opts.header ?? "").split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()] as const;
    }),
  );
  const t = Number(parts.get("t"));
  const v1 = parts.get("v1");
  if (!Number.isInteger(t) || !v1) return { ok: false, reason: "missing or malformed signature" };
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - t) > (opts.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS)) {
    return { ok: false, reason: "timestamp outside the replay window" };
  }
  const expected = Buffer.from(sign(opts.secret, t, opts.body).split("v1=")[1] ?? "", "hex");
  const given = Buffer.from(v1, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "signature does not match" };
  }
  return { ok: true, timestamp: t };
}

/** A delivered event. `id` is the idempotency key: the same on every retry. */
export interface WebhookEvent {
  id: string;
  type: string;
  created_at: string;
  /** Identifiers, numbers and statuses only — read details through the API. */
  data: Record<string, unknown>;
}

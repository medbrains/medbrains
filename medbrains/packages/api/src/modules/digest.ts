/** The `/digest` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  CreateDigestSubscriptionRequest,
  EodDigestHistory,
  EodDigestSubscription,
} from "@medbrains/types";
import { request } from "../client.js";

export const digestApi = {
  // ══════════════════════════════════════════════════════════════
  // IT SECURITY: EOD DIGEST
  // ══════════════════════════════════════════════════════════════

  getMyDigestSubscription: () => request<EodDigestSubscription | null>("/digest/subscription"),

  upsertDigestSubscription: (data: CreateDigestSubscriptionRequest) =>
    request<EodDigestSubscription>("/digest/subscription", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listDigestHistory: () => request<EodDigestHistory[]>("/digest/history"),
};

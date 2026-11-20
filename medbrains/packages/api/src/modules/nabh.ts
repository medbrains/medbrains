/** The `/nabh` API area. Moved from `client.ts`; one module per first path segment. */
import type { NabhRollupResponse } from "@medbrains/types";
import { request } from "../client.js";

export const nabhApi = {
  // ── NABH KPI rollup ───────────────────────────────────────
  getNabhIndicators: () => request<NabhRollupResponse>(`/nabh/indicators`),
};

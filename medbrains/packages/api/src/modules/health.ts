/** The `/health` API area. Moved from `client.ts`; one module per first path segment. */
import type { HealthResponse } from "@medbrains/types";
import { request } from "../client.js";

export const healthApi = {
  health: () => request<HealthResponse>("/health"),
};
